import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const { name, hidden } = await req.json();
  const id = params.id;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    updates.name = name.trim();
  }
  if (hidden !== undefined) {
    updates.hidden = !!hidden;
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const id = params.id;

  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id);

  if (count && count > 0) return NextResponse.json({ error: 'Account has transactions' }, { status: 409 });

  await supabase.from('accounts').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
