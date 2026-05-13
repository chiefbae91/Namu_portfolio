import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!ticker || !date) {
    return NextResponse.json({ error: 'ticker and date required' }, { status: 400 });
  }

  try {
    // Fetch ~7 days before the target date to handle weekends/holidays.
    // Use 16:00 UTC (≈ market close ET) as the anchor to get same-day close.
    const targetMs = new Date(date + 'T16:00:00Z').getTime();
    const period1 = Math.floor((targetMs - 8 * 86_400_000) / 1000);
    const period2 = Math.floor((targetMs + 2 * 86_400_000) / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

    if (!res.ok) return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: 'No data returned' }, { status: 404 });

    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

    // Find the most recent candle whose date is on or before the target date.
    const targetTs = targetMs / 1000;
    let bestIdx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      if (timestamps[i] <= targetTs + 86_400) bestIdx = i; // allow +1 day tolerance
    }

    if (bestIdx !== -1) {
      const price = closes[bestIdx];
      const actualDate = new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10);
      return NextResponse.json({ price, date: actualDate });
    }

    // Fallback: regularMarketPrice (useful for today before close)
    const mp = result.meta?.regularMarketPrice ?? 0;
    if (mp > 0) return NextResponse.json({ price: mp, date });

    return NextResponse.json({ error: 'No price data for this date' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
