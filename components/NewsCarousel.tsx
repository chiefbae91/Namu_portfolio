'use client';

import React, { useState, useEffect } from 'react';
import { NewsModal } from './NewsModal';

interface NewsItem {
  id?: string | number;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  category?: string;
  impact_score: number;
  keywords?: string[];
  tickers?: string[];
  url?: string;
}

interface NewsCarouselProps {
  onTickerClick?: (ticker: string) => void;
}

export function NewsCarousel({ onTickerClick }: NewsCarouselProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestNews();
  }, []);

  async function fetchLatestNews() {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('뉴스 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  // 자동 순환 (5초마다)
  useEffect(() => {
    if (news.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % news.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [news.length]);

  if (loading || news.length === 0) return null;

  const item = news[currentIndex];

  const impactColor =
    item.impact_score >= 8 ? 'var(--red)' :
    item.impact_score >= 5 ? '#f59e0b' :
    'var(--green)';

  const impactLabel =
    item.impact_score >= 8 ? '高' :
    item.impact_score >= 5 ? '中' : '低';

  return (
    <>
      {/* 풀너비 배너 */}
      <div style={{ position: 'relative', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {/* 왼쪽 화살표 */}
        <button
          onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + news.length) % news.length); }}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 36, background: 'none', border: 'none',
            color: 'var(--muted)', cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >
          ‹
        </button>

        {/* 콘텐츠 (양쪽 화살표 공간 확보) */}
        <div
          onClick={() => setSelectedNews(item)}
          style={{ padding: '10px 44px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            {/* 제목 */}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
              {item.title}
            </span>

            {/* 티커 + 중요도 + 카운터 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {onTickerClick && item.tickers && item.tickers.slice(0, 3).map((ticker) => (
                <button key={ticker} onClick={(e) => { e.stopPropagation(); onTickerClick(ticker); }}
                  style={{ background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ${ticker}
                </button>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: `1px solid ${impactColor}`, color: 'var(--text)', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: impactColor, display: 'inline-block', flexShrink: 0 }} />
                중요도 {item.impact_score}
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽 화살표 */}
        <button
          onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % news.length); }}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 36, background: 'none', border: 'none',
            color: 'var(--muted)', cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >
          ›
        </button>
      </div>

      {selectedNews && (
        <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </>
  );
}
