'use client';
import { AccountBreakdown } from '@/lib/types';

interface Props {
  cash: number;
  stockValue: number;
  accountBreakdown: AccountBreakdown[];
  krwRate: number;
  eurRate: number;
  showKrw: boolean;
  showEur: boolean;
  loading?: boolean;
}

function fmtUSD(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtKRW(usd: number, rate: number) {
  return `₩${Math.round(usd * rate).toLocaleString('en-US')}`;
}
function fmtEUR(usd: number, rate: number) {
  return `€${(usd * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CardProps {
  label: string;
  total: number;
  accounts: { name: string; value: number }[];
  krwRate: number;
  eurRate: number;
  showKrw: boolean;
  showEur: boolean;
  color: string;
  loading?: boolean;
}

function SummaryCard({ label, total, accounts, krwRate, eurRate, showKrw, showEur, color, loading }: CardProps) {
  const hasExtra = showKrw || showEur;

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>

      {/* USD total */}
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2, marginBottom: hasExtra ? 3 : 12 }}>
        {loading ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>로딩중...</span> : fmtUSD(total)}
      </div>

      {/* KRW total */}
      {showKrw && !loading && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>
          {fmtKRW(total, krwRate)}
        </div>
      )}

      {/* EUR total */}
      {showEur && !loading && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399', marginBottom: 2 }}>
          {fmtEUR(total, eurRate)}
        </div>
      )}

      <div style={{ marginBottom: hasExtra ? 8 : 0 }} />

      {/* Per-account list */}
      {accounts.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.map(acc => (
            <div key={acc.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                  {acc.name}
                </span>
                <span style={{ fontWeight: 500, flexShrink: 0 }}>
                  {loading ? '—' : fmtUSD(acc.value)}
                </span>
              </div>
              {showKrw && !loading && (
                <div style={{ textAlign: 'right', fontSize: 11, color: '#fbbf24', marginTop: 1 }}>
                  {fmtKRW(acc.value, krwRate)}
                </div>
              )}
              {showEur && !loading && (
                <div style={{ textAlign: 'right', fontSize: 11, color: '#34d399', marginTop: 1 }}>
                  {fmtEUR(acc.value, eurRate)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SummaryCards({ cash, stockValue, accountBreakdown, krwRate, eurRate, showKrw, showEur, loading }: Props) {
  const cards = [
    {
      label: '현금',
      total: cash,
      accounts: accountBreakdown.map(a => ({ name: a.account_name, value: a.cash })),
      color: '#60a5fa',
    },
    {
      label: '주식 평가금액',
      total: stockValue,
      accounts: accountBreakdown.map(a => ({ name: a.account_name, value: a.stock_value })),
      color: '#6366f1',
    },
    {
      label: '총자산',
      total: cash + stockValue,
      accounts: accountBreakdown.map(a => ({ name: a.account_name, value: a.cash + a.stock_value })),
      color: '#e2e8f0',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {cards.map(card => (
        <SummaryCard
          key={card.label}
          {...card}
          krwRate={krwRate}
          eurRate={eurRate}
          showKrw={showKrw}
          showEur={showEur}
          loading={loading}
        />
      ))}
    </div>
  );
}
