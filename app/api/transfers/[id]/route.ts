import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { amount, date, type, account_id, notes } = await req.json();
  const supabase = getAdminClient();
  const { error } = await supabase.from('cash_flow')
    .update({ amount, flow_date: date, type, account_id, note: notes || '' })
    .eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  await supabase.from('cash_flow').delete().eq('id', params.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
