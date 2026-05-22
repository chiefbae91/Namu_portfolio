'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { HintNotification } from '@/lib/types';

interface Props {
  notifications: HintNotification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onTickerClick?: (ticker: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function AlertBell({ notifications, onMarkAllRead, onDismiss, onTickerClick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="알림"
        style={{
          background: 'none',
          color: unreadCount > 0 ? 'var(--accent)' : 'var(--muted)',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <Bell size={15} fill={unreadCount > 0 ? 'currentColor' : 'none'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: 'var(--red)',
            color: 'white',
            borderRadius: '50%',
            fontSize: 9,
            fontWeight: 700,
            minWidth: 14,
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: '0 2px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 6,
          width: 360,
          maxHeight: 480,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              알림 {unreadCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => { onMarkAllRead(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', background: 'none', padding: '2px 6px' }}
                title="모두 읽음 처리"
              >
                <CheckCheck size={13} /> 모두 읽음
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                알림이 없습니다
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'rgba(99,102,241,0.06)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)', wordBreak: 'break-word' }}>
                      {n.message}
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(n.created_at)}</span>
                      {onTickerClick && (
                        <button
                          onClick={() => { onTickerClick(n.ticker); setOpen(false); }}
                          style={{ fontSize: 10, color: 'var(--accent)', background: 'none', padding: 0, textDecoration: 'underline' }}
                        >
                          {n.ticker} 보기
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDismiss(n.id)}
                    style={{ background: 'none', color: 'var(--muted)', padding: 2, flexShrink: 0, marginTop: 1 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
