'use client';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Transaction, Currency, ExchangeRates } from '@/lib/types';

interface Props {
  transactions: Transaction[];
  currency: Currency;
  rates: ExchangeRates;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: number) => Promise<void>;
}

const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

const TYPE_LABELS: Record<string, string> = {
  buy: '매수', sell: '매도', dividend: '배당', cash: '현금', option: '옵션'
};
const TYPE_COLORS: Record<string, string> = {
  buy: 'var(--green)', sell: 'var(--red)', dividend: '#f59e0b', cash: '#60a5fa', option: '#a78bfa'
};

export default function TransactionHistory({ transactions, currency, rates, onEdit, onDelete }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');

  const fmt = (usd: number) => {
    const v = usd * rates[currency];
    const sym = SYMBOLS[currency];
    if (currency === 'KRW') return `${sym}${Math.round(v).toLocaleString()}`;
    return `${sym}${v.toFixed(2)}`;
  };

  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))].sort();
  const filtered = tickerFilter ? transactions.filter(t => t.ticker === tickerFilter) : transactions;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <select value={tickerFilter} onChange={e => setTickerFilter(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">전체 종목</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {tickerFilter && (
          <button className="btn-secondary btn-sm" onClick={() => setTickerFilter('')}>초기화</button>
        )}
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{filtered.length}건</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>날짜</th><th>계좌</th><th>종목</th><th>유형</th>
              <th style={{ textAlign: 'right' }}>수량</th>
              <th style={{ textAlign: 'right' }}>단가</th>
              <th style={{ textAlign: 'right' }}>총액</th>
              <th style={{ textAlign: 'right' }}>수수료</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(tx => {
              const total = tx.type === 'cash' ? tx.price : tx.quantity * tx.price;
              return (
                <tr key={tx.id}>
                  <td className="muted">{tx.date}</td>
                  <td>{tx.account_name}</td>
                  <td style={{ fontWeight: 500 }}>{tx.ticker || '-'}</td>
                  <td>
                    <span style={{ color: TYPE_COLORS[tx.type] || 'var(--muted)', fontWeight: 500 }}>
                      {TYPE_LABELS[tx.type] || tx.type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{tx.quantity > 0 ? tx.quantity : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{tx.price > 0 ? fmt(tx.price) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                  <td style={{ textAlign: 'right' }} className="muted">{tx.fee > 0 ? fmt(tx.fee) : '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'none', color: 'var(--accent)', padding: 4 }}
                      onClick={() => onEdit(tx)} title="수정"><Pencil size={13} /></button>
                    <button style={{ background: 'none', color: 'var(--red)', padding: 4 }}
                      onClick={() => onDelete(tx.id)} title="삭제"><Trash2 size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>거래 내역 없음</div>
        )}
      </div>
    </div>
  );
}
