import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

async function canEdit(supabase: ReturnType<typeof import('@/lib/supabase-admin').getAdminClient>, id: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('trading_hints')
    .select('created_by, can_edit_users')
    .eq('id', id)
    .single();
  if (!data) return false;
  return data.created_by === userId || (Array.isArray(data.can_edit_users) && data.can_edit_users.includes(userId));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  if (!await canEdit(supabase, params.id, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { ticker, hint_date, type, price, current_price, note } = await req.json();
  const { error } = await supabase
    .from('trading_hints')
    .update({ ticker, hint_date, type, price: price ?? null, current_price: current_price ?? null, note: note ?? null })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  if (!await canEdit(supabase, params.id, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await supabase.from('trading_hints').delete().eq('id', params.id);
  return NextResponse.json({ ok: true });
}
