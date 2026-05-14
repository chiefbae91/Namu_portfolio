import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Interval = '1m' | '15m' | '1d' | '1wk';
type Range = '5d' | '1mo' | '3mo' | '6mo' | '1y';

const RANGE_DAYS: Record<string, number> = { '5d': 5, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365 };

function coerceInterval(interval: Interval, range: Range): Interval {
  const days = RANGE_DAYS[range] ?? 30;
  if (interval === '1m' && days > 7) return days <= 60 ? '15m' : '1d';
  if (interval === '15m' && days > 60) return '1d';
  return interval;
}

export async function GET(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const rangeParam = (searchParams.get('range') ?? '1mo') as Range;
  const intervalParam = (searchParams.get('interval') ?? '1d') as Interval;

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const resolvedInterval = coerceInterval(intervalParam, rangeParam);
  const isIntraday = resolvedInterval === '1m' || resolvedInterval === '15m';
  const supabase = getAdminClient();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${resolvedInterval}&range=${rangeParam}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

    if (!res.ok) return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [], holdings: [] });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [], holdings: [] });

    const price = result.meta?.regularMarketPrice ?? 0;
    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: number[] = quote.open ?? [];
    const highs: number[] = quote.high ?? [];
    const lows: number[] = quote.low ?? [];
    const closes: number[] = quote.close ?? [];

    const candles = timestamps
      .map((ts: number, i: number) => {
        const d = new Date(ts * 1000);
        const date = isIntraday
          ? `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
          : d.toISOString().slice(0, 10);
        return { time: ts, date, open: opens[i] ?? null, high: highs[i] ?? null, low: lows[i] ?? null, close: closes[i] ?? null };
      })
      .filter(c => c.close !== null && c.open !== null);

    const { data: accountsData } = await supabase.from('accounts').select('id, name, hidden');
    const accountNameMap: Record<string, string> = Object.fromEntries((accountsData || []).map((a: any) => [a.id, a.name]));

    const { data: txData } = await supabase
      .from('transactions')
      .select('id, transaction_date, type, quantity, price, fee, ticker, note, account_id')
      .eq('ticker', ticker)
      .or('type.ilike.buy,type.ilike.sell,type.ilike.dividend')
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: false });

    const transactions = (txData || []).map((t: any) => ({
      ...t,
      date: t.transaction_date,
      notes: t.note,
      account_name: accountNameMap[t.account_id],
    }));

    if (!isIntraday && price > 0 && candles.length > 0) {
      const rangeStart = candles[0].date;
      const candleDates = new Set(candles.map(c => c.date));
      const missingDates = new Set<string>();
      for (const tx of transactions) {
        const d = (tx.date as string).slice(0, 10);
        if (d >= rangeStart && !candleDates.has(d)) missingDates.add(d);
      }
      for (const d of missingDates) {
        const ts = Math.floor(new Date(d + 'T20:00:00Z').getTime() / 1000);
        candles.push({ time: ts, date: d, open: price, high: price, low: price, close: price });
      }
      if (missingDates.size > 0) candles.sort((a, b) => a.time - b.time);
    }

    // Per-account holdings via FIFO lot calculation
    const [{ data: hLotData }, { data: hSellData }] = await Promise.all([
      supabase.from('transactions').select('id, account_id, quantity, price, fee')
        .ilike('type', 'buy').eq('ticker', ticker)
        .order('transaction_date').order('id'),
      supabase.from('transactions').select('id, account_id, quantity')
        .ilike('type', 'sell').eq('ticker', ticker)
        .order('transaction_date').order('id'),
    ]);

    const hLots = (hLotData || []).map((r: any) => ({ ...r, remaining: r.quantity as number }));

    // FIFO — same account first, cross-account fallback for mismatched UUIDs
    for (const sell of hSellData || []) {
      let need = sell.quantity as number;
      for (const lot of hLots) {
        if (need <= 0) break;
        if (lot.account_id !== sell.account_id || lot.remaining < 0.00001) continue;
        const use = Math.min(lot.remaining, need);
        lot.remaining -= use;
        need -= use;
      }
      if (need > 0.00001) {
        for (const lot of hLots) {
          if (need <= 0) break;
          if (lot.remaining < 0.00001) continue;
          const use = Math.min(lot.remaining, need);
          lot.remaining -= use;
          need -= use;
        }
      }
    }

    // Group by resolved account name; lots with unrecognised UUIDs accumulate under one key
    const holdingMap: Record<string, { account_id: string; account_name: string; qty: number; cost: number }> = {};
    for (const lot of hLots) {
      if (lot.remaining < 0.00001) continue;
      const resolvedName: string = accountNameMap[lot.account_id] ?? '';
      const key = resolvedName || '__unknown__';
      if (!holdingMap[key]) holdingMap[key] = { account_id: resolvedName ? lot.account_id : 'unknown', account_name: resolvedName || 'Portfolio', qty: 0, cost: 0 };
      const feePerShare = lot.quantity > 0 ? lot.fee / lot.quantity : 0;
      holdingMap[key].qty += lot.remaining;
      holdingMap[key].cost += lot.remaining * (lot.price + feePerShare);
    }

    const holdings = Object.values(holdingMap)
      .map(h => ({ account_id: h.account_id, account_name: h.account_name, quantity: h.qty, avg_cost: h.qty > 0 ? h.cost / h.qty : 0 }))
      .filter(h => h.quantity > 0.00001);

    return NextResponse.json({ price, candles, resolvedInterval, transactions, holdings });
  } catch {
    return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [], holdings: [] });
  }
}
