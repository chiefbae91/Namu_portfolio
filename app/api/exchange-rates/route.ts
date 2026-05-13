import { NextResponse } from 'next/server';

const FALLBACK: Record<string, number> = { USD: 1, KRW: 1380, EUR: 0.92 };

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
  const [krw, eurusd] = await Promise.all([
    yahooRate('USDKRW=X'),
    yahooRate('EURUSD=X'),
  ]);

  return NextResponse.json({
    USD: 1,
    KRW: krw ?? FALLBACK.KRW,
    EUR: eurusd != null ? Math.round((1 / eurusd) * 10000) / 10000 : FALLBACK.EUR,
  });
}
