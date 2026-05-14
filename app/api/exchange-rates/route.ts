import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';

const FALLBACK: Record<string, number> = { USD: 1, KRW: 1380, EUR: 0.92, DXY: 104, WTI: 78, GOLD: 2300, ES: 5800, ES_PREV: 5800 };

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

async function yahooQuote(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price: number = meta.regularMarketPrice;
    const prevClose: number = meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? price;
    if (price == null) return null;
    return { price, prevClose };
  } catch {
    return null;
  }
}

export async function GET() {
  if (!await getAuthUser()) return unauthorized();
  // USDKRW=X → 1 USD = X KRW (direct)
  // EURUSD=X → 1 EUR = X USD → invert to get USD→EUR rate
  const [krw, eurusd, dxy, wti, gold, es] = await Promise.all([
    yahooRate('USDKRW=X'),
    yahooRate('EURUSD=X'),
    yahooRate('DX-Y.NYB'),
    yahooRate('CL=F'),
    yahooRate('GC=F'),
    yahooQuote('ES=F'),
  ]);

  return NextResponse.json({
    USD: 1,
    KRW: krw ?? FALLBACK.KRW,
    EUR: eurusd != null ? 1 / eurusd : FALLBACK.EUR,
    DXY: dxy ?? FALLBACK.DXY,
    WTI: wti ?? FALLBACK.WTI,
    GOLD: gold ?? FALLBACK.GOLD,
    ES: es?.price ?? FALLBACK.ES,
    ES_PREV: es?.prevClose ?? FALLBACK.ES_PREV,
  });
}
