import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const { ticker, hint_date, type, price, current_price, note } = await req.json();
  db.prepare(
    `UPDATE trading_hints SET ticker=?, hint_date=?, type=?, price=?, current_price=?, note=? WHERE id=?`
  ).run(ticker, hint_date, type, price ?? null, current_price ?? null, note ?? null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM trading_hints WHERE id = ?').run(Number(params.id));
  return NextResponse.json({ ok: true });
}
