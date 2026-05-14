import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  return NextResponse.json({ key, value: getSetting(key) });
}

export async function PUT(req: Request) {
  const { key, value } = await req.json();
  if (!key || typeof value !== 'string') return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  setSetting(key, value);
  return NextResponse.json({ ok: true });
}
