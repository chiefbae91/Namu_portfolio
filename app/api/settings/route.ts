import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';

// settings table does not exist in the current Supabase schema — return safe defaults
export async function GET(req: Request) {
  if (!await getAuthUser()) return unauthorized();
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  return NextResponse.json({ key, value: null });
}

export async function PUT() {
  if (!await getAuthUser()) return unauthorized();
  return NextResponse.json({ ok: true });
}
