import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('financial_news')
    .select('*')
    .not('summary', 'ilike', 'http%')
    .gt('summary', '')
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
