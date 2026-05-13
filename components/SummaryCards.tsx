'use client';
import { useState } from 'react';
import { AccountBreakdown } from '@/lib/types';

interface Props {
  cash: number;
  stockValue: number;
  accountBreakdown: AccountBreakdown[];
  krwRate: number;
  loading?: boolean;
}

function fmtUSD(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtKRW(v: number) {
  return `₩${Math.round(v).toLocaleString('en-US')}`;
}

interface CardProps {
  label: string;
  total: number;
  accounts: { name: string; value: number }[];
  krwRate: number;
  color: string;
  loading?: boolean;
}

function SummaryCard({ label, total, accounts, krwRate, color, loading }: CardProps) {
  const [showKrw, setShowKrw] = useState(false);

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>

      {/* USD total */}
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2, marginBottom: 6 }}>
        {loading
          ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>로딩중...</span>
          : fmtUSD(total)
        }
      </div>

      {/* KRW toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, minHeight: 22 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showKrw}
            onChange={e => setShowKrw(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: '#6366f1' }}
          />
          KRW
        </label>
        {showKrw && !loading && (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>
            {fmtKRW(total * krwRate)}
          </span>
        )}
      </div>

      {/* Per-account list */}
      {accounts.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {accounts.map(acc => (
            <div key={acc.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
                {acc.name}
              </span>
              <span style={{ fontWeight: 500, flexShrink: 0 }}>
                {loading ? '—' : fmtUSD(acc.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SummaryCards({ cash, stockValue, accountBreakdown, krwRate, loading }: Props) {
  const cards: CardProps[] = [
    {
      label: '현금',
      total: cash,
      accounts: accountBreakdown.map(a => ({ name: a.account_name, value: a.cash })),
      color: '#60a5fa',
      krwRate,
      loading,
    },
    {
      label: '주식 평가금액',
      total: stockValue,
      accounts: accountBreakdown.map(a => ({ name: a.account_name, value: a.stock_value })),
      color: '#6366f1',
      krwRate,
      loading,
    },
    {
      label: '총자산',
      total: cash + stockValue,
      accounts: accountBreakdown.map(a => ({ name: a.account_name, value: a.cash + a.stock_value })),
      color: '#e2e8f0',
      krwRate,
      loading,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {cards.map(card => <SummaryCard key={card.label} {...card} />)}
    </div>
  );
}
