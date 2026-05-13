import { NextResponse } from 'next/server';

const FALLBACK: Record<string, number> = { USD: 1, KRW: 1380, EUR: 0.92 };

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json(FALLBACK);
    const data = await res.json();
    return NextResponse.json({
      USD: 1,
      KRW: data.rates?.KRW ?? FALLBACK.KRW,
      EUR: data.rates?.EUR ?? FALLBACK.EUR,
    });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
