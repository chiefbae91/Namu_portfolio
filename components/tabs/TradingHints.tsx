'use client';
import { useState } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { TradingHint } from '@/lib/types';

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
  note_only:       '메모 (Note Only)',
};

const TYPE_COLORS: Record<string, string> = {
  resistance:      '#ff5252',
  support:         '#00e676',
  supply_level:    '#f59e0b',
  short_target:    '#60a5fa',
  long_target:     '#818cf8',
  buy_stop:        '#ef4444',
  trailing_supply: '#fb923c',
  note_only:       '#64748b',
};

const PAGE_SIZE = 50;
type SortCol = 'hint_date' | 'price' | 'type';

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
  onDelete: (id: number) => void;
  onSymbolClick?: (ticker: string) => void;
}

export default function TradingHints({ hints, onEdit, onDelete, onSymbolClick }: Props) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [dateMode, setDateMode] = useState<DateRangeMode>('last_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('hint_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const today = toISODate(new Date());

  const tickers = [...new Set(hints.map(h => h.ticker))].sort();

  const activeRange = dateMode === 'custom'
    ? (customFrom || customTo ? { from: customFrom || '0000-01-01', to: customTo || today } : null)
    : getPresetRange(dateMode);

  const filtered = hints.filter(h => {
    if (tickerFilter && h.ticker !== tickerFilter) return false;
    if (activeRange) {
      if (activeRange.from && h.hint_date < activeRange.from) return false;
      if (activeRange.to && h.hint_date > activeRange.to) return false;
    }
    return true;
  });
  const firstPrice = (p: string | null) =>
    p ? parseFloat(p.trim().split(/\s+/)[0].replace(/,/g, '')) : -Infinity;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'hint_date') cmp = a.hint_date.localeCompare(b.hint_date);
    else if (sortCol === 'price') cmp = firstPrice(a.price) - firstPrice(b.price);
    else if (sortCol === 'type') cmp = a.type.localeCompare(b.type);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, sorted.length);
  const paginated = sorted.slice(pageStart, pageEnd);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3, fontSize: 10, marginLeft: 2 }}>↕</span>;
    return sortDir === 'asc' ? <ChevronUp size={11} style={{ marginLeft: 2 }} /> : <ChevronDown size={11} style={{ marginLeft: 2 }} />;
  };

  const fmtPrice = (p: string | null) => {
    if (!p) return null;
    return p.trim().split(/\s+/).map(part => {
      const n = parseFloat(part.replace(/,/g, ''));
      return isNaN(n) ? part : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }).join(' ');
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={tickerFilter}
          onChange={e => { setTickerFilter(e.target.value); setPage(1); }}
          style={{ minWidth: 130 }}
        >
          <option value="">All Symbols</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={dateMode}
          onChange={e => { setDateMode(e.target.value as DateRangeMode); setPage(1); }}
          style={{ minWidth: 130 }}
        >
          <option value="last_day">Last Day</option>
          <option value="last_week">Last Week</option>
          <option value="last_month">Last Month</option>
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

        {(tickerFilter || dateMode !== 'all') && (
          <button className="btn-secondary btn-sm" onClick={() => {
            setTickerFilter('');
            setDateMode('all');
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
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('hint_date')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Hint Date <SortIcon col="hint_date" />
                </span>
              </th>
              <th>Ticker</th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('type')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Type <SortIcon col="type" />
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>Current Price</th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                onClick={() => handleSort('price')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Hint Price <SortIcon col="price" />
                </span>
              </th>
              <th>Note</th>
              <th></th>
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
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {hint.current_price != null
                    ? `$${hint.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="muted">—</span>}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPrice(hint.price) ?? <span className="muted">—</span>}
                </td>
                <td style={{ maxWidth: 220 }}>
                  {hint.note
                    ? (
                      <span
                        title={hint.note}
                        style={{ color: 'var(--muted)', fontSize: 12, cursor: 'default' }}
                      >
                        {hint.note.length > 20 ? hint.note.slice(0, 20) + '…' : hint.note}
                      </span>
                    )
                    : <span className="muted">—</span>
                  }
                </td>
                <td style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No trading hints</div>
        )}
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
