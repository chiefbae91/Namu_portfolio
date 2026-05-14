import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const id = Number(params.id);
  const body = await req.json();

  // Check if it's a close operation
  if (body.close_qty !== undefined) {
    const result = db.prepare(`
      INSERT INTO option_closes (option_id, date, quantity, premium, fee)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, body.date, body.close_qty, body.close_premium, body.close_fee || 0);
    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  }

  db.prepare(`
    UPDATE options SET account_id=?, date=?, ticker=?, option_type=?, action=?, strike=?, expiry=?, quantity=?, premium=?, fee=?
    WHERE id=?
  `).run(body.account_id, body.date, body.ticker, body.option_type, body.action, body.strike, body.expiry, body.quantity, body.premium, body.fee || 0, id);

  return NextResponse.json(db.prepare('SELECT * FROM options WHERE id = ?').get(id));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const id = Number(params.id);
  db.prepare('DELETE FROM option_closes WHERE option_id = ?').run(id);
  db.prepare('DELETE FROM options WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
