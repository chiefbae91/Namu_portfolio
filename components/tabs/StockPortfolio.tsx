'use client';
import { PortfolioPosition, Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface Props {
  positions: PortfolioPosition[];
  currency: Currency;
  rates: ExchangeRates;
  onTickerClick: (ticker: string) => void;
}

function PriceChange({ current, prev }: { current: number; prev: number }) {
  if (!current || !prev) return null;
  const diff = current - prev;
  const pct = (diff / prev) * 100;

  if (Math.abs(diff) < 0.001) {
    return <div style={{ fontSize: 11, color: '#666' }}>→ 0.00 (0.00%)</div>;
  }
  const up = diff > 0;
  const color = up ? '#ff5252' : '#40c4ff';
  const arrow = up ? '▲' : '▼';
  const sign = up ? '+' : '';
  return (
    <div style={{ fontSize: 11, color, marginTop: 2 }}>
      {arrow} {sign}${Math.abs(diff).toFixed(2)} ({sign}{pct.toFixed(2)}%)
    </div>
  );
}

export default function StockPortfolio({ positions, currency, rates, onTickerClick }: Props) {
  const fmt = (usd: number) => formatCurrency(usd, currency, rates);

  if (positions.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>보유 주식 없음</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>종목</th>
            <th style={{ textAlign: 'right' }}>현재가</th>
            <th style={{ textAlign: 'right' }}>수량</th>
            <th style={{ textAlign: 'right' }}>평균단가</th>
            <th style={{ textAlign: 'right' }}>평가금액</th>
            <th style={{ textAlign: 'right' }}>코스트</th>
            <th style={{ textAlign: 'right' }}>손익</th>
            <th style={{ textAlign: 'right' }}>수익률</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
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
                {p.current_price > 0 ? (
                  <>
                    <div>{fmt(p.current_price)}</div>
                    <PriceChange current={p.current_price} prev={p.prev_close} />
                  </>
                ) : <span className="muted">-</span>}
              </td>
              <td style={{ textAlign: 'right' }}>{p.quantity.toLocaleString()}</td>
              <td style={{ textAlign: 'right' }}>{fmt(p.avg_cost)}</td>
              <td style={{ textAlign: 'right' }}>{p.current_price > 0 ? fmt(p.value) : '-'}</td>
              <td style={{ textAlign: 'right' }}>{fmt(p.cost)}</td>
              <td style={{ textAlign: 'right' }} className={p.return_amount >= 0 ? 'positive' : 'negative'}>
                {p.current_price > 0 ? fmt(p.return_amount) : '-'}
              </td>
              <td style={{ textAlign: 'right' }} className={p.return_pct >= 0 ? 'positive' : 'negative'}>
                {p.current_price > 0 ? `${p.return_pct >= 0 ? '+' : ''}${p.return_pct.toFixed(2)}%` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
