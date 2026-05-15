'use client';
import { useState } from 'react';
import { PortfolioPosition, Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface Props {
  positions: PortfolioPosition[];
  currency: Currency;
  rates: ExchangeRates;
  onTickerClick: (ticker: string) => void;
}

type SortKey = 'ticker' | 'value' | 'cost' | 'weight' | 'return_amount' | 'return_pct';
type SortDir = 'asc' | 'desc';

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: 3, fontSize: 9, color: active ? 'var(--accent)' : 'var(--muted)' }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  );
}

const QUOTE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  ETF:            { label: 'ETF',    color: '#6366f1' },
  MUTUALFUND:     { label: 'MF',     color: '#8b5cf6' },
  CRYPTOCURRENCY: { label: 'CRYPTO', color: '#f97316' },
  INDEX:          { label: 'INDEX',  color: '#64748b' },
  FUTURE:         { label: 'FUT',    color: '#06b6d4' },
  OPTION:         { label: 'OPT',    color: '#ef4444' },
};

const LEVERAGE_BADGE: Record<string, { label: string; color: string }> = {
  '3x':  { label: '3X',   color: '#ef4444' },
  '2x':  { label: '2X',   color: '#f97316' },
  '-2x': { label: '-2X',  color: '#a855f7' },
  '-3x': { label: '-3X',  color: '#ec4899' },
  'inv': { label: 'INV',  color: '#8b5cf6' },
};

function Badge({ label, color, ml = 5 }: { label: string; color: string; ml?: number }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
      background: color, color: 'white', letterSpacing: '0.04em',
      marginLeft: ml, verticalAlign: 'middle',
    }}>
      {label}
    </span>
  );
}

function MoveBadge({ current, prev }: { current: number; prev: number }) {
  if (!current || !prev) return null;
  const pct = (current - prev) / prev * 100;
  if (pct >= 5) return <span style={{ fontSize: 16 }}>🔥</span>;
  if (pct <= -5) return <span style={{ fontSize: 16 }}>⚠️</span>;
  return null;
}

function QuoteTypeBadge({ quoteType, leverage }: { quoteType?: string; leverage?: string }) {
  if (!quoteType || quoteType === 'EQUITY') return null;
  const badge = QUOTE_TYPE_BADGE[quoteType];
  if (!badge) return null;
  const lvBadge = leverage ? LEVERAGE_BADGE[leverage] : null;
  return (
    <>
      <Badge label={badge.label} color={badge.color} ml={5} />
      {lvBadge && <Badge label={lvBadge.label} color={lvBadge.color} ml={3} />}
    </>
  );
}

function PriceChange({ current, prev }: { current: number; prev: number }) {
  if (!current || !prev) return null;
  const diff = current - prev;
  const pct = (diff / prev) * 100;
  if (Math.abs(diff) < 0.001) return <div style={{ fontSize: 11, color: 'var(--muted)' }}>→ 0.00 (0.00%)</div>;
  const up = diff > 0;
  const color = up ? 'var(--color-price-up)' : 'var(--color-price-down)';
  return (
    <div style={{ fontSize: 11, color, marginTop: 2 }}>
      {up ? '▲' : '▼'} {up ? '+' : ''}${Math.abs(diff).toFixed(2)} ({up ? '+' : ''}{pct.toFixed(2)}%)
    </div>
  );
}

export default function StockPortfolio({ positions, currency, rates, onTickerClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fmt = (usd: number) => formatCurrency(usd, currency, rates);

  if (positions.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No positions</div>;
  }

  const totalValue = positions
    .filter(p => p.current_price > 0)
    .reduce((s, p) => s + p.value, 0);

  const maxWeight = totalValue > 0
    ? Math.max(...positions.filter(p => p.current_price > 0).map(p => p.value / totalValue * 100))
    : 100;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const sorted = [...positions].sort((a, b) => {
    if (sortKey === 'ticker') {
      const cmp = a.ticker.localeCompare(b.ticker);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const valueOf = (p: PortfolioPosition): number => {
      if (p.current_price === 0 && sortKey !== 'cost') return -Infinity;
      switch (sortKey) {
        case 'value':         return p.value;
        case 'cost':          return p.cost;
        case 'weight':        return p.value;
        case 'return_amount': return p.return_amount;
        case 'return_pct':    return p.return_pct;
        default: return 0;
      }
    };
    const diff = valueOf(a) - valueOf(b);
    return sortDir === 'asc' ? diff : -diff;
  });

  const th = (key: SortKey, align: 'left' | 'right' = 'right') => ({
    style: {
      textAlign: align as 'left' | 'right',
      cursor: 'pointer' as const,
      userSelect: 'none' as const,
      color: sortKey === key ? 'var(--text)' : undefined,
    },
    onClick: () => handleSort(key),
  });

  const thStatic = (align: 'left' | 'right' = 'right') => ({
    style: { textAlign: align as 'left' | 'right' },
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th className="col-hide-mobile" style={{ width: 1, whiteSpace: 'nowrap', padding: '0 4px' }}></th>
            <th {...th('ticker', 'left')}>Symbol <SortIndicator active={sortKey === 'ticker'} dir={sortDir} /></th>
            <th {...thStatic()}>Price</th>
            <th {...thStatic()}>Shares</th>
            <th className="col-hide-mobile" {...thStatic()}>Avg Cost</th>
            <th {...th('value')}>Mkt Value <SortIndicator active={sortKey === 'value'} dir={sortDir} /></th>
            <th className="col-hide-mobile" {...th('cost')}>Cost Basis <SortIndicator active={sortKey === 'cost'} dir={sortDir} /></th>
            <th className="col-hide-mobile" {...th('weight')}>Weight <SortIndicator active={sortKey === 'weight'} dir={sortDir} /></th>
            <th className="col-hide-mobile" {...th('return_amount')}>P&amp;L <SortIndicator active={sortKey === 'return_amount'} dir={sortDir} /></th>
            <th className="col-hide-mobile" {...th('return_pct')}>Return% <SortIndicator active={sortKey === 'return_pct'} dir={sortDir} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const hasPrice = p.current_price > 0;
            const weight = hasPrice && totalValue > 0 ? (p.value / totalValue) * 100 : 0;
            const barPct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
            return (
              <tr key={p.ticker}>
                <td className="col-hide-mobile" style={{ textAlign: 'center', width: 1, whiteSpace: 'nowrap', padding: '0 4px' }}>
                  <MoveBadge current={p.current_price} prev={p.prev_close} />
                </td>
                <td>
                  <button
                    onClick={() => onTickerClick(p.ticker)}
                    style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 14, padding: 0, textDecoration: 'underline' }}
                  >
                    {p.ticker}
                  </button>
                  <span className="col-hide-mobile">
                    <QuoteTypeBadge quoteType={p.quote_type} leverage={p.leverage} />
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {hasPrice ? (
                    <>
                      <div>{fmt(p.current_price)}</div>
                      <div className="col-hide-mobile">
                        <PriceChange current={p.current_price} prev={p.prev_close} />
                      </div>
                    </>
                  ) : <span className="muted">-</span>}
                </td>
                <td style={{ textAlign: 'right' }}>{p.quantity.toLocaleString()}</td>
                <td className="col-hide-mobile" style={{ textAlign: 'right' }}>{fmt(p.avg_cost)}</td>
                <td style={{ textAlign: 'right' }}>{hasPrice ? fmt(p.value) : <span className="muted">-</span>}</td>
                <td className="col-hide-mobile" style={{ textAlign: 'right' }}>{fmt(p.cost)}</td>
                <td className="col-hide-mobile" style={{ textAlign: 'right' }}>
                  {hasPrice && totalValue > 0 ? `${weight.toFixed(1)}%` : <span className="muted">-</span>}
                </td>
                <td className={`col-hide-mobile${hasPrice ? (p.return_amount >= 0 ? ' positive' : ' negative') : ''}`} style={{ textAlign: 'right' }}>
                  {hasPrice ? `${p.return_amount >= 0 ? '+' : ''}${fmt(p.return_amount)}` : <span className="muted">-</span>}
                </td>
                <td className={`col-hide-mobile${hasPrice ? (p.return_pct >= 0 ? ' positive' : ' negative') : ''}`} style={{ textAlign: 'right' }}>
                  {hasPrice ? `${p.return_pct >= 0 ? '+' : ''}${p.return_pct.toFixed(2)}%` : <span className="muted">-</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
