import { NextRequest, NextResponse } from 'next/server';

async function fetchQuote(ticker: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { ticker, price: 0, prevClose: 0, marketState: 'CLOSED', extPrice: null, extChangePct: null, error: true };
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return { ticker, price: 0, prevClose: 0, marketState: 'CLOSED', extPrice: null, extChangePct: null, error: true };

    const price: number = meta.regularMarketPrice ?? 0;
    const prevClose: number = meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? price;
    const marketState: string = meta.marketState ?? 'REGULAR';

    let extPrice: number | null = null;
    let extChangePct: number | null = null;
    if (marketState === 'PRE' && meta.preMarketPrice != null) {
      extPrice = meta.preMarketPrice;
      extChangePct = meta.preMarketChangePercent ?? null;
    } else if ((marketState === 'POST' || marketState === 'POSTPOST') && meta.postMarketPrice != null) {
      extPrice = meta.postMarketPrice;
      extChangePct = meta.postMarketChangePercent ?? null;
    }

    return { ticker, price, prevClose, marketState, extPrice, extChangePct };
  } catch {
    return { ticker, price: 0, prevClose: 0, marketState: 'CLOSED', extPrice: null, extChangePct: null, error: true };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('tickers') ?? '';
  const tickers = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 12);
  if (tickers.length === 0) return NextResponse.json([]);
  const quotes = await Promise.all(tickers.map(fetchQuote));
  return NextResponse.json(quotes);
}
