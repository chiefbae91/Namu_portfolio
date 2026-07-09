import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const id = params.id;
  const {
    account_id, date, ticker, type, quantity, price, fee, notes, lot_method, lot_assignments,
    reinvest, reinvest_qty, reinvest_price, reinvest_id,
  } = await req.json();

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

  // Sync the linked DIVIDEND_REINVEST buy leg when editing a dividend
  if (type === 'dividend') {
    if (reinvest && reinvest_qty && reinvest_price) {
      if (reinvest_id) {
        await supabase
          .from('transactions')
          .update({ transaction_date: date, ticker: ticker || '', quantity: reinvest_qty, price: reinvest_price })
          .eq('id', reinvest_id)
          .eq('user_id', user.id);
      } else {
        await supabase.from('transactions').insert({
          account_id,
          transaction_date: date,
          ticker: ticker || '',
          type: 'buy',
          quantity: reinvest_qty,
          price: reinvest_price,
          fee: 0,
          note: 'Dividend reinvestment',
          user_id: user.id,
          lot_method: null,
          subtype: 'DIVIDEND_REINVEST',
          dividend_id: id,
        });
      }
    } else if (reinvest_id) {
      await supabase.from('transactions').delete().eq('id', reinvest_id).eq('user_id', user.id);
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

  let reinvestInfo: { reinvest_id: string | null; reinvest_qty: number | null; reinvest_price: number | null } =
    { reinvest_id: null, reinvest_qty: null, reinvest_price: null };
  if (updated.type === 'dividend') {
    const { data: reinvestRow } = await supabase
      .from('transactions')
      .select('id, quantity, price')
      .eq('user_id', user.id)
      .eq('subtype', 'DIVIDEND_REINVEST')
      .eq('dividend_id', id)
      .maybeSingle();
    if (reinvestRow) {
      reinvestInfo = { reinvest_id: reinvestRow.id, reinvest_qty: reinvestRow.quantity, reinvest_price: reinvestRow.price };
    }
  }

  return NextResponse.json({
    ...updated,
    date: updated?.transaction_date,
    notes: updated?.note,
    currency: 'USD',
    lot_assignments: updatedAssignments,
    subtype: updated?.subtype ?? null,
    dividend_id: updated?.dividend_id ?? null,
    ...reinvestInfo,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  // Cascade: deleting a dividend also deletes its linked DIVIDEND_REINVEST buy leg
  await supabase.from('transactions').delete().eq('dividend_id', params.id).eq('subtype', 'DIVIDEND_REINVEST').eq('user_id', user.id);
  await supabase.from('transactions').delete().eq('id', params.id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
