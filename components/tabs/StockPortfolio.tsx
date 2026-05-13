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
    <span style={{ marginLeft: 3, fontSize: 9, color: active ? 'var(--accent)' : '#334155' }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  );
}

function PriceChange({ current, prev }: { current: number; prev: number }) {
  if (!current || !prev) return null;
  const diff = current - prev;
  const pct = (diff / prev) * 100;
  if (Math.abs(diff) < 0.001) return <div style={{ fontSize: 11, color: '#666' }}>→ 0.00 (0.00%)</div>;
  const up = diff > 0;
  const color = up ? '#00e676' : '#ff5252';
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
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>보유 주식 없음</div>;
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
            <th {...th('ticker', 'left')}>종목 <SortIndicator active={sortKey === 'ticker'} dir={sortDir} /></th>
            <th {...thStatic()}>현재가</th>
            <th {...thStatic()}>수량</th>
            <th {...thStatic()}>평균단가</th>
            <th {...th('value')}>평가금액 <SortIndicator active={sortKey === 'value'} dir={sortDir} /></th>
            <th {...th('cost')}>코스트 <SortIndicator active={sortKey === 'cost'} dir={sortDir} /></th>
            <th {...th('weight')}>비중 <SortIndicator active={sortKey === 'weight'} dir={sortDir} /></th>
            <th {...th('return_amount')}>손익 <SortIndicator active={sortKey === 'return_amount'} dir={sortDir} /></th>
            <th {...th('return_pct')}>수익률 <SortIndicator active={sortKey === 'return_pct'} dir={sortDir} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const hasPrice = p.current_price > 0;
            const weight = hasPrice && totalValue > 0 ? (p.value / totalValue) * 100 : 0;
            const barPct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
            return (
              <tr key={p.ticker}>
                <td>
                  <button
                    onClick={() => onTickerClick(p.ticker)}
                    style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 14, padding: 0, textDecoration: 'underline' }}
                  >
                    {p.ticker}
                  </button>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {hasPrice ? (
                    <>
                      <div>{fmt(p.current_price)}</div>
                      <PriceChange current={p.current_price} prev={p.prev_close} />
                    </>
                  ) : <span className="muted">-</span>}
                </td>
                <td style={{ textAlign: 'right' }}>{p.quantity.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{fmt(p.avg_cost)}</td>
                <td style={{ textAlign: 'right' }}>{hasPrice ? fmt(p.value) : <span className="muted">-</span>}</td>
                <td style={{ textAlign: 'right' }}>{fmt(p.cost)}</td>
                <td style={{ textAlign: 'right' }}>
                  {hasPrice && totalValue > 0 ? `${weight.toFixed(1)}%` : <span className="muted">-</span>}
                </td>
                <td style={{ textAlign: 'right' }} className={hasPrice ? (p.return_amount >= 0 ? 'positive' : 'negative') : ''}>
                  {hasPrice ? `${p.return_amount >= 0 ? '+' : ''}${fmt(p.return_amount)}` : <span className="muted">-</span>}
                </td>
                <td style={{ textAlign: 'right' }} className={hasPrice ? (p.return_pct >= 0 ? 'positive' : 'negative') : ''}>
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
