import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET() {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('accounts').select('*').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name: name.trim(), user_id: user.id })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Account name already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
