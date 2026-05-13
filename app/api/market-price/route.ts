import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

type Interval = '1m' | '15m' | '1d' | '1wk';
type Range = '5d' | '1mo' | '3mo' | '6mo' | '1y';

const RANGE_DAYS: Record<string, number> = {
  '5d': 5, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365,
};

function coerceInterval(interval: Interval, range: Range): Interval {
  const days = RANGE_DAYS[range] ?? 30;
  if (interval === '1m' && days > 7) return days <= 60 ? '15m' : '1d';
  if (interval === '15m' && days > 60) return '1d';
  return interval;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const rangeParam = (searchParams.get('range') ?? '1mo') as Range;
  const intervalParam = (searchParams.get('interval') ?? '1d') as Interval;

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const resolvedInterval = coerceInterval(intervalParam, rangeParam);
  const isIntraday = resolvedInterval === '1m' || resolvedInterval === '15m';

  const db = getDb();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${resolvedInterval}&range=${rangeParam}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

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

    // Transactions for chart overlay and history table
    const transactions = db.prepare(`
      SELECT t.id, t.date, t.type, t.quantity, t.price, t.fee, t.ticker,
             a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.ticker = ? AND t.type IN ('buy','sell','dividend')
      ORDER BY t.date DESC, t.id DESC
    `).all(ticker);

    // Per-account holdings via FIFO lot calculation
    const hLotRows = db.prepare(`
      SELECT t.id, t.account_id, a.name as account_name, t.quantity, t.price, t.fee
      FROM transactions t JOIN accounts a ON t.account_id = a.id
      WHERE t.type = 'buy' AND t.ticker = ? AND a.hidden = 0
      ORDER BY t.date ASC, t.id ASC
    `).all(ticker) as any[];

    const hLots = hLotRows.map(r => ({ ...r, remaining: r.quantity as number }));

    const hSells = db.prepare(`
      SELECT t.id, t.account_id, t.quantity
      FROM transactions t JOIN accounts a ON t.account_id = a.id
      WHERE t.type = 'sell' AND t.ticker = ? AND a.hidden = 0
      ORDER BY t.date ASC, t.id ASC
    `).all(ticker) as any[];

    const hAssigns = db.prepare(`
      SELECT la.sell_tx_id, la.buy_tx_id, la.quantity
      FROM lot_assignments la
      JOIN transactions s ON la.sell_tx_id = s.id
      WHERE s.ticker = ?
    `).all(ticker) as any[];

    const hAssignsBySell: Record<number, { buy_tx_id: number; quantity: number }[]> = {};
    for (const a of hAssigns) (hAssignsBySell[a.sell_tx_id] ??= []).push(a);

    for (const sell of hSells) {
      const assigns = hAssignsBySell[sell.id];
      if (assigns?.length) {
        for (const a of assigns) {
          const lot = hLots.find(l => l.id === a.buy_tx_id);
          if (lot) lot.remaining = Math.max(0, lot.remaining - a.quantity);
        }
      } else {
        const accLots = hLots.filter(l => l.account_id === sell.account_id && l.remaining > 0);
        let need = sell.quantity as number;
        for (const lot of accLots) {
          if (need <= 0) break;
          const use = Math.min(lot.remaining, need);
          lot.remaining -= use;
          need -= use;
        }
      }
    }

    const holdingMap: Record<number, { account_name: string; qty: number; cost: number }> = {};
    for (const lot of hLots) {
      if (lot.remaining < 0.00001) continue;
      if (!holdingMap[lot.account_id]) holdingMap[lot.account_id] = { account_name: lot.account_name, qty: 0, cost: 0 };
      const feePerShare = lot.quantity > 0 ? lot.fee / lot.quantity : 0;
      holdingMap[lot.account_id].qty += lot.remaining;
      holdingMap[lot.account_id].cost += lot.remaining * (lot.price + feePerShare);
    }

    const holdings = Object.entries(holdingMap)
      .map(([id, h]) => ({
        account_id: Number(id),
        account_name: h.account_name,
        quantity: Math.round(h.qty * 10000) / 10000,
        avg_cost: h.qty > 0 ? Math.round((h.cost / h.qty) * 100) / 100 : 0,
      }))
      .filter(h => h.quantity > 0.00001);

    return NextResponse.json({ price, candles, resolvedInterval, transactions, holdings });
  } catch {
    return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [], holdings: [] });
  }
}
