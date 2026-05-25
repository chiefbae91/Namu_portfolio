import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { detectPatterns, OHLCCandle } from '@/lib/patternDetector';

type Interval = '1m' | '15m' | '1d' | '1wk';
type Range    = '5d' | '1mo' | '3mo' | '6mo' | '1y';

const RANGE_DAYS: Record<string, number> = { '5d': 5, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365 };

function coerceInterval(interval: Interval, range: Range): Interval {
  const days = RANGE_DAYS[range] ?? 30;
  let eff: Interval = interval;
  if (eff === '1m'  && days > 7)  eff = '15m'; // 1m → 15m beyond 5d
  if (eff === '15m' && days > 5)  eff = '1d';  // 15m → 1d beyond 5d (cascade!)
  if (eff === '1wk' && days < 14) eff = '1d';  // 1wk useless for 5d range
  return eff;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const ticker   = searchParams.get('ticker');
  const period   = (searchParams.get('period')   ?? '1mo') as Range;
  const interval = (searchParams.get('interval') ?? '1d')  as Interval;

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const resolvedInterval = coerceInterval(interval, period);
  const isIntraday = resolvedInterval === '1m' || resolvedInterval === '15m';

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${resolvedInterval}&range=${period}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

    if (!res.ok) return NextResponse.json({ patterns: [] });

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result)  return NextResponse.json({ patterns: [] });

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens:  number[] = quote.open  ?? [];
    const highs:  number[] = quote.high  ?? [];
    const lows:   number[] = quote.low   ?? [];
    const closes: number[] = quote.close ?? [];

    const candles: OHLCCandle[] = timestamps
      .map((ts: number, i: number) => {
        const d    = new Date(ts * 1000);
        const date = isIntraday
          ? `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
          : d.toISOString().slice(0, 10);
        return { date, open: opens[i], high: highs[i], low: lows[i], close: closes[i] };
      })
      .filter(c => c.close != null && c.open != null && c.high != null && c.low != null);

    const patterns = detectPatterns(candles);
    return NextResponse.json({ patterns });
  } catch {
    return NextResponse.json({ patterns: [] });
  }
}
