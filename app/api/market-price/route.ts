import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const from = searchParams.get('from');

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  try {
    // Fetch 1-year history for trade analysis chart
    const range = from ? '2y' : '1d';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });

    if (!res.ok) return NextResponse.json({ price: 0, history: [] });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ price: 0, history: [] });

    const price = result.meta?.regularMarketPrice ?? 0;
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

    let history = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ?? null,
    })).filter((d: { date: string; close: number | null }) => d.close !== null);

    if (from) {
      history = history.filter((d: { date: string }) => d.date >= from);
    }

    // Also fetch transactions for this ticker
    if (from) {
      const db = getDb();
      const transactions = db.prepare(`
        SELECT t.id, t.date, t.type, t.quantity, t.price, t.fee, t.ticker,
               a.name as account_name
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.ticker = ? AND t.type IN ('buy','sell','dividend')
        ORDER BY t.date DESC, t.id DESC
      `).all(ticker);
      return NextResponse.json({ price, history, transactions });
    }

    return NextResponse.json({ price, history });
  } catch {
    return NextResponse.json({ price: 0, history: [] });
  }
}
