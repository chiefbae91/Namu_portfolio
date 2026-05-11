import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const { account_id, date, ticker, type, quantity, price, fee, currency, notes } = await req.json();

  db.prepare(`
    UPDATE transactions
    SET account_id=?, date=?, ticker=?, type=?, quantity=?, price=?, fee=?, currency=?, notes=?
    WHERE id=?
  `).run(account_id, date, ticker || '', type, quantity || 0, price || 0, fee || 0, currency || 'USD', notes || '', id);

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(params.id));
  return NextResponse.json({ ok: true });
}
