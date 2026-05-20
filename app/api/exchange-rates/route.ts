import { NextResponse } from 'next/server';

const FALLBACK: Record<string, number> = { USD: 1, KRW: 1380, KRW_PREV: 1380, EUR: 0.92, DXY: 104, DXY_PREV: 104, WTI: 78, WTI_PREV: 78, GOLD: 2300, GOLD_PREV: 2300, ES: 5800, ES_PREV: 5800, T5Y: 4.25, T10Y: 4.50, T30Y: 4.75 };

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
  // USDKRW=X → 1 USD = X KRW (direct)
  // EURUSD=X → 1 EUR = X USD → invert to get USD→EUR rate
  const [krw, eurusd, dxy, wti, gold, es, t5y, t10y, t30y] = await Promise.all([
    yahooQuote('USDKRW=X'),
    yahooRate('EURUSD=X'),
    yahooQuote('DX-Y.NYB'),
    yahooQuote('CL=F'),
    yahooQuote('GC=F'),
    yahooQuote('ES=F'),
    yahooRate('^FVX'),
    yahooRate('^TNX'),
    yahooRate('^TYX'),
  ]);

  return NextResponse.json({
    USD: 1,
    KRW: krw?.price ?? FALLBACK.KRW,
    KRW_PREV: krw?.prevClose ?? FALLBACK.KRW_PREV,
    EUR: eurusd != null ? 1 / eurusd : FALLBACK.EUR,
    DXY: dxy?.price ?? FALLBACK.DXY,
    DXY_PREV: dxy?.prevClose ?? FALLBACK.DXY_PREV,
    WTI: wti?.price ?? FALLBACK.WTI,
    WTI_PREV: wti?.prevClose ?? FALLBACK.WTI_PREV,
    GOLD: gold?.price ?? FALLBACK.GOLD,
    GOLD_PREV: gold?.prevClose ?? FALLBACK.GOLD_PREV,
    ES: es?.price ?? FALLBACK.ES,
    ES_PREV: es?.prevClose ?? FALLBACK.ES_PREV,
    T5Y: t5y ?? FALLBACK.T5Y,
    T10Y: t10y ?? FALLBACK.T10Y,
    T30Y: t30y ?? FALLBACK.T30Y,
  });
}
