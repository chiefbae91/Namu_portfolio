import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const { searchParams } = new URL(req.url);
  const accountIdsParam = searchParams.get('account_ids');
  const filterIds = accountIdsParam
    ? accountIdsParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
    : [];

  const { data: accounts } = await supabase.from('accounts').select('id, name, hidden');
  const visibleAccounts = (accounts || []).filter((a: any) => !a.hidden);
  const nameMap: Record<number, string> = Object.fromEntries(visibleAccounts.map((a: any) => [a.id, a.name]));
  const visibleIds = visibleAccounts.map((a: any) => a.id);
  const effectiveIds = filterIds.length ? filterIds.filter(id => visibleIds.includes(id)) : visibleIds;

  if (!effectiveIds.length) return NextResponse.json([]);

  const { data, error } = await supabase
    .from('cash_flow')
    .select('id, account_id, type, amount, flow_date')
    .in('account_id', effectiveIds)
    .order('flow_date', { ascending: false })
    .order('id', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data || []).map(r => ({
    ...r,
    date: r.flow_date,
    description: '',
    account_name: nameMap[r.account_id],
  })));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { account_id, date, amount, type } = await req.json();

  if (!account_id || !date || !amount || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('cash_flow')
    .insert({ account_id, flow_date: date, amount, type, user_id: user.id })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
