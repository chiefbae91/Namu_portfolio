import type { NewsProvider, NormalizedNewsItem } from './types';
import { extractTickers } from './extract-tickers';

interface MarketauxEntity {
  symbol?: string;
  name?: string;
  sentiment_score?: number;
}

interface MarketauxArticle {
  title: string;
  description?: string;
  snippet?: string;
  url: string;
  published_at: string;
  source: string;
  entities?: MarketauxEntity[];
}

function calcImpactScore(entities: MarketauxEntity[]): number {
  if (!entities.length) return 5;
  const scores = entities
    .map((e) => Math.abs(e.sentiment_score ?? 0))
    .filter((s) => s > 0);
  if (!scores.length) return 5;
  const max = Math.max(...scores);
  if (max >= 0.7) return 9;
  if (max >= 0.5) return 7;
  if (max >= 0.3) return 5;
  return 3;
}

export const marketauxProvider: NewsProvider = {
  name: 'marketaux',

  async fetch(limit = 10): Promise<NormalizedNewsItem[]> {
    const apiKey = process.env.MARKETAUX_API_KEY;
    if (!apiKey) throw new Error('MARKETAUX_API_KEY is not set');

    const params = new URLSearchParams({
      api_token: apiKey,
      language: 'en',
      limit: String(limit),
    });

    const res = await fetch(
      `https://api.marketaux.com/v1/news/all?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) throw new Error(`Marketaux error: ${res.status}`);

    const json = await res.json();
    const articles: MarketauxArticle[] = json.data ?? [];

    const isUrl = (s?: string) => !!s && /^https?:\/\/\S+$/.test(s.trim());

    return articles.filter((a) => {
      const summary = a.description ?? a.snippet ?? '';
      return a.title && !isUrl(summary) && summary.length > 20;
    }).map((a) => {
      const entities = a.entities ?? [];
      const tickers = entities
        .map((e) => e.symbol)
        .filter((s): s is string => !!s && s.length <= 6);
      const keywords = entities
        .map((e) => e.name)
        .filter((n): n is string => !!n)
        .slice(0, 5);

      return {
        title: a.title,
        summary: a.description ?? a.snippet ?? '',
        source: a.source,
        published_at: a.published_at,
        url: a.url,
        category: 'us_market',
        impact_score: calcImpactScore(entities),
        keywords,
        tickers: tickers.length > 0 ? tickers : extractTickers(a.title, a.description ?? a.snippet ?? ''),
      };
    });
  },
};
