import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

const RANGE_CONFIG: Record<string, { yfRange: string; interval: string }> = {
  '1W': { yfRange: '5d',  interval: '1d' },
  '1M': { yfRange: '1mo', interval: '1d' },
  '3M': { yfRange: '3mo', interval: '1d' },
  '6M': { yfRange: '6mo', interval: '1d' },
  '1Y': { yfRange: '1y',  interval: '1d' },
  '2Y': { yfRange: '2y',  interval: '1wk' },
  '5Y': { yfRange: '5y',  interval: '1wk' },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountIdStr = searchParams.get('account_id');
  const range = searchParams.get('range') ?? '1M';

  if (!accountIdStr) return NextResponse.json({ error: 'account_id required' }, { status: 400 });

  const accountId = parseInt(accountIdStr);
  const db = getDb();
  const { yfRange, interval } = RANGE_CONFIG[range] ?? RANGE_CONFIG['1M'];

  const account = db.prepare('SELECT id, name FROM accounts WHERE id = ?').get(accountId) as
    | { id: number; name: string }
    | undefined;
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const txs = db.prepare(`
    SELECT date, type, ticker, quantity, price, fee
    FROM transactions WHERE account_id = ?
    ORDER BY date ASC, id ASC
  `).all(accountId) as {
    date: string; type: string; ticker: string | null;
    quantity: number; price: number; fee: number;
  }[];

  const flows = db.prepare(`
    SELECT date, amount, type FROM cash_flow WHERE account_id = ?
    ORDER BY date ASC
  `).all(accountId) as { date: string; amount: number; type: string }[];

  const tickers = [
    ...new Set(
      txs
        .filter(t => t.type === 'buy' || t.type === 'sell')
        .map(t => t.ticker)
        .filter((t): t is string => !!t)
    ),
  ];

  // Use SPY as calendar backbone when account has no stock positions
  const fetchList = tickers.length > 0 ? tickers : ['SPY'];
  const priceMap: Record<string, Record<string, number>> = {};

  await Promise.all(
    fetchList.map(async ticker => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${yfRange}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return;
        const timestamps: number[] = result.timestamp ?? [];
        const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
        priceMap[ticker] = {};
        timestamps.forEach((ts, i) => {
          if (closes[i] != null) {
            priceMap[ticker][new Date(ts * 1000).toISOString().slice(0, 10)] = closes[i];
          }
        });
      } catch { /* ignore */ }
    })
  );

  const allDates = [
    ...new Set(Object.values(priceMap).flatMap(p => Object.keys(p))),
  ].sort();

  if (allDates.length === 0) return NextResponse.json({ account_name: account.name, data: [] });

  // Incrementally compute portfolio value for each trading date
  let cash = 0;
  const holdings: Record<string, number> = {};
  const lastKnownPrice: Record<string, number> = {};
  let ti = 0;
  let fi = 0;
  const data: { date: string; value: number }[] = [];

  for (const date of allDates) {
    while (ti < txs.length && txs[ti].date <= date) {
      const tx = txs[ti++];
      if (tx.type === 'buy') {
        holdings[tx.ticker!] = (holdings[tx.ticker!] ?? 0) + tx.quantity;
        cash -= tx.quantity * tx.price + (tx.fee ?? 0);
      } else if (tx.type === 'sell') {
        holdings[tx.ticker!] = (holdings[tx.ticker!] ?? 0) - tx.quantity;
        cash += tx.quantity * tx.price - (tx.fee ?? 0);
      } else if (tx.type === 'dividend') {
        cash += tx.quantity * tx.price;
      } else if (tx.type === 'cash') {
        cash += tx.price;
      }
    }
    while (fi < flows.length && flows[fi].date <= date) {
      const f = flows[fi++];
      cash += f.type === 'DEPOSIT' ? f.amount : -f.amount;
    }

    for (const ticker of tickers) {
      if (priceMap[ticker]?.[date] != null) lastKnownPrice[ticker] = priceMap[ticker][date];
    }

    let stockVal = 0;
    for (const [ticker, qty] of Object.entries(holdings)) {
      if (qty > 0.00001) stockVal += qty * (lastKnownPrice[ticker] ?? 0);
    }

    data.push({ date, value: cash + stockVal });
  }

  return NextResponse.json({ account_name: account.name, data });
}
