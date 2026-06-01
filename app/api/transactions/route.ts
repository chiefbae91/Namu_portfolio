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
    .select('id, account_id, ticker, type, quantity, price, fee, note, transaction_date, created_at')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false });

  if (ticker) query = query.ilike('ticker', ticker);
  if (accountIds) {
    const ids = accountIds.split(',').filter(Boolean);
    if (ids.length > 0) query = query.in('account_id', ids);
  }

  const { data: txData, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Stable short names for unrecognised UUIDs: sort them, assign "Acct 1", "Acct 2", …
  const unknownIds = [...new Set((txData || []).map((tx: any) => tx.account_id).filter((id: string) => !nameMap[id]))].sort() as string[];
  const acctLabel: Record<string, string> = Object.fromEntries(unknownIds.map((id, i) => [id, `Acct ${i + 1}`]));

  const result = (txData || []).map((tx: any) => ({
    ...tx,
    date: tx.transaction_date,
    notes: tx.note,
    type: (tx.type ?? '').toLowerCase(),   // normalise 'BUY'→'buy' for client filters
    currency: 'USD',
    lot_method: null,
    subtype: null,
    dividend_id: null,
    reinvest_id: null,
    reinvest_qty: null,
    reinvest_price: null,
    account_name: nameMap[tx.account_id] ?? acctLabel[tx.account_id] ?? '—',
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const body = await req.json();
  const { account_id, date, ticker, type, quantity, price, fee, notes } = body;

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
    })
    .select()
    .single();

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  const tx = { ...newTx, date: newTx.transaction_date, notes: newTx.note, currency: 'USD', lot_method: null, subtype: null, dividend_id: null };
  return NextResponse.json([tx], { status: 201 });
}
