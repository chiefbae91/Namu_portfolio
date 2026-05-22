'use client';
import { useEffect } from 'react';
import { TrendingUp, TrendingDown, Bell, X } from 'lucide-react';

export interface PriceAlert {
  id: number;
  ticker: string;
  changePct: number;
  direction: 'up' | 'down';
}

function AlertToast({ alert, onDismiss }: { alert: PriceAlert; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isUp = alert.direction === 'up';
  const color = isUp ? 'var(--green)' : 'var(--red)';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${color}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      minWidth: 220,
      animation: 'slideInRight 0.2s ease',
    }}>
      <Icon size={20} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{alert.ticker}</div>
        <div style={{ fontSize: 12, color, marginTop: 2 }}>
          {isUp ? '+' : ''}{alert.changePct.toFixed(2)}% today
        </div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

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

export interface HintToast {
  id: string;
  ticker: string;
  hint_type: string;
  hint_price: number;
  current_price: number;
}

function HintAlertToast({ toast, onDismiss }: { toast: HintToast; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const color = '#f5c518';
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${color}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      minWidth: 220,
      animation: 'slideInRight 0.2s ease',
    }}>
      <Bell size={20} style={{ color, flexShrink: 0 }} fill="currentColor" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{toast.ticker}</div>
        <div style={{ fontSize: 12, color, marginTop: 2 }}>
          {TYPE_LABELS[toast.hint_type] ?? toast.hint_type} {fmt(toast.hint_price)} 아래 도달
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
          현재가 {fmt(toast.current_price)}
        </div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function PriceAlertToasts({
  alerts, onDismiss,
  hintToasts = [], onDismissHint,
}: {
  alerts: PriceAlert[];
  onDismiss: (id: number) => void;
  hintToasts?: HintToast[];
  onDismissHint?: (id: string) => void;
}) {
  if (alerts.length === 0 && hintToasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map(a => (
        <AlertToast key={a.id} alert={a} onDismiss={() => onDismiss(a.id)} />
      ))}
      {hintToasts.map(h => (
        <HintAlertToast key={h.id} toast={h} onDismiss={() => onDismissHint?.(h.id)} />
      ))}
    </div>
  );
}
