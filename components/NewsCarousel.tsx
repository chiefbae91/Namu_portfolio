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
      <div
        onClick={() => setSelectedNews(item)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
      >
        {/* 제목 + 배지 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <h3 style={{
            margin: 0,
            flex: 1,
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--blue)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {item.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{
              background: 'var(--blue)',
              color: 'white',
              padding: '2px 7px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              금융
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--bg)',
              border: `1px solid ${impactColor}`,
              color: 'var(--text)',
              padding: '2px 7px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: impactColor, display: 'inline-block', flexShrink: 0 }} />
              중요도 {item.impact_score}
            </span>
          </div>
        </div>

        {/* 요약 */}
        <p style={{
          margin: '0 0 8px',
          fontSize: 12,
          color: 'var(--text)',
          opacity: 0.75,
          lineHeight: 1.6,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {item.summary}
        </p>

        {/* 푸터 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* 왼쪽: 이전/다음 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev - 1 + news.length) % news.length);
              }}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                width: 24,
                height: 24,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 32, textAlign: 'center' }}>
              {currentIndex + 1} / {news.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev + 1) % news.length);
              }}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                width: 24,
                height: 24,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              ›
            </button>
          </div>

          {/* 오른쪽: 티커 링크 + 출처 + 자세히 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onTickerClick && item.tickers && item.tickers.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {item.tickers.slice(0, 4).map((ticker) => (
                  <button
                    key={ticker}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTickerClick(ticker);
                    }}
                    style={{
                      background: 'var(--blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '1px 7px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {ticker}
                  </button>
                ))}
              </div>
            )}
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {item.source} · {new Date(item.published_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>
      </div>

      {selectedNews && (
        <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </>
  );
}
