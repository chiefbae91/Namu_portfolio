import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { data, count } = await supabase
    .from('financial_news')
    .select('title, summary, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ total: count, articles: data });
}
