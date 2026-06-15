import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { activeProviders } from '@/lib/news-providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();

  // 1. 전체 삭제
  const { error: deleteError } = await supabase
    .from('financial_news')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // 전체 행 삭제

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // 2. 전체 재수집
  const results: Record<string, { inserted: number; error?: string }> = {};

  for (const provider of activeProviders) {
    try {
      const articles = (await provider.fetch(20)).filter((a) => a.impact_score >= 5);
      if (articles.length > 0) {
        const { error } = await supabase.from('financial_news').insert(articles);
        if (error) throw error;
      }
      results[provider.name] = { inserted: articles.length };
    } catch (err) {
      results[provider.name] = {
        inserted: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({ ok: true, cleared: true, results });
}
