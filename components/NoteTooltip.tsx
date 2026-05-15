'use client';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function NoteTooltip({ note }: { note: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const onEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setAnchor(e.currentTarget.getBoundingClientRect());
  }, []);
  const onLeave = useCallback(() => setAnchor(null), []);

  const tipLeft = anchor ? Math.min(anchor.left, window.innerWidth - 316) : 0;
  const tipTop  = anchor ? anchor.bottom + 6 : 0;

  return (
    <>
      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12, cursor: 'default' }}
      >
        {note}
      </div>
      {anchor && createPortal(
        <div style={{
          position: 'fixed', top: tipTop, left: Math.max(8, tipLeft), zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '8px 10px', maxWidth: 300,
          fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'none',
        }}>
          {note}
        </div>,
        document.body
      )}
    </>
  );
}
