'use client';

import React, { useState } from 'react';

interface NewsItem {
  id?: string | number;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  category?: string;
  impact_score: number;
  keywords?: string[];
  url?: string;
}

interface NewsModalProps {
  news: NewsItem;
  onClose: () => void;
}

export function NewsModal({ news, onClose }: NewsModalProps) {
  const [translated, setTranslated] = useState<{ title: string; summary: string } | null>(null);
  const [translating, setTranslating] = useState(false);

  async function translate() {
    if (translated) { setTranslated(null); return; }
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [news.title, news.summary] }),
      });
      const json = await res.json();
      setTranslated({ title: json.translated[0], summary: json.translated[1] });
    } finally {
      setTranslating(false);
    }
  }

  const displayTitle   = translated?.title   ?? news.title;
  const displaySummary = translated?.summary ?? news.summary;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 1001,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'newsSlideUp 0.3s ease',
        }}
      >
        <style>{`
          @keyframes newsSlideUp {
            from { opacity: 0; transform: translate(-50%, -40%); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>

        {/* 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          zIndex: 10,
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>
              {displayTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '0 0 0 8px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {/* 본문 */}
          <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
            {displaySummary}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
            <button
              onClick={translate}
              disabled={translating}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
                color: translated ? 'var(--blue)' : 'var(--text)',
                cursor: 'pointer',
                padding: '5px 14px',
                opacity: translating ? 0.5 : 1,
                fontWeight: 500,
              }}
            >
              {translating ? '번역 중...' : translated ? '원문 보기' : '🌐 한국어 번역'}
            </button>
            {news.url && (
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--text)',
                  padding: '5px 14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                🔗 원본 기사
              </a>
            )}
          </div>

          {/* 메타 정보 */}
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: '1.25rem',
            padding: '10px 12px',
            background: 'var(--bg)',
            borderRadius: 8,
            fontSize: 11,
            color: 'var(--muted)',
          }}>
            <span><span style={{ fontWeight: 600 }}>출처</span> {news.source}</span>
            <span><span style={{ fontWeight: 600 }}>발행일</span> {new Date(news.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span><span style={{ fontWeight: 600 }}>카테고리</span> {news.category === 'global' ? '전세계' : '미국 장'}</span>
            <span style={{
              color: news.impact_score >= 8 ? 'var(--red)' : news.impact_score >= 5 ? '#f59e0b' : 'var(--green)',
              fontWeight: 600,
            }}>
              영향도 {news.impact_score}/10
            </span>
          </div>

          {/* 키워드 */}
          {news.keywords && news.keywords.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🏷️ 관련 키워드
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {news.keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'var(--bg)',
                      color: 'var(--blue)',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
