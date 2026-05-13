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

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${resolvedInterval}&range=${rangeParam}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [] });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [] });

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
        return {
          time: ts,
          date,
          open: opens[i] ?? null,
          high: highs[i] ?? null,
          low: lows[i] ?? null,
          close: closes[i] ?? null,
        };
      })
      .filter(c => c.close !== null && c.open !== null);

    const db = getDb();
    const transactions = db.prepare(`
      SELECT t.id, t.date, t.type, t.quantity, t.price, t.fee, t.ticker,
             a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.ticker = ? AND t.type IN ('buy','sell','dividend')
      ORDER BY t.date DESC, t.id DESC
    `).all(ticker);

    return NextResponse.json({ price, candles, resolvedInterval, transactions });
  } catch {
    return NextResponse.json({ price: 0, candles: [], resolvedInterval, transactions: [] });
  }
}
