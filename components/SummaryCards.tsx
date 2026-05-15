'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  accountFilter?: string;
  onAccountClick?: (id: string | number, name: string) => void;
}

function fmtUSD(v: number, signed = false) {
  const abs = `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!signed) return abs;
  return v >= 0 ? `+${abs}` : `-${abs}`;
}
function fmtKRW(usd: number, rate: number, signed = false) {
  const abs = `₩${Math.round(Math.abs(usd) * rate).toLocaleString('en-US')}`;
  if (!signed) return abs;
  return usd >= 0 ? `+${abs}` : `-${abs}`;
}
function fmtEUR(usd: number, rate: number, signed = false) {
  const abs = `€${Math.abs(usd * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!signed) return abs;
  return usd >= 0 ? `+${abs}` : `-${abs}`;
}

interface CompactCardProps {
  label: string;
  value: number;
  color: string;
  krwRate: number;
  eurRate: number;
  showKrw: boolean;
  showEur: boolean;
  loading?: boolean;
}

function CompactCard({ label, value, color, krwRate, eurRate, showKrw, showEur, loading }: CompactCardProps) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 }}>
        {loading ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>Loading...</span> : fmtUSD(value)}
      </div>
      {showKrw && !loading && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginTop: 3 }}>
          {fmtKRW(value, krwRate)}
        </div>
      )}
      {showEur && !loading && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399', marginTop: 3 }}>
          {fmtEUR(value, eurRate)}
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
}

function CompactDailyCard({ change, prevClose, krwRate, eurRate, showKrw, showEur, loading }: DailyCardProps) {
  const hasData = !loading && prevClose > 0;
  const isUp = change >= 0;
  const color = hasData ? (isUp ? 'var(--green)' : 'var(--red)') : 'var(--muted)';
  const pct = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Daily P&L</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 }}>
        {loading
          ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>Loading...</span>
          : !hasData
          ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>—</span>
          : <>{fmtUSD(change, true)} <span style={{ fontSize: 14, fontWeight: 600 }}>({isUp ? '+' : ''}{pct.toFixed(2)}%)</span></>
        }
      </div>
      {showKrw && hasData && (
        <div style={{ fontSize: 13, fontWeight: 600, color: isUp ? '#fbbf24' : 'var(--red)', marginTop: 3 }}>
          {fmtKRW(change, krwRate, true)}
        </div>
      )}
      {showEur && hasData && (
        <div style={{ fontSize: 13, fontWeight: 600, color: isUp ? '#34d399' : 'var(--red)', marginTop: 3 }}>
          {fmtEUR(change, eurRate, true)}
        </div>
      )}
    </div>
  );
}

export default function SummaryCards({
  cash, stockValue, prevCloseStockValue, accountBreakdown,
  krwRate, eurRate, showKrw, showEur, loading,
  accountFilter, onAccountClick,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const totalNow = cash + stockValue;
  const totalPrevClose = cash + prevCloseStockValue;
  const dailyChange = totalNow - totalPrevClose;

  const selectedIds: Set<string> = accountFilter
    ? new Set(accountFilter.split(',').map(s => s.trim()))
    : new Set();
  const visibleBreakdown = accountFilter
    ? accountBreakdown.filter(a => selectedIds.has(String(a.account_id)))
    : accountBreakdown;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Top row: 4 cards + toggle button */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 12, alignItems: 'stretch' }}>
        <CompactCard
          label="Total Assets" value={totalNow} color="#e2e8f0"
          krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
        />
        <CompactDailyCard
          change={dailyChange} prevClose={totalPrevClose}
          krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
        />
        <CompactCard
          label="Market Value" value={stockValue} color="#6366f1"
          krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
        />
        <CompactCard
          label="Cash" value={cash} color="#60a5fa"
          krwRate={krwRate} eurRate={eurRate} showKrw={showKrw} showEur={showEur} loading={loading}
        />

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 10px',
            minWidth: 36,
          }}
          title={expanded ? 'Hide account breakdown' : 'Show account breakdown'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded account breakdown */}
      {expanded && (
        <div className="card" style={{ marginTop: 8, padding: '10px 14px' }}>
          {visibleBreakdown.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              No accounts selected
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr repeat(3, 120px)',
                fontSize: 11, color: 'var(--muted)', fontWeight: 600,
                paddingBottom: 6, borderBottom: '1px solid var(--border)', marginBottom: 4,
              }}>
                <span>Account</span>
                <span style={{ textAlign: 'right' }}>Total Assets</span>
                <span style={{ textAlign: 'right' }}>Market Value</span>
                <span style={{ textAlign: 'right' }}>Cash</span>
              </div>

              {visibleBreakdown.map(acc => {
                const total = acc.cash + acc.stock_value;
                return (
                  <div key={acc.account_id} style={{
                    display: 'grid', gridTemplateColumns: '1fr repeat(3, 120px)',
                    fontSize: 13, padding: '5px 0',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      {onAccountClick ? (
                        <button
                          onClick={() => onAccountClick(acc.account_id, acc.account_name)}
                          style={{
                            background: 'none', color: 'var(--accent)', padding: 0,
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            textDecoration: 'underline',
                          }}
                        >
                          {acc.account_name}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{acc.account_name}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>
                      {loading ? '—' : fmtUSD(total)}
                      {showKrw && !loading && (
                        <div style={{ fontSize: 11, color: '#fbbf24' }}>{fmtKRW(total, krwRate)}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {loading ? '—' : fmtUSD(acc.stock_value)}
                      {showKrw && !loading && (
                        <div style={{ fontSize: 11, color: '#fbbf24' }}>{fmtKRW(acc.stock_value, krwRate)}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', color: '#60a5fa' }}>
                      {loading ? '—' : fmtUSD(acc.cash)}
                      {showKrw && !loading && (
                        <div style={{ fontSize: 11, color: '#fbbf24' }}>{fmtKRW(acc.cash, krwRate)}</div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Totals row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr repeat(3, 120px)',
                fontSize: 13, padding: '6px 0 2px',
                fontWeight: 700, color: 'var(--text)',
              }}>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  {loading ? '—' : fmtUSD(totalNow)}
                  {showKrw && !loading && (
                    <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>{fmtKRW(totalNow, krwRate)}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {loading ? '—' : fmtUSD(stockValue)}
                  {showKrw && !loading && (
                    <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>{fmtKRW(stockValue, krwRate)}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', color: '#60a5fa' }}>
                  {loading ? '—' : fmtUSD(cash)}
                  {showKrw && !loading && (
                    <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>{fmtKRW(cash, krwRate)}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
