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
  onDeleteMany: (ids: number[]) => Promise<void>;
}

const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };
const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', dividend: '배당', cash: '현금' };
const TYPE_COLORS: Record<string, string> = { buy: 'var(--green)', sell: 'var(--red)', dividend: '#f59e0b', cash: '#60a5fa' };

interface ConfirmModalProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ count, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 360, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>거래 {count}건 삭제</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
          선택한 거래 내역을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={onCancel}>취소</button>
          <button className="btn-danger" onClick={onConfirm}>삭제</button>
        </div>
      </div>
    </div>
  );
}

export default function TransactionHistory({ transactions, currency, rates, onEdit, onDelete, onDeleteMany }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fmt = (usd: number) => {
    const v = usd * rates[currency];
    const sym = SYMBOLS[currency];
    if (currency === 'KRW') return `${sym}${Math.round(v).toLocaleString()}`;
    return `${sym}${v.toFixed(2)}`;
  };

  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))].sort();
  const filtered = tickerFilter ? transactions.filter(t => t.ticker === tickerFilter) : transactions;
  const filteredIds = filtered.map(t => t.id);

  const allChecked = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someChecked = filteredIds.some(id => selected.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected(prev => { const s = new Set(prev); filteredIds.forEach(id => s.delete(id)); return s; });
    } else {
      setSelected(prev => new Set([...prev, ...filteredIds]));
    }
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = [...selected].filter(id => filteredIds.includes(id));
    await onDeleteMany(ids);
    setSelected(new Set());
    setConfirmOpen(false);
  };

  const handleDeleteOne = async (id: number) => {
    await onDelete(id);
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const selectedCount = [...selected].filter(id => filteredIds.includes(id)).length;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={tickerFilter} onChange={e => { setTickerFilter(e.target.value); setSelected(new Set()); }} style={{ minWidth: 140 }}>
          <option value="">전체 종목</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {tickerFilter && (
          <button className="btn-secondary btn-sm" onClick={() => { setTickerFilter(''); setSelected(new Set()); }}>초기화</button>
        )}

        <span className="muted" style={{ fontSize: 12 }}>{filtered.length}건</span>

        {selectedCount > 0 && (
          <>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              {selectedCount}건 선택됨
            </span>
            <button
              className="btn-danger btn-sm"
              onClick={() => setConfirmOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Trash2 size={13} /> 선택 삭제
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
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
              const isSelected = selected.has(tx.id);
              return (
                <tr key={tx.id} style={{ background: isSelected ? 'rgba(99,102,241,0.08)' : undefined }}>
                  <td>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(tx.id)} style={{ cursor: 'pointer' }} />
                  </td>
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
                      onClick={() => handleDeleteOne(tx.id)} title="삭제"><Trash2 size={13} /></button>
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

      {confirmOpen && (
        <ConfirmModal
          count={selectedCount}
          onConfirm={handleDeleteSelected}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
