import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

function parseHintPrice(raw: unknown): number[] | null {
  if (raw == null || raw === '') return null;
  const nums = String(raw).trim().split(/[\s,]+/)
    .map(s => parseFloat(s.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);
  return nums.length > 0 ? nums : null;
}

export async function GET() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('trading_hints')
    .select('*')
    .eq('is_public', true)
    .order('hint_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();
  const { ticker, hint_date, type, price, current_price, note } = await req.json();
  if (!ticker || !hint_date || !type) {
    return NextResponse.json({ error: 'ticker, hint_date, type required' }, { status: 400 });
  }
  const parsedPrice = parseHintPrice(price);
  const { data, error } = await supabase
    .from('trading_hints')
    .insert({
      ticker, hint_date, type,
      price: parsedPrice,
      current_price: current_price ?? null,
      note: note ?? null,
      created_by: user.id,
      is_public: true,
      can_edit_users: [],
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
