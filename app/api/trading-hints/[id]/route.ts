import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const { ticker, hint_date, type, price, current_price, note } = await req.json();
  const { error } = await supabase
    .from('trading_hints')
    .update({ ticker, hint_date, type, price: price ?? null, current_price: current_price ?? null, note: note ?? null })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  await supabase.from('trading_hints').delete().eq('id', params.id);
  return NextResponse.json({ ok: true });
}
