import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM cash_flow WHERE id = ?').run(Number(params.id));
  return NextResponse.json({ ok: true });
}
