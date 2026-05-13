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

const NAMED_BADGE_COLORS: [string, string][] = [
  ['robinhood', '#00c853'],
  ['chase', '#1e88e5'],
  ['fidelity', '#f59e0b'],
  ['schwab', '#8b5cf6'],
  ['etrade', '#06b6d4'],
  ['webull', '#ef4444'],
  ['tdameritrade', '#fb923c'],
];
function getAccountBadgeColor(name: string): string {
  const lname = name.toLowerCase();
  for (const [key, color] of NAMED_BADGE_COLORS) {
    if (lname.includes(key)) return color;
  }
  return '#666';
}
function getAccountInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
}

const TYPE_LABELS: Record<string, string> = {
  buy: '매수', sell: '매도', dividend: '배당', cash: '현금',
  transfer_deposit: 'Transfer - 입금', transfer_withdraw: 'Transfer - 출금',
};
const TYPE_COLORS: Record<string, string> = {
  buy: 'var(--green)', sell: 'var(--red)', dividend: '#f59e0b', cash: '#60a5fa',
  transfer_deposit: '#34d399', transfer_withdraw: '#f87171',
};

function txLabel(tx: { type: string; subtype?: string | null }): string {
  if (tx.subtype === 'DIVIDEND_REINVEST') return '배당재투자';
  return TYPE_LABELS[tx.type] || tx.type;
}
function txColor(tx: { type: string; subtype?: string | null }): string {
  if (tx.subtype === 'DIVIDEND_REINVEST') return '#34d399';
  return TYPE_COLORS[tx.type] || 'var(--muted)';
}

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

const TYPE_FILTER_OPTIONS = [
  { value: '', label: '전체 유형' },
  { value: 'buy', label: '매수 (BUY)' },
  { value: 'sell', label: '매도 (SELL)' },
  { value: 'dividend', label: '배당 (DIVIDEND)' },
  { value: 'dividend_reinvest', label: '배당재투자' },
  { value: 'transfer_deposit', label: '입금 (DEPOSIT)' },
  { value: 'transfer_withdraw', label: '출금 (WITHDRAW)' },
];

export default function TransactionHistory({ transactions, currency, rates, onEdit, onDelete, onDeleteMany }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drConfirmId, setDrConfirmId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [tickerFilter, typeFilter]);

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
  const filtered = transactions
    .filter(t => !tickerFilter || t.ticker === tickerFilter)
    .filter(t => {
      if (!typeFilter) return true;
      if (typeFilter === 'dividend_reinvest') return t.subtype === 'DIVIDEND_REINVEST';
      if (typeFilter === 'buy') return t.type === 'buy' && t.subtype !== 'DIVIDEND_REINVEST';
      return t.type === typeFilter;
    });
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

  const handleDrConfirmDelete = async () => {
    if (drConfirmId == null) return;
    await handleDeleteOne(drConfirmId);
    setDrConfirmId(null);
  };

  const selectedCount = [...selected].filter(id => filteredIds.includes(id)).length;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={tickerFilter} onChange={e => { setTickerFilter(e.target.value); setSelected(new Set()); }} style={{ minWidth: 130 }}>
          <option value="">전체 종목</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setSelected(new Set()); }} style={{ minWidth: 160 }}>
          {TYPE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(tickerFilter || typeFilter) && (
          <button className="btn-secondary btn-sm" onClick={() => { setTickerFilter(''); setTypeFilter(''); setSelected(new Set()); }}>초기화</button>
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
              <th>날짜</th><th>종목</th><th>유형</th>
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
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tx.account_name && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          background: getAccountBadgeColor(tx.account_name),
                          color: 'white',
                          letterSpacing: '0.04em', flexShrink: 0,
                        }}>
                          {getAccountInitials(tx.account_name)}
                        </span>
                      )}
                      <span style={{ fontWeight: 500 }}>{tx.ticker || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: txColor(tx), fontWeight: 500 }}>
                      {txLabel(tx)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{tx.quantity > 0 ? tx.quantity : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{tx.price > 0 ? fmt(tx.price) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                  <td style={{ textAlign: 'right' }} className="muted">{tx.fee > 0 ? fmt(tx.fee) : '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {tx.type !== 'transfer_deposit' && tx.type !== 'transfer_withdraw'
                      && tx.type !== 'dividend' && tx.subtype !== 'DIVIDEND_REINVEST' && (
                      <button style={{ background: 'none', color: 'var(--accent)', padding: 4 }}
                        onClick={() => onEdit(tx)} title="수정"><Pencil size={13} /></button>
                    )}
                    <button style={{ background: 'none', color: 'var(--red)', padding: 4 }}
                      onClick={() => tx.subtype === 'DIVIDEND_REINVEST'
                        ? setDrConfirmId(tx.id)
                        : handleDeleteOne(tx.id)}
                      title="삭제"><Trash2 size={13} /></button>
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

      {drConfirmId != null && (
        <div className="modal-overlay" onClick={() => setDrConfirmId(null)}>
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>배당재투자 거래 삭제</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
              이 배당재투자 매수 거래를 삭제합니다.<br />
              연결된 배당 기록은 유지됩니다.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDrConfirmId(null)}>취소</button>
              <button className="btn-danger" onClick={handleDrConfirmDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
