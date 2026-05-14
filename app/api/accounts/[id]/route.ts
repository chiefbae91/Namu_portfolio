import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const { name, hidden } = await req.json();
  const id = Number(params.id);

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    try {
      db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name.trim(), id);
    } catch {
      return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
    }
  }
  if (hidden !== undefined) {
    db.prepare('UPDATE accounts SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, id);
  }

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return NextResponse.json(account);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const id = Number(params.id);
  const txCount = (db.prepare('SELECT COUNT(*) as c FROM transactions WHERE account_id = ?').get(id) as any).c;
  if (txCount > 0) return NextResponse.json({ error: 'Account has transactions' }, { status: 409 });
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
