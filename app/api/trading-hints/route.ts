import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET() {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM trading_hints ORDER BY hint_date DESC, created_at DESC`
  ).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const { ticker, hint_date, type, price, current_price, note } = await req.json();
  if (!ticker || !hint_date || !type) {
    return NextResponse.json({ error: 'ticker, hint_date, type required' }, { status: 400 });
  }
  const result = db.prepare(
    `INSERT INTO trading_hints (ticker, hint_date, type, price, current_price, note) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ticker, hint_date, type, price ?? null, current_price ?? null, note ?? null);
  return NextResponse.json({ id: result.lastInsertRowid });
}
