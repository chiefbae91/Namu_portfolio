import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET() {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY id').all();
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  try {
    const result = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(name.trim());
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Account name already exists' }, { status: 409 });
  }
}
