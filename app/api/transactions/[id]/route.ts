import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const id = params.id;
  const { account_id, date, ticker, type, quantity, price, fee, notes, lot_method, lot_assignments } = await req.json();

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
      lot_method: type === 'sell' ? (lot_method || null) : null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reconcile stored lot assignments with the new type/method. If the sell keeps the
  // 'specific' method but no new selection was sent (the edit form doesn't show the
  // lot picker), leave the previously saved assignments untouched.
  if (type !== 'sell' || lot_method !== 'specific') {
    await supabase.from('lot_assignments').delete().eq('sell_tx_id', id).eq('user_id', user.id);
  } else if (Array.isArray(lot_assignments)) {
    await supabase.from('lot_assignments').delete().eq('sell_tx_id', id).eq('user_id', user.id);
    if (lot_assignments.length > 0) {
      const { error: laError } = await supabase.from('lot_assignments').insert(
        lot_assignments.map((a: { buy_tx_id: string; quantity: number }) => ({
          sell_tx_id: id,
          buy_tx_id: a.buy_tx_id,
          quantity: a.quantity,
          user_id: user.id,
        }))
      );
      if (laError) return NextResponse.json({ error: laError.message }, { status: 500 });
    }
  }

  const { data: updated } = await supabase.from('transactions').select().eq('id', id).eq('user_id', user.id).single();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let updatedAssignments: { buy_tx_id: string; quantity: number }[] | null = null;
  if (updated.lot_method === 'specific') {
    const { data: assignRows } = await supabase
      .from('lot_assignments')
      .select('buy_tx_id, quantity')
      .eq('sell_tx_id', id)
      .eq('user_id', user.id);
    updatedAssignments = assignRows ?? [];
  }

  return NextResponse.json({
    ...updated,
    date: updated?.transaction_date,
    notes: updated?.note,
    currency: 'USD',
    lot_assignments: updatedAssignments,
    subtype: null,
    dividend_id: null,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  await supabase.from('transactions').delete().eq('id', params.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
