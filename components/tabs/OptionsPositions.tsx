'use client';
import { OptionPosition, Currency, ExchangeRates } from '@/lib/types';

interface Props {
  options: OptionPosition[];
  currency: Currency;
  rates: ExchangeRates;
}

const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

export default function OptionsPositions({ options, currency, rates }: Props) {
  const fmt = (usd: number) => {
    const v = usd * rates[currency];
    const sym = SYMBOLS[currency];
    if (currency === 'KRW') return `${sym}${Math.round(v).toLocaleString()}`;
    return `${sym}${v.toFixed(2)}`;
  };

  if (options.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>옵션 포지션 없음</div>;
  }

  const openOptions = options.filter(o => o.open_qty > 0);
  const closedOptions = options.filter(o => o.open_qty <= 0);

  const renderTable = (rows: OptionPosition[], title: string) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>날짜</th><th>계좌</th><th>종목</th><th>유형</th>
              <th>방향</th><th style={{ textAlign: 'right' }}>행사가</th>
              <th>만기</th>
              <th style={{ textAlign: 'right' }}>계약수</th>
              <th style={{ textAlign: 'right' }}>오픈</th>
              <th style={{ textAlign: 'right' }}>프리미엄</th>
              <th style={{ textAlign: 'right' }}>실현P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => (
              <tr key={o.id}>
                <td className="muted">{o.date}</td>
                <td>{o.account_name}</td>
                <td style={{ fontWeight: 600 }}>{o.ticker}</td>
                <td>
                  <span style={{ color: o.option_type === 'call' ? 'var(--green)' : 'var(--color-dividend)', fontWeight: 500 }}>
                    {o.option_type.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span style={{ color: o.action === 'sell' ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                    {o.action === 'sell' ? 'STO' : 'BTO'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{fmt(o.strike)}</td>
                <td>{o.expiry}</td>
                <td style={{ textAlign: 'right' }}>{o.quantity}</td>
                <td style={{ textAlign: 'right' }}>{o.open_qty}</td>
                <td style={{ textAlign: 'right' }}>{fmt(o.premium)}</td>
                <td style={{ textAlign: 'right' }} className={o.realized_pnl >= 0 ? 'positive' : 'negative'}>
                  {o.realized_pnl !== 0 ? fmt(o.realized_pnl) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      {openOptions.length > 0 && renderTable(openOptions, '오픈 포지션')}
      {closedOptions.length > 0 && renderTable(closedOptions, '청산 포지션')}
    </div>
  );
}
