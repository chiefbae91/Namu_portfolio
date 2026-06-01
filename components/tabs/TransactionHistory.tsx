'use client';
import { useEffect, useState } from 'react';
import { Pencil, PlusCircle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Transaction, Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency, formatDate, DateFormat } from '@/lib/format';
import TickerTypeahead from '@/components/TickerTypeahead';
import NoteTooltip from '@/components/NoteTooltip';
import { getLabelMap, resolveAccountName } from '@/lib/accountLabelMap';

interface Props {
  transactions: Transaction[];
  currency: Currency;
  rates: ExchangeRates;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string | number) => Promise<void>;
  onDeleteMany: (ids: (string | number)[]) => Promise<void>;
  deepLink?: { ticker: string; id: number } | null;
  onAddTradingHistory?: () => void;
  onTickerClick?: (ticker: string) => void;
  dateFormat?: DateFormat;
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
const BROKER_ABBR: Record<string, string> = {
  robinhood: 'RH', fidelity: 'FI', schwab: 'SC',
  etrade: 'ET', webull: 'WB', tdameritrade: 'TD',
};
function getAccountInitials(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, abbr] of Object.entries(BROKER_ABBR)) {
    if (lower.includes(key)) return abbr;
  }
  const acct = name.match(/^Acct\s+(\d+)$/i);
  if (acct) return `A${acct[1]}`;
  const words = name.trim().split(/\s+/);
  if (words.length > 1) return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  return name.slice(0, 2).toUpperCase();
}

const TYPE_LABELS: Record<string, string> = {
  buy: 'Buy', sell: 'Sell', dividend: 'Dividend', cash: 'Cash',
  transfer_deposit: 'Transfer - Deposit', transfer_withdraw: 'Transfer - Withdraw',
  split: 'Split', consolidation: 'Reverse Split',
};
const TYPE_COLORS: Record<string, string> = {
  buy: 'var(--green)', sell: 'var(--red)', dividend: 'var(--color-dividend)', cash: 'var(--color-cash)',
  transfer_deposit: 'var(--color-transfer-in)', transfer_withdraw: 'var(--color-transfer-out)',
  split: '#6366f1', consolidation: '#f59e0b',
};

function txLabel(tx: { type: string; subtype?: string | null; quantity?: number }): string {
  if (tx.subtype === 'DIVIDEND_REINVEST') return 'Div. Reinvest';
  const t = tx.type.toLowerCase();
  if (t === 'split') return `${tx.quantity ?? ''}:1 Split`;
  if (t === 'consolidation') return `1:${tx.quantity ?? ''} Reverse Split`;
  return TYPE_LABELS[t] || tx.type;
}
function txColor(tx: { type: string; subtype?: string | null }): string {
  if (tx.subtype === 'DIVIDEND_REINVEST') return 'var(--color-transfer-in)';
  return TYPE_COLORS[tx.type.toLowerCase()] || 'var(--muted)';
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
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Delete {count} transaction{count !== 1 ? 's' : ''}</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
          This will permanently delete the selected transactions.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Delete</button>
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
  { value: '', label: 'All Types' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'dividend_reinvest', label: 'Div. Reinvest' },
  { value: 'transfer_deposit', label: 'Deposit' },
  { value: 'transfer_withdraw', label: 'Withdraw' },
];

export default function TransactionHistory({ transactions, currency, rates, onEdit, onDelete, onDeleteMany, deepLink, onAddTradingHistory, onTickerClick, dateFormat = 'MM/DD/YY' }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drConfirmId, setDrConfirmId] = useState<string | number | null>(null);
  const [page, setPage] = useState(1);
  const [labelMap, setLabelMap] = useState<Record<string, string>>(getLabelMap);

  useEffect(() => {
    const handler = () => setLabelMap(getLabelMap());
    window.addEventListener('account_label_map_changed', handler);
    return () => window.removeEventListener('account_label_map_changed', handler);
  }, []);

  useEffect(() => { setPage(1); }, [tickerFilter, typeFilter]);

  useEffect(() => {
    if (deepLink) {
      setTickerFilter(deepLink.ticker);
      setTypeFilter('');
      setPage(1);
    }
  }, [deepLink]);

  // When the transactions list changes (e.g. account switch), reset filter if the
  // selected ticker no longer exists in the new data, and clear all selections.
  useEffect(() => {
    if (tickerFilter && !transactions.some(t => t.ticker?.toUpperCase() === tickerFilter.toUpperCase())) {
      setTickerFilter('');
    }
    setSelected(new Set());
    setPage(1);
  }, [transactions]);

  const fmt = (usd: number) => formatCurrency(usd, currency, rates);

  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))].sort();
  const filtered = transactions
    .filter(t => !tickerFilter || (t.ticker && t.ticker.toUpperCase().includes(tickerFilter.toUpperCase())))
    .filter(t => {
      if (!typeFilter) return true;
      const tType = t.type?.toLowerCase() ?? '';
      if (typeFilter === 'dividend_reinvest') return t.subtype === 'DIVIDEND_REINVEST';
      if (typeFilter === 'buy') return tType === 'buy' && t.subtype !== 'DIVIDEND_REINVEST';
      return tType === typeFilter;
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

  const toggleOne = (id: string | number) => {
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

  const handleDeleteOne = async (id: string | number) => {
    await onDelete(id as number);
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
        <TickerTypeahead
          value={tickerFilter}
          onChange={val => { setTickerFilter(val); setSelected(new Set()); }}
          suggestions={tickers}
          placeholder="Type ticker to search"
          style={{ minWidth: 130 }}
        />
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setSelected(new Set()); }} style={{ minWidth: 160 }}>
          {TYPE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(tickerFilter || typeFilter) && (
          <button className="btn-secondary btn-sm" onClick={() => { setTickerFilter(''); setTypeFilter(''); setSelected(new Set()); }}>Reset</button>
        )}

        <span className="muted" style={{ fontSize: 12 }}>{filtered.length} records</span>
        {filtered.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {pageStart + 1}–{pageEnd} of {filtered.length}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {onAddTradingHistory && (
          <button
            onClick={onAddTradingHistory}
            style={{ background: 'var(--accent)', color: 'white', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderRadius: 6 }}
          >
            <PlusCircle size={14} /> Add Trading History
          </button>
        )}

        {selectedCount > 0 && (
          <>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              {selectedCount} selected
            </span>
            <button
              className="btn-danger btn-sm"
              onClick={() => setConfirmOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Trash2 size={13} /> Delete Selected
            </button>
          </>
        )}
      </div>

      {/* Table (desktop) */}
      <div className="mobile-hide" style={{ overflowX: 'auto' }}>
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
              <th>Date</th><th>Symbol</th><th>Type</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Fee</th>
              <th style={{ width: '100%' }}>Note</th>
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
                  <td className="muted">{formatDate(tx.date, dateFormat)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tx.account_name && (() => {
                        const displayName = resolveAccountName(tx.account_name, labelMap);
                        return (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                            background: getAccountBadgeColor(displayName),
                            color: 'white',
                            letterSpacing: '0.04em', flexShrink: 0,
                          }}>
                            {getAccountInitials(displayName)}
                          </span>
                        );
                      })()}
                      {tx.ticker && onTickerClick
                        ? <button style={{ background: 'none', color: 'var(--accent)', fontWeight: 500, padding: 0, cursor: 'pointer' }} onClick={() => onTickerClick(tx.ticker!)}>{tx.ticker}</button>
                        : <span style={{ fontWeight: 500 }}>{tx.ticker || '-'}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span style={{ color: txColor(tx), fontWeight: 500 }}>
                      {txLabel(tx)}
                    </span>
                  </td>
                  {tx.type === 'split' || tx.type === 'consolidation' ? (
                    <>
                      <td style={{ textAlign: 'right', color: TYPE_COLORS[tx.type] }} colSpan={3}>
                        {tx.type === 'split' ? `×${tx.quantity}` : `÷${tx.quantity}`}
                      </td>
                      <td className="muted" style={{ textAlign: 'right' }}>—</td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: 'right' }}>{tx.quantity > 0 ? tx.quantity : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{tx.price > 0 ? fmt(tx.price) : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                      <td style={{ textAlign: 'right' }} className="muted">{tx.fee > 0 ? fmt(tx.fee) : '-'}</td>
                    </>
                  )}
                  <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                    {tx.notes ? <NoteTooltip note={tx.notes} /> : <span className="muted">—</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {tx.type !== 'dividend' && tx.subtype !== 'DIVIDEND_REINVEST' && (
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
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No transactions</div>
        )}
      </div>

      {/* Card list (mobile) */}
      <div className="mobile-only">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No transactions</div>
        )}
        {paginated.map(tx => {
          const isTransfer = tx.type === 'transfer_deposit' || tx.type === 'transfer_withdraw';
          const total = (tx.type === 'cash' || isTransfer) ? tx.price : tx.quantity * tx.price;
          const isSelected = selected.has(tx.id);
          const canEditTx = tx.type !== 'dividend' && tx.subtype !== 'DIVIDEND_REINVEST';
          return (
            <div key={tx.id} className="mobile-card" style={{ background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--surface)' }}>
              {/* Row 1: checkbox, badge, ticker, date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleOne(tx.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  {tx.account_name && (() => {
                    const displayName = resolveAccountName(tx.account_name, labelMap);
                    return (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: getAccountBadgeColor(displayName), color: 'white', letterSpacing: '0.04em', flexShrink: 0 }}>
                        {getAccountInitials(displayName)}
                      </span>
                    );
                  })()}
                  {tx.ticker && onTickerClick
                    ? <button style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, padding: 0, cursor: 'pointer', fontSize: 14 }} onClick={() => onTickerClick(tx.ticker!)}>{tx.ticker}</button>
                    : <span style={{ fontWeight: 600, fontSize: 14 }}>{tx.ticker || '-'}</span>
                  }
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{formatDate(tx.date, dateFormat)}</span>
              </div>
              {/* Row 2: type, qty@price, total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ color: txColor(tx), fontWeight: 500, fontSize: 12 }}>{txLabel(tx)}</span>
                <span style={{ flex: 1 }} />
                {(tx.type === 'split' || tx.type === 'consolidation') ? (
                  <span style={{ fontSize: 12, color: TYPE_COLORS[tx.type], fontWeight: 600 }}>
                    {tx.type === 'split' ? `×${tx.quantity}` : `÷${tx.quantity}`}
                  </span>
                ) : (
                  <>
                    {tx.quantity > 0 && tx.price > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tx.quantity} @ {fmt(tx.price)}</span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(total)}</span>
                  </>
                )}
              </div>
              {/* Row 3: actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 6 }}>
                {canEditTx && (
                  <button style={{ background: 'none', color: 'var(--accent)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, minHeight: 36 }}
                    onClick={() => onEdit(tx)}>
                    <Pencil size={13} /> Edit
                  </button>
                )}
                <button style={{ background: 'none', color: 'var(--red)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, minHeight: 36 }}
                  onClick={() => tx.subtype === 'DIVIDEND_REINVEST' ? setDrConfirmId(tx.id) : handleDeleteOne(tx.id)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14 }}>
          <button
            onClick={() => setPage(p => p - 1)} disabled={page === 1}
            style={{ padding: '5px 12px', background: 'var(--border)', color: page === 1 ? 'var(--muted)' : 'var(--text)', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
            <ChevronLeft size={12} /> Prev
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
            Next <ChevronRight size={12} />
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
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Delete Dividend Reinvest</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
              This will delete the reinvestment trade.<br />
              The linked dividend record will be kept.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDrConfirmId(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDrConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
