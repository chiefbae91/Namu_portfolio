import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';

// options table does not exist in the current Supabase schema
export async function PUT() {
  if (!await getAuthUser()) return unauthorized();
  return NextResponse.json({ error: 'Options table not configured in Supabase' }, { status: 501 });
}

export async function DELETE() {
  if (!await getAuthUser()) return unauthorized();
  return NextResponse.json({ ok: true });
}
