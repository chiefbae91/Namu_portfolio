import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';

// options table does not exist in the current Supabase schema
export async function GET() {
  if (!await getAuthUser()) return unauthorized();
  return NextResponse.json([]);
}

export async function POST() {
  if (!await getAuthUser()) return unauthorized();
  return NextResponse.json({ error: 'Options table not configured in Supabase' }, { status: 501 });
}
