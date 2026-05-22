import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { hint_id, ticker, hint_type, hint_prices } = await req.json();
  if (!hint_id || !ticker || !hint_type) {
    return NextResponse.json({ error: 'hint_id, ticker, hint_type required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('price_alerts')
    .select('id, active')
    .eq('user_id', user.id)
    .eq('hint_id', String(hint_id))
    .maybeSingle();

  if (existing) {
    const newActive = !existing.active;
    if (newActive) {
      const { count } = await supabase
        .from('price_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('active', true);
      if ((count ?? 0) >= 20) {
        return NextResponse.json({ error: '알림은 최대 20개까지 설정할 수 있습니다.' }, { status: 400 });
      }
    }
    const { error } = await supabase
      .from('price_alerts')
      .update({ active: newActive, ...(newActive ? {} : { triggered: false }) })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ active: newActive });
  }

  const { count: activeCount } = await supabase
    .from('price_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('active', true);
  if ((activeCount ?? 0) >= 20) {
    return NextResponse.json({ error: '알림은 최대 20개까지 설정할 수 있습니다.' }, { status: 400 });
  }

  const { error } = await supabase.from('price_alerts').insert({
    user_id: user.id,
    hint_id: String(hint_id),
    ticker,
    hint_type,
    hint_prices: hint_prices ?? '',
    active: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ active: true });
}
