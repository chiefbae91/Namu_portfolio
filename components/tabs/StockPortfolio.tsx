'use client';
import { PortfolioPosition, Currency, ExchangeRates } from '@/lib/types';

interface Props {
  positions: PortfolioPosition[];
  currency: Currency;
  rates: ExchangeRates;
  onTickerClick: (ticker: string) => void;
}

const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

export default function StockPortfolio({ positions, currency, rates, onTickerClick }: Props) {
  const conv = (usd: number) => usd * rates[currency];
  const fmt = (usd: number) => {
    const v = conv(usd);
    const sym = SYMBOLS[currency];
    if (currency === 'KRW') return `${sym}${Math.round(v).toLocaleString()}`;
    return `${sym}${v.toFixed(2)}`;
  };

  if (positions.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>보유 주식 없음</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>종목</th>
            <th style={{ textAlign: 'right' }}>수량</th>
            <th style={{ textAlign: 'right' }}>평균단가</th>
            <th style={{ textAlign: 'right' }}>현재가</th>
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
              <td style={{ textAlign: 'right' }}>{p.quantity.toLocaleString()}</td>
              <td style={{ textAlign: 'right' }}>{fmt(p.avg_cost)}</td>
              <td style={{ textAlign: 'right' }}>
                {p.current_price > 0 ? fmt(p.current_price) : <span className="muted">-</span>}
              </td>
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
