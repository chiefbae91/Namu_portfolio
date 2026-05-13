'use client';
import { useEffect, useState } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Transaction, Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface Props {
  transactions: Transaction[];
  currency: Currency;
  rates: ExchangeRates;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: number) => Promise<void>;
  onDeleteMany: (ids: number[]) => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  buy: '매수', sell: '매도', dividend: '배당', cash: '현금',
  transfer_deposit: 'Transfer - 입금', transfer_withdraw: 'Transfer - 출금',
};
const TYPE_COLORS: Record<string, string> = {
  buy: 'var(--green)', sell: 'var(--red)', dividend: '#f59e0b', cash: '#60a5fa',
  transfer_deposit: '#34d399', transfer_withdraw: '#f87171',
};

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

const PAGE_SIZE = 50;

function getPageNums(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | null)[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  result.push(1);
  if (left > 2) result.push(null);
  for (let i = left; i <= right; i++) result.push(i);
  if (right < total - 1) result.push(null);
  result.push(total);
  return result;
}

export default function TransactionHistory({ transactions, currency, rates, onEdit, onDelete, onDeleteMany }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [tickerFilter]);

  // When the transactions list changes (e.g. account switch), reset filter if the
  // selected ticker no longer exists in the new data, and clear all selections.
  useEffect(() => {
    if (tickerFilter && !transactions.some(t => t.ticker === tickerFilter)) {
      setTickerFilter('');
    }
    setSelected(new Set());
    setPage(1);
  }, [transactions]);

  const fmt = (usd: number) => formatCurrency(usd, currency, rates);

  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))].sort();
  const filtered = tickerFilter ? transactions.filter(t => t.ticker === tickerFilter) : transactions;
  const filteredIds = filtered.map(t => t.id);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(pageStart, pageEnd);

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
        {filtered.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {pageStart + 1}–{pageEnd} / {filtered.length}
          </span>
        )}

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
            {paginated.map(tx => {
              const isTransfer = tx.type === 'transfer_deposit' || tx.type === 'transfer_withdraw';
              const total = (tx.type === 'cash' || isTransfer) ? tx.price : tx.quantity * tx.price;
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
                    {tx.type !== 'transfer_deposit' && tx.type !== 'transfer_withdraw' && (
                      <button style={{ background: 'none', color: 'var(--accent)', padding: 4 }}
                        onClick={() => onEdit(tx)} title="수정"><Pencil size={13} /></button>
                    )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14 }}>
          <button
            onClick={() => setPage(p => p - 1)} disabled={page === 1}
            style={{ padding: '5px 12px', background: 'var(--border)', color: page === 1 ? 'var(--muted)' : 'var(--text)', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
            <ChevronLeft size={12} /> 이전
          </button>
          {getPageNums(page, totalPages).map((p, i) =>
            p === null
              ? <span key={`e${i}`} style={{ padding: '5px 6px', color: 'var(--muted)', fontSize: 12 }}>…</span>
              : <button key={p} onClick={() => setPage(p)}
                  style={{ padding: '5px 12px', borderRadius: 4, fontSize: 12, fontWeight: p === page ? 700 : 400, background: p === page ? 'var(--accent)' : 'var(--border)', color: p === page ? 'white' : 'var(--text)' }}>
                  {p}
                </button>
          )}
          <button
            onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
            style={{ padding: '5px 12px', background: 'var(--border)', color: page === totalPages ? 'var(--muted)' : 'var(--text)', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
            다음 <ChevronRight size={12} />
          </button>
        </div>
      )}

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
