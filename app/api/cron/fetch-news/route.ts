import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { activeProviders } from '@/lib/news-providers';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source'); // 'marketaux' | 'finnhub' | null (= all)
  const providers = source
    ? activeProviders.filter((p) => p.name === source)
    : activeProviders;

  const supabase = getAdminClient();
  const results: Record<string, { inserted: number; error?: string }> = {};

  for (const provider of providers) {
    try {
      const articles = (await provider.fetch(10)).filter((a) => a.impact_score >= 5);

      // Deduplicate against existing URLs in DB
      const { data: existing } = await supabase
        .from('financial_news')
        .select('url, tickers')
        .in('url', articles.map((a) => a.url));

      const existingMap = new Map(
        (existing ?? []).map((r: { url: string; tickers: string[] }) => [r.url, r.tickers])
      );
      const newArticles = articles.filter((a) => !existingMap.has(a.url));
      const tickerUpdates = articles.filter(
        (a) => existingMap.has(a.url) && (existingMap.get(a.url)?.length ?? 0) === 0 && a.tickers.length > 0
      );

      if (newArticles.length > 0) {
        const { error } = await supabase.from('financial_news').insert(newArticles);
        if (error) throw error;
      }

      for (const a of tickerUpdates) {
        await supabase.from('financial_news').update({ tickers: a.tickers }).eq('url', a.url);
      }

      results[provider.name] = { inserted: newArticles.length };
    } catch (err) {
      results[provider.name] = {
        inserted: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 36시간 이전 뉴스 자동 삭제
  const cutoff = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { error: deleteError, count: deletedCount } = await supabase
    .from('financial_news')
    .delete({ count: 'exact' })
    .lt('published_at', cutoff);

  if (deleteError) {
    console.error('오래된 뉴스 삭제 실패:', deleteError.message);
  }

  return NextResponse.json({ ok: true, results, deleted: deletedCount ?? 0 });
}
