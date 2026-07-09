import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const accountIds = searchParams.get('account_ids');

  const { data: accounts } = await supabase.from('accounts').select('id, name, hidden').eq('user_id', user.id);
  // Include all accounts (hidden too) so old imported UUIDs can still resolve
  const nameMap: Record<string, string> = Object.fromEntries((accounts || []).map((a: any) => [a.id, a.name]));

  let query = supabase
    .from('transactions')
    .select('id, account_id, ticker, type, quantity, price, fee, note, transaction_date, created_at, lot_method, subtype, dividend_id')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false });

  if (ticker) {
    const normalizedTicker = ticker.trim().toUpperCase();
    console.log('[Transactions] Exact Match:', normalizedTicker);
    query = query.eq('ticker', normalizedTicker);
  }
  if (accountIds) {
    const ids = accountIds.split(',').filter(Boolean);
    if (ids.length > 0) query = query.in('account_id', ids);
  }

  const { data: txData, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Stable short names for unrecognised UUIDs: sort them, assign "Acct 1", "Acct 2", …
  const unknownIds = [...new Set((txData || []).map((tx: any) => tx.account_id).filter((id: string) => !nameMap[id]))].sort() as string[];
  const acctLabel: Record<string, string> = Object.fromEntries(unknownIds.map((id, i) => [id, `Acct ${i + 1}`]));

  // Specific-lot sells need their saved buy-lot assignments so editing doesn't lose the selection
  const specificSellIds = (txData || [])
    .filter((tx: any) => (tx.type ?? '').toLowerCase() === 'sell' && tx.lot_method === 'specific')
    .map((tx: any) => tx.id);
  const assignmentsBySell: Record<string, { buy_tx_id: string; quantity: number }[]> = {};
  if (specificSellIds.length > 0) {
    const { data: assignRows } = await supabase
      .from('lot_assignments')
      .select('sell_tx_id, buy_tx_id, quantity')
      .eq('user_id', user.id)
      .in('sell_tx_id', specificSellIds);
    for (const row of assignRows || []) {
      (assignmentsBySell[row.sell_tx_id] ??= []).push({ buy_tx_id: row.buy_tx_id, quantity: row.quantity });
    }
  }

  // Dividend rows need their linked reinvest (buy) leg surfaced so the edit form
  // can pre-populate it and the history table can show "Div. Reinvest" on the leg.
  const dividendIds = (txData || [])
    .filter((tx: any) => (tx.type ?? '').toLowerCase() === 'dividend')
    .map((tx: any) => tx.id);
  const reinvestByDividendId: Record<string, { id: string; quantity: number; price: number }> = {};
  if (dividendIds.length > 0) {
    const { data: reinvestRows } = await supabase
      .from('transactions')
      .select('id, quantity, price, dividend_id')
      .eq('user_id', user.id)
      .eq('subtype', 'DIVIDEND_REINVEST')
      .in('dividend_id', dividendIds);
    for (const row of reinvestRows || []) {
      reinvestByDividendId[row.dividend_id] = { id: row.id, quantity: row.quantity, price: row.price };
    }
  }

  const result = (txData || []).map((tx: any) => {
    const reinvest = reinvestByDividendId[tx.id];
    return {
      ...tx,
      date: tx.transaction_date,
      notes: tx.note,
      type: (tx.type ?? '').toLowerCase(),   // normalise 'BUY'→'buy' for client filters
      currency: 'USD',
      lot_method: tx.lot_method ?? null,
      lot_assignments: assignmentsBySell[tx.id] ?? null,
      subtype: tx.subtype ?? null,
      dividend_id: tx.dividend_id ?? null,
      reinvest_id: reinvest?.id ?? null,
      reinvest_qty: reinvest?.quantity ?? null,
      reinvest_price: reinvest?.price ?? null,
      account_name: nameMap[tx.account_id] ?? acctLabel[tx.account_id] ?? '—',
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const body = await req.json();
  const { account_id, date, ticker, type, quantity, price, fee, notes, lot_method, lot_assignments, reinvest, reinvest_qty, reinvest_price } = body;

  if (!account_id || !date || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: newTx, error: txError } = await supabase
    .from('transactions')
    .insert({
      account_id,
      transaction_date: date,
      ticker: ticker || '',
      type,
      quantity: quantity || 0,
      price: price || 0,
      fee: fee || 0,
      note: notes || '',
      user_id: user.id,
      lot_method: type === 'sell' ? (lot_method || null) : null,
    })
    .select()
    .single();

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  if (type === 'sell' && lot_method === 'specific' && Array.isArray(lot_assignments) && lot_assignments.length > 0) {
    const { error: laError } = await supabase.from('lot_assignments').insert(
      lot_assignments.map((a: { buy_tx_id: string; quantity: number }) => ({
        sell_tx_id: newTx.id,
        buy_tx_id: a.buy_tx_id,
        quantity: a.quantity,
        user_id: user.id,
      }))
    );
    if (laError) return NextResponse.json({ error: laError.message }, { status: 500 });
  }

  const tx = { ...newTx, date: newTx.transaction_date, notes: newTx.note, currency: 'USD', lot_assignments: lot_assignments ?? null, subtype: null, dividend_id: null };
  const created = [tx];

  // Auto-create the linked DIVIDEND_REINVEST buy leg
  if (type === 'dividend' && reinvest && reinvest_qty && reinvest_price) {
    const { data: reinvestTx, error: reinvestError } = await supabase
      .from('transactions')
      .insert({
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
        dividend_id: newTx.id,
      })
      .select()
      .single();
    if (reinvestError) return NextResponse.json({ error: reinvestError.message }, { status: 500 });
    created.push({ ...reinvestTx, date: reinvestTx.transaction_date, notes: reinvestTx.note, currency: 'USD', lot_assignments: null });
  }

  return NextResponse.json(created, { status: 201 });
}
