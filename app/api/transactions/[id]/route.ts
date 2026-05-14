import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const id = params.id;
  const { account_id, date, ticker, type, quantity, price, fee, notes } = await req.json();

  const { error } = await supabase
    .from('transactions')
    .update({
      account_id,
      transaction_date: date,
      ticker: ticker || '',
      type,
      quantity: quantity || 0,
      price: price || 0,
      fee: fee || 0,
      note: notes || '',
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: updated } = await supabase.from('transactions').select().eq('id', id).single();
  return NextResponse.json({
    ...updated,
    date: updated?.transaction_date,
    notes: updated?.note,
    currency: 'USD',
    lot_method: null,
    subtype: null,
    dividend_id: null,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  await supabase.from('transactions').delete().eq('id', params.id);
  return NextResponse.json({ ok: true });
}
