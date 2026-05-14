'use client';
import { AccountBreakdown } from '@/lib/types';

interface Props {
  cash: number;
  stockValue: number;
  prevCloseStockValue: number;
  accountBreakdown: AccountBreakdown[];
  krwRate: number;
  eurRate: number;
  showKrw: boolean;
  showEur: boolean;
  loading?: boolean;
  onAccountClick?: (id: number, name: string) => void;
}

function fmtUSD(v: number, signed = false) {
  const abs = `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!signed) return abs;
  return v >= 0 ? `+${abs}` : `-${abs}`;
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
  accounts: { id?: number; name: string; value: number }[];
  krwRate: number;
  eurRate: number;
  showKrw: boolean;
  showEur: boolean;
  color: string;
  loading?: boolean;
  onAccountClick?: (id: number, name: string) => void;
}

function SummaryCard({ label, total, accounts, krwRate, eurRate, showKrw, showEur, color, loading, onAccountClick }: CardProps) {
  const hasExtra = showKrw || showEur;

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>

      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2, marginBottom: hasExtra ? 3 : 12 }}>
        {loading ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>Loading...</span> : fmtUSD(total)}
      </div>

      {showKrw && !loading && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>
          {fmtKRW(total, krwRate)}
        </div>
      )}
      {showEur && !loading && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399', marginBottom: 2 }}>
          {fmtEUR(total, eurRate)}
        </div>
      )}

      <div style={{ marginBottom: hasExtra ? 8 : 0 }} />

      {accounts.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.map(acc => (
            <div key={acc.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                {onAccountClick && acc.id != null ? (
                  <button
                    onClick={() => onAccountClick(acc.id!, acc.name)}
                    style={{ background: 'none', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%', padding: 0, textAlign: 'left', cursor: 'pointer', fontSize: 12 }}
                  >
                    {acc.name}
                  </button>
                ) : (
                  <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                    {acc.name}
                  </span>
                )}
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

interface DailyCardProps {
  change: number;
  prevClose: number;
  krwRate: number;
  eurRate: number;
  showKrw: boolean;
  showEur: boolean;
  loading?: boolean;
  accountBreakdown: AccountBreakdown[];
  prevCloseStockValue: number;
}

function DailyPnLCard({ change, prevClose, krwRate, eurRate, showKrw, showEur, loading, accountBreakdown, prevCloseStockValue }: DailyCardProps) {
  const hasData = !loading && prevClose > 0;
  const isUp = change >= 0;
  const color = isUp ? 'var(--green)' : 'var(--red)';
  const pct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const hasExtra = showKrw || showEur;

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Daily P&L</div>

      {/* Main value */}
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2, marginBottom: 3 }}>
        {loading
          ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>Loading...</span>
          : !hasData ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>—</span>
          : fmtUSD(change, true)}
      </div>

      {/* Percentage */}
      {hasData && (
        <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: hasExtra ? 3 : 12 }}>
          {isUp ? '+' : ''}{pct.toFixed(2)}%
        </div>
      )}

      {/* KRW */}
      {showKrw && hasData && (
        <div style={{ fontSize: 13, fontWeight: 600, color: isUp ? '#fbbf24' : 'var(--red)', marginBottom: 2 }}>
          {change >= 0 ? '+' : '-'}{fmtKRW(Math.abs(change), krwRate)}
        </div>
      )}
      {/* EUR */}
      {showEur && hasData && (
        <div style={{ fontSize: 13, fontWeight: 600, color: isUp ? '#34d399' : 'var(--red)', marginBottom: 2 }}>
          {change >= 0 ? '+' : '-'}{fmtEUR(Math.abs(change), eurRate)}
        </div>
      )}

      <div style={{ marginBottom: hasExtra ? 8 : 0 }} />

      {/* Per-account breakdown (proportional) */}
      {hasData && accountBreakdown.length > 0 && prevCloseStockValue > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accountBreakdown.map(acc => {
            const ratio = prevCloseStockValue > 0 ? (acc.stock_value / (acc.stock_value + (prevCloseStockValue - acc.stock_value > 0 ? 0 : 0))) : 0;
            const acctPrevClose = prevCloseStockValue > 0
              ? (acc.stock_value / accountBreakdown.reduce((s, a) => s + a.stock_value, 0)) * prevCloseStockValue
              : 0;
            const acctChange = acc.stock_value - acctPrevClose;
            const acctColor = acctChange >= 0 ? 'var(--green)' : 'var(--red)';
            return (
              <div key={acc.account_name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                    {acc.account_name}
                  </span>
                  <span style={{ fontWeight: 600, color: acctColor, flexShrink: 0 }}>
                    {fmtUSD(acctChange, true)}
                  </span>
                </div>
              </div>
            );
            void ratio;
          })}
        </div>
      )}
    </div>
  );
}

export default function SummaryCards({ cash, stockValue, prevCloseStockValue, accountBreakdown, krwRate, eurRate, showKrw, showEur, loading, onAccountClick }: Props) {
  const totalNow = cash + stockValue;
  const totalPrevClose = cash + prevCloseStockValue;
  const dailyChange = totalNow - totalPrevClose;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
      <SummaryCard
        label="Cash"
        total={cash}
        accounts={accountBreakdown.map(a => ({ name: a.account_name, value: a.cash }))}
        color="#60a5fa"
        krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
      />
      <SummaryCard
        label="Market Value"
        total={stockValue}
        accounts={accountBreakdown.map(a => ({ name: a.account_name, value: a.stock_value }))}
        color="#6366f1"
        krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
      />
      <SummaryCard
        label="Total Assets"
        total={totalNow}
        accounts={accountBreakdown.map(a => ({ id: a.account_id, name: a.account_name, value: a.cash + a.stock_value }))}
        color="#e2e8f0"
        krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
        onAccountClick={onAccountClick}
      />
      <DailyPnLCard
        change={dailyChange}
        prevClose={totalPrevClose}
        krwRate={krwRate}
        eurRate={eurRate}
        showKrw={showKrw}
        showEur={showEur}
        loading={loading}
        accountBreakdown={accountBreakdown}
        prevCloseStockValue={prevCloseStockValue}
      />
    </div>
  );
}
