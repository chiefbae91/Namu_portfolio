import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!ticker || !date) {
    return NextResponse.json({ error: 'ticker and date required' }, { status: 400 });
  }

  try {
    // Parse date parts explicitly with Date.UTC to avoid any timezone interpretation.
    const [yyyy, mm, dd] = date.split('-').map(Number);
    if (!yyyy || !mm || !dd) {
      return NextResponse.json({ error: 'invalid date format' }, { status: 400 });
    }

    // period1 = 10 calendar days before target (catches holidays + weekends)
    // period2 = midnight UTC of the day AFTER target (exclusive upper bound)
    const period1 = Math.floor(Date.UTC(yyyy, mm - 1, dd - 10) / 1000);
    const period2 = Math.floor(Date.UTC(yyyy, mm - 1, dd + 1) / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

    if (!res.ok) return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: 'No data returned' }, { status: 404 });

    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

    // Upper bound: midnight UTC of the day after target.
    // Any candle whose timestamp falls before this is on or before the target date.
    const upperBound = period2;
    let bestIdx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      if (timestamps[i] < upperBound) bestIdx = i;
    }

    if (bestIdx !== -1) {
      return NextResponse.json({ price: closes[bestIdx] });
    }

    // Fallback: regularMarketPrice for today before close
    const mp = result.meta?.regularMarketPrice ?? 0;
    if (mp > 0) return NextResponse.json({ price: mp });

    return NextResponse.json({ error: 'No price data available' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
