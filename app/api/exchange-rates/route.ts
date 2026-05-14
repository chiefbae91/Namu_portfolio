import { NextResponse } from 'next/server';

const FALLBACK: Record<string, number> = { USD: 1, KRW: 1380, EUR: 0.92, DXY: 104, WTI: 78, GOLD: 2300 };

async function yahooRate(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  // USDKRW=X → 1 USD = X KRW (direct)
  // EURUSD=X → 1 EUR = X USD → invert to get USD→EUR rate
  const [krw, eurusd, dxy, wti, gold] = await Promise.all([
    yahooRate('USDKRW=X'),
    yahooRate('EURUSD=X'),
    yahooRate('DX-Y.NYB'),
    yahooRate('CL=F'),
    yahooRate('GC=F'),
  ]);

  return NextResponse.json({
    USD: 1,
    KRW: krw ?? FALLBACK.KRW,
    EUR: eurusd != null ? 1 / eurusd : FALLBACK.EUR,
    DXY: dxy ?? FALLBACK.DXY,
    WTI: wti ?? FALLBACK.WTI,
    GOLD: gold ?? FALLBACK.GOLD,
  });
}
