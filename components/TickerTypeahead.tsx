'use client';
import { useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onBlur?: () => void;
}

export default function TickerTypeahead({ value, onChange, suggestions, placeholder, style, autoFocus, onBlur }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(s =>
    value ? s.toUpperCase().includes(value.toUpperCase()) : true
  );

  const select = (ticker: string) => {
    onChange(ticker);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); setActiveIdx(0); return; }
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && activeIdx < filtered.length) {
        e.preventDefault();
        select(filtered[activeIdx]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => { setOpen(true); setActiveIdx(-1); }}
        onBlur={() => { setTimeout(() => { setOpen(false); setActiveIdx(-1); }, 150); onBlur?.(); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, marginTop: 2, padding: 0, listStyle: 'none',
          maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}>
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              style={{
                padding: '7px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: i === activeIdx ? 'var(--accent)' : 'transparent',
                color: i === activeIdx ? 'white' : 'var(--text)',
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
