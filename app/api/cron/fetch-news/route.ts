import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { activeProviders } from '@/lib/news-providers';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request) {
  // Protect endpoint with CRON_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  const results: Record<string, { inserted: number; error?: string }> = {};

  for (const provider of activeProviders) {
    try {
      const articles = await provider.fetch(10);

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

  return NextResponse.json({ ok: true, results });
}
