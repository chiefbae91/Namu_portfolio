'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X, CheckCheck } from 'lucide-react';
import { HintAlert, HintNotification } from '@/lib/types';

const TYPE_LABELS: Record<string, string> = {
  resistance:      '벽',
  support:         '지지',
  supply_level:    '매물대',
  faded_supply:    '흐린 매물대',
  last_buy_zone:   '마지막 매물대',
  short_target:    '단기 목표',
  long_target:     '장기 목표',
  buy_stop:        '매수 중지',
  trailing_supply: '추격 매물대',
  accumulation:    '매집 자리',
};

interface Props {
  alerts: HintAlert[];
  notifications: HintNotification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onDeactivateAlert: (alertId: string) => void;
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

function fmtPrice(raw: string): string {
  return raw.trim().split(/[\s,]+/)
    .map(s => { const n = parseFloat(s); return isNaN(n) ? null : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; })
    .filter(Boolean).join(' / ');
}

export default function AlertBell({ alerts, notifications, onMarkAllRead, onDismiss, onDeactivateAlert, onTickerClick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeAlerts = alerts.filter(a => a.active);
  const unreadCount = notifications.filter(n => !n.read).length;
  const badgeCount = unreadCount;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasContent = activeAlerts.length > 0 || notifications.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="가격 알림"
        style={{
          background: 'none',
          color: badgeCount > 0 ? 'var(--accent)' : activeAlerts.length > 0 ? 'var(--text)' : 'var(--muted)',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <Bell size={15} fill={unreadCount > 0 ? 'currentColor' : 'none'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: 'var(--red)', color: 'white',
            borderRadius: '50%', fontSize: 9, fontWeight: 700,
            minWidth: 14, height: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: '0 2px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 360, maxHeight: 520,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 2000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>가격 알림</span>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', background: 'none', padding: '2px 6px' }}
              >
                <CheckCheck size={13} /> 모두 읽음
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Triggered notifications */}
            {notifications.length > 0 && (
              <>
                <div style={{ padding: '7px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  알림 발생
                </div>
                {notifications.map(n => (
                  <div key={n.id} style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'rgba(99,102,241,0.06)',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
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
                    <button onClick={() => onDismiss(n.id)} style={{ background: 'none', color: 'var(--muted)', padding: 2, flexShrink: 0, marginTop: 1 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Active (pending) alerts */}
            {activeAlerts.length > 0 && (
              <>
                <div style={{ padding: '7px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  모니터링 중 ({activeAlerts.length})
                </div>
                {activeAlerts.map(a => (
                  <div key={a.id} style={{
                    padding: '9px 14px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <Bell size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} fill="currentColor" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {onTickerClick
                          ? <button onClick={() => { onTickerClick(a.ticker); setOpen(false); }} style={{ background: 'none', color: 'var(--accent)', padding: 0, textDecoration: 'underline', fontSize: 12, fontWeight: 600 }}>{a.ticker}</button>
                          : a.ticker
                        }
                        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                          {TYPE_LABELS[a.hint_type] ?? a.hint_type}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {fmtPrice(a.hint_prices)} 아래로 내려오면 알림
                      </div>
                    </div>
                    <button
                      onClick={() => onDeactivateAlert(a.id)}
                      title="알림 해제"
                      style={{ background: 'none', color: 'var(--muted)', padding: 2, flexShrink: 0 }}
                    >
                      <BellOff size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {!hasContent && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <Bell size={24} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                설정된 알림이 없습니다
                <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                  Trading Hint 탭에서 🔔 클릭하여 알림 설정
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
