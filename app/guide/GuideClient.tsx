'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

interface TocEntry { level: number; text: string; id: string; }

function buildToc(markdown: string): TocEntry[] {
  const lines = markdown.split('\n');
  const toc: TocEntry[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (!m) continue;
    const text = m[2].replace(/[`*_[\]]/g, '').trim();
    // replicate rehype-slug's id generation
    const id = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    toc.push({ level: m[1].length, text, id });
  }
  return toc;
}

export default function GuideClient({ content }: { content: string }) {
  const [tocOpen, setTocOpen] = useState(false);
  const toc = buildToc(content);

  const tocLinks = (
    <nav>
      {toc.map((entry, i) => (
        <a
          key={i}
          href={`#${entry.id}`}
          onClick={() => setTocOpen(false)}
          style={{
            display: 'block',
            padding: entry.level === 1 ? '5px 0' : entry.level === 2 ? '4px 0 4px 12px' : '3px 0 3px 24px',
            fontSize: entry.level === 1 ? 13 : 12,
            fontWeight: entry.level === 1 ? 700 : entry.level === 2 ? 500 : 400,
            color: entry.level === 1 ? 'var(--text)' : 'var(--muted)',
            textDecoration: 'none',
            borderLeft: entry.level >= 2 ? '2px solid var(--border)' : 'none',
            marginLeft: entry.level >= 2 ? 0 : 0,
            lineHeight: 1.5,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = entry.level === 1 ? 'var(--text)' : 'var(--muted)')}
        >
          {entry.text}
        </a>
      ))}
    </nav>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={15} /> Back to App
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>Namu Portfolio — 사용자 가이드</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Sidebar TOC — desktop */}
        <aside style={{
          width: 220, flexShrink: 0, position: 'sticky', top: 24,
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 16px',
        }} className="guide-sidebar">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
            목차
          </div>
          {tocLinks}
        </aside>

        {/* Mobile TOC toggle */}
        <div className="guide-mobile-toc" style={{ display: 'none', width: '100%' }}>
          <button
            onClick={() => setTocOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 14px', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              marginBottom: tocOpen ? 0 : 20,
            }}
          >
            목차 {tocOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {tocOpen && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 16px', marginBottom: 20 }}>
              {tocLinks}
            </div>
          )}
        </div>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div className="guide-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={{
                h1: ({ children, ...props }) => (
                  <h1 {...props} style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', margin: '32px 0 12px', paddingBottom: 8, borderBottom: '2px solid var(--border)', lineHeight: 1.3 }}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 {...props} style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '28px 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 {...props} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '20px 0 8px' }}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p style={{ margin: '0 0 12px', lineHeight: 1.75, fontSize: 14, color: 'var(--text)' }}>{children}</p>
                ),
                a: ({ children, href }) => (
                  <a href={href} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{children}</a>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.75, fontSize: 14 }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.75, fontSize: 14 }}>{children}</ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: 4, color: 'var(--text)' }}>{children}</li>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ background: 'var(--surface)' }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(42,45,58,0.5)', color: 'var(--text)', verticalAlign: 'top' }}>
                    {children}
                  </td>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{ margin: '12px 0', padding: '10px 16px', borderLeft: '3px solid var(--accent)', background: 'rgba(99,102,241,0.08)', borderRadius: '0 6px 6px 0', fontSize: 13, color: 'var(--muted)' }}>
                    {children}
                  </blockquote>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.startsWith('language-');
                  return isBlock ? (
                    <code style={{ display: 'block', background: '#0d1117', color: '#e6edf3', padding: '14px 16px', borderRadius: 8, fontSize: 13, overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6, marginBottom: 12 }}>
                      {children}
                    </code>
                  ) : (
                    <code style={{ background: 'rgba(99,102,241,0.15)', color: '#a78bfa', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'monospace' }}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <pre style={{ margin: '0 0 12px' }}>{children}</pre>,
                hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />,
                strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text)' }}>{children}</strong>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .guide-sidebar { display: none !important; }
          .guide-mobile-toc { display: block !important; }
        }
        .guide-content h1:first-child { margin-top: 0; }
        .guide-sidebar::-webkit-scrollbar { width: 4px; }
        .guide-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>
    </div>
  );
}
