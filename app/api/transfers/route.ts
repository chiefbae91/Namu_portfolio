import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { data: accounts } = await supabase.from('accounts').select('id, name, hidden').eq('user_id', user.id);
  const nameMap: Record<string, string> = Object.fromEntries((accounts || []).map((a: any) => [a.id, a.name]));

  const { data, error } = await supabase
    .from('cash_flow')
    .select('id, account_id, type, amount, flow_date, note')
    .eq('user_id', user.id)
    .order('flow_date', { ascending: false })
    .order('id', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unknownCfIds = [...new Set((data || []).map((r: any) => r.account_id).filter((id: string) => !nameMap[id]))].sort() as string[];
  const cfAcctLabel: Record<string, string> = Object.fromEntries(unknownCfIds.map((id, i) => [id, `Acct ${i + 1}`]));

  return NextResponse.json((data || []).map(r => ({
    ...r,
    date: r.flow_date,
    note: r.note ?? '',
    account_name: nameMap[r.account_id] ?? cfAcctLabel[r.account_id] ?? '—',
  })));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { account_id, date, amount, type, notes } = await req.json();

  if (!account_id || !date || !amount || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('cash_flow')
    .insert({ account_id, flow_date: date, amount, type, note: notes || '', user_id: user.id })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
