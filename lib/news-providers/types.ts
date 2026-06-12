export interface NormalizedNewsItem {
  title: string;
  summary: string;
  source: string;
  published_at: string;
  url: string;
  category: 'us_market' | 'global';
  impact_score: number; // 1-10
  keywords: string[];
  tickers: string[];    // for future stock modal integration
}

export interface NewsProvider {
  name: string;
  fetch(limit?: number): Promise<NormalizedNewsItem[]>;
}
