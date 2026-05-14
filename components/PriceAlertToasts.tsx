'use client';
import { useEffect } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

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

export default function PriceAlertToasts({ alerts, onDismiss }: { alerts: PriceAlert[]; onDismiss: (id: number) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map(a => (
        <AlertToast key={a.id} alert={a} onDismiss={() => onDismiss(a.id)} />
      ))}
    </div>
  );
}
