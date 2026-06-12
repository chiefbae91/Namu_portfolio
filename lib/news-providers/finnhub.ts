import type { NewsProvider, NormalizedNewsItem } from './types';
import { extractTickers } from './extract-tickers';

interface FinnhubArticle {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number; // unix timestamp
  category: string;
  related?: string;
}

const HIGH_IMPACT_KEYWORDS = [
  'fed', 'federal reserve', 'rate hike', 'rate cut', 'inflation', 'recession',
  'crash', 'collapse', 'surge', 'plunge', 'gdp', 'cpi', 'fomc', 'powell',
  'earnings beat', 'earnings miss', 'bankruptcy', 'merger', 'acquisition',
];

function calcImpactScore(headline: string, summary: string): number {
  const text = `${headline} ${summary}`.toLowerCase();
  const hits = HIGH_IMPACT_KEYWORDS.filter((kw) => text.includes(kw)).length;
  if (hits >= 3) return 9;
  if (hits >= 2) return 7;
  if (hits >= 1) return 5;
  return 3;
}

const isUrl = (s?: string) => !!s && /^https?:\/\/\S+$/.test(s.trim());

export const finnhubProvider: NewsProvider = {
  name: 'finnhub',

  async fetch(limit = 10): Promise<NormalizedNewsItem[]> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) throw new Error('FINNHUB_API_KEY is not set');

    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);

    const articles: FinnhubArticle[] = await res.json();

    return articles
      .filter((a) => {
        if (!a.headline || !a.url) return false;
        const summary = (a.summary ?? '').replace(/\s+/g, ' ').trim();
        if (isUrl(summary) || summary.length < 30) return false;
        // 헤드라인과 거의 동일한 요약 제거 (Finnhub Google RSS 패턴)
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm(summary).startsWith(norm(a.headline).slice(0, 30))) return false;
        return true;
      })
      .slice(0, limit)
      .map((a) => {
        const tickers = a.related
          ? a.related.split(',').map((t) => t.trim()).filter((t) => t.length <= 6)
          : [];

        return {
          title: a.headline,
          summary: a.summary,
          source: a.source,
          published_at: new Date(a.datetime * 1000).toISOString(),
          url: a.url,
          category: 'us_market' as const,
          impact_score: calcImpactScore(a.headline, a.summary),
          keywords: [],
          tickers: tickers.length > 0 ? tickers : extractTickers(a.headline, a.summary),
        };
      });
  },
};
