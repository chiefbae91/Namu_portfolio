'use client';
import { useState } from 'react';
import { Bell, Pencil, PlusCircle, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { TradingHint } from '@/lib/types';
import TickerTypeahead from '@/components/TickerTypeahead';
import NoteTooltip from '@/components/NoteTooltip';

type DateRangeMode = 'all' | 'last_day' | 'last_week' | 'last_month' | 'custom';

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(mode: DateRangeMode): { from: string; to: string } | null {
  if (mode === 'all' || mode === 'custom') return null;
  const to = new Date();
  const from = new Date();
  if (mode === 'last_day') from.setDate(from.getDate() - 1);
  else if (mode === 'last_week') from.setDate(from.getDate() - 7);
  else if (mode === 'last_month') from.setMonth(from.getMonth() - 1);
  return { from: toISODate(from), to: toISODate(to) };
}

const TYPE_LABELS: Record<string, string> = {
  resistance:      '벽 (Resistance)',
  support:         '지지 (Support)',
  supply_level:    '매물대 (Supply Level)',
  short_target:    '단기 목표주가 (Short Target)',
  long_target:     '장기 목표주가 (Long Target)',
  buy_stop:        '매수 중지 (Buy Halt)',
  trailing_supply: '추격 매물대 (Trailing Supply)',
  accumulation:    '매집 자리 (Accumulation)',
  note_only:       '메모 (Note Only)',
  faded_supply:    '흐린 매물대 (Faded Supply Zone)',
  last_buy_zone:   '마지막 매물대 (Last Buy Zone)',
};

const TYPE_COLORS: Record<string, string> = {
  resistance:      'var(--hint-resistance)',
  support:         'var(--hint-support)',
  supply_level:    'var(--hint-supply-level)',
  short_target:    'var(--hint-short-target)',
  long_target:     'var(--hint-long-target)',
  buy_stop:        'var(--hint-buy-stop)',
  trailing_supply: 'var(--hint-trailing-supply)',
  accumulation:    'var(--hint-accumulation)',
  note_only:       'var(--hint-note-only)',
  faded_supply:    'var(--hint-faded-supply)',
  last_buy_zone:   'var(--hint-last-buy-zone)',
};

const PAGE_SIZE = 50;

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'resistance',      label: '벽 (Resistance)' },
  { value: 'support',         label: '지지 (Support)' },
  { value: 'supply_level',    label: '매물대 (Supply Level)' },
  { value: 'faded_supply',    label: '흐린 매물대 (Faded Supply Zone)' },
  { value: 'last_buy_zone',   label: '마지막 매물대 (Last Buy Zone)' },
  { value: 'short_target',    label: '단기 목표주가 (Short Target)' },
  { value: 'long_target',     label: '장기 목표주가 (Long Target)' },
  { value: 'buy_stop',        label: '매수 중지 (Buy Halt)' },
  { value: 'trailing_supply', label: '추격 매물대 (Trailing Supply)' },
  { value: 'accumulation',    label: '매집 자리 (Accumulation)' },
  { value: 'note_only',       label: '메모 (Note Only)' },
];

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

interface Props {
  hints: TradingHint[];
  onEdit: (hint: TradingHint) => void;
  onDelete: (id: string | number) => void;
  onSymbolClick?: (ticker: string) => void;
  onAddHint?: () => void;
  isLoggedIn?: boolean;
  alertedHintIds?: Set<string>;
  onToggleAlert?: (hint: TradingHint) => void;
}

export default function TradingHints({ hints, onEdit, onDelete, onSymbolClick, onAddHint, isLoggedIn = false, alertedHintIds, onToggleAlert }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateMode, setDateMode] = useState<DateRangeMode>('last_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [expandedNotes, setExpandedNotes] = useState<Set<string | number>>(new Set());

  const toggleNote = (id: string | number) => {
    setExpandedNotes(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const today = toISODate(new Date());

  const tickers = [...new Set(hints.map(h => h.ticker))].sort();

  const activeRange = dateMode === 'custom'
    ? (customFrom || customTo ? { from: customFrom || '0000-01-01', to: customTo || today } : null)
    : getPresetRange(dateMode);

  const filtered = hints.filter(h => {
    if (tickerFilter && !h.ticker.toUpperCase().includes(tickerFilter.toUpperCase())) return false;
    if (typeFilter && h.type !== typeFilter) return false;
    if (activeRange) {
      if (activeRange.from && h.hint_date < activeRange.from) return false;
      if (activeRange.to && h.hint_date > activeRange.to) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const cmp = a.hint_date.localeCompare(b.hint_date);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, sorted.length);
  const paginated = sorted.slice(pageStart, pageEnd);

  const toggleSort = () => {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    setPage(1);
  };

  const SortIcon = () =>
    sortDir === 'asc'
      ? <ChevronUp size={11} style={{ marginLeft: 2 }} />
      : <ChevronDown size={11} style={{ marginLeft: 2 }} />;

  const fmtPrice = (p: string | number | number[] | null) => {
    if (p == null || p === '') return null;
    const str = Array.isArray(p) ? p.join(' ') : String(p);
    const parts = str.trim().split(/[\s,]+/).map(part => {
      const n = parseFloat(part.replace(/,/g, ''));
      return isNaN(n) ? null : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }).filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <TickerTypeahead
          value={tickerFilter}
          onChange={val => { setTickerFilter(val); setPage(1); }}
          suggestions={tickers}
          placeholder="Type ticker to search"
          style={{ minWidth: 130 }}
        />

        <select
          value={dateMode}
          onChange={e => { setDateMode(e.target.value as DateRangeMode); setPage(1); }}
          style={{ minWidth: 130 }}
        >
          <option value="last_day">1 Day</option>
          <option value="last_week">1 Week</option>
          <option value="last_month">30 Days</option>
          <option value="custom">Custom</option>
        </select>

        {dateMode === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={customFrom}
              max={customTo || today}
              onChange={e => {
                const val = e.target.value;
                // enforce max 1 year range from the chosen start
                if (customTo) {
                  const maxTo = new Date(val);
                  maxTo.setFullYear(maxTo.getFullYear() + 1);
                  if (customTo > toISODate(maxTo)) setCustomTo(toISODate(maxTo));
                }
                setCustomFrom(val);
                setPage(1);
              }}
              style={{ fontSize: 12 }}
            />
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>–</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={(() => {
                if (!customFrom) return today;
                const maxDate = new Date(customFrom);
                maxDate.setFullYear(maxDate.getFullYear() + 1);
                const maxStr = toISODate(maxDate);
                return maxStr > today ? today : maxStr;
              })()}
              onChange={e => { setCustomTo(e.target.value); setPage(1); }}
              style={{ fontSize: 12 }}
            />
          </div>
        )}

        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 160 }}
        >
          {TYPE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {(tickerFilter || typeFilter || dateMode !== 'last_month' || customFrom || customTo) && (
          <button className="btn-secondary btn-sm" onClick={() => {
            setTickerFilter('');
            setTypeFilter('');
            setDateMode('last_month');
            setCustomFrom('');
            setCustomTo('');
            setPage(1);
          }}>Reset</button>
        )}
        <span className="muted" style={{ fontSize: 12 }}>{sorted.length} hints</span>
        {sorted.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {pageStart + 1}–{pageEnd} of {sorted.length}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {onAddHint && (
          <button
            onClick={onAddHint}
            style={{ background: 'var(--accent)', color: 'white', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderRadius: 6 }}
          >
            <PlusCircle size={14} /> Add Trading Hint
          </button>
        )}
      </div>

      {/* Table (desktop) */}
      <div className="mobile-hide" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={toggleSort}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Hint Date <SortIcon />
                </span>
              </th>
              <th>Ticker</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Hint Price</th>
              <th style={{ textAlign: 'right' }}>Stock Price at Creation</th>
              <th style={{ width: '100%' }}>Note</th>
              <th></th>
              {isLoggedIn && onToggleAlert && <th></th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map(hint => (
              <tr key={hint.id}>
                <td className="muted">{hint.hint_date}</td>
                <td>
                  <button
                    onClick={() => onSymbolClick?.(hint.ticker)}
                    style={{
                      background: 'none', color: 'var(--accent)', fontWeight: 600,
                      padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit',
                    }}
                  >
                    {hint.ticker}
                  </button>
                </td>
                <td>
                  <span style={{
                    color: TYPE_COLORS[hint.type] ?? 'var(--muted)',
                    fontWeight: 500,
                    fontSize: 12,
                  }}>
                    {TYPE_LABELS[hint.type] ?? hint.type}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {fmtPrice(hint.price) ?? <span className="muted">—</span>}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {hint.current_price != null
                    ? `$${hint.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="muted">—</span>}
                </td>
                <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                  {hint.note ? <NoteTooltip note={hint.note} /> : <span className="muted">—</span>}
                </td>
                <td style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                  {isLoggedIn && (<>
                    <button
                      style={{ background: 'none', color: 'var(--accent)', padding: 4 }}
                      onClick={() => onEdit(hint)}
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      style={{ background: 'none', color: 'var(--red)', padding: 4 }}
                      onClick={() => onDelete(hint.id)}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>)}
                </td>
                {isLoggedIn && onToggleAlert && (
                  <td>
                    {hint.type !== 'note_only' && hint.price != null && hint.price !== '' && (
                      (() => {
                        const isAlerted = alertedHintIds?.has(String(hint.id)) ?? false;
                        return (
                          <button
                            onClick={() => onToggleAlert(hint)}
                            title={isAlerted ? '알림 해제' : '가격 알림 설정'}
                            style={{
                              background: 'none',
                              color: isAlerted ? 'var(--accent)' : 'var(--muted)',
                              padding: 4,
                            }}
                          >
                            <Bell size={13} fill={isAlerted ? 'currentColor' : 'none'} />
                          </button>
                        );
                      })()
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No trading hints</div>
        )}
      </div>

      {/* Card list (mobile) */}
      <div className="mobile-only">
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No trading hints</div>
        )}
        {paginated.map(hint => (
          <div key={hint.id} className="mobile-card">
            {/* Row 1: date, ticker, type, note icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{hint.hint_date}</span>
              <button
                onClick={() => onSymbolClick?.(hint.ticker)}
                style={{ background: 'none', color: 'var(--accent)', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 14 }}
              >
                {hint.ticker}
              </button>
              <span style={{ color: TYPE_COLORS[hint.type] ?? 'var(--muted)', fontSize: 11, fontWeight: 500 }}>
                {TYPE_LABELS[hint.type] ?? hint.type}
              </span>
              {hint.note && (
                <button
                  onClick={() => toggleNote(hint.id)}
                  style={{ background: 'none', color: expandedNotes.has(hint.id) ? 'var(--accent)' : 'var(--muted)', padding: '2px 4px', fontSize: 14, minHeight: 28 }}
                  title="Show note"
                >
                  📝
                </button>
              )}
            </div>
            {/* Note expansion */}
            {hint.note && expandedNotes.has(hint.id) && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {hint.note}
              </div>
            )}
            {/* Row 2: prices */}
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12 }}>
              <span>Hint: <strong>{fmtPrice(hint.price) ?? <span className="muted">—</span>}</strong></span>
              <span style={{ color: 'var(--muted)' }}>
                Stock: {hint.current_price != null
                  ? `$${hint.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </span>
            </div>
            {/* Row 3: actions */}
            {isLoggedIn && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                {onToggleAlert && hint.type !== 'note_only' && hint.price != null && hint.price !== '' && (() => {
                  const isAlerted = alertedHintIds?.has(String(hint.id)) ?? false;
                  return (
                    <button
                      onClick={() => onToggleAlert(hint)}
                      style={{ background: 'none', color: isAlerted ? 'var(--accent)' : 'var(--muted)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, minHeight: 36 }}
                    >
                      <Bell size={13} fill={isAlerted ? 'currentColor' : 'none'} />
                      {isAlerted ? '알림 ON' : '알림'}
                    </button>
                  );
                })()}
                <button
                  style={{ background: 'none', color: 'var(--accent)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, minHeight: 36 }}
                  onClick={() => onEdit(hint)}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  style={{ background: 'none', color: 'var(--red)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, minHeight: 36 }}
                  onClick={() => onDelete(hint.id)}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
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
    </div>
  );
}
