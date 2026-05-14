'use client';
import { useCallback, useState } from 'react';
import { X, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { TradingHint } from '@/lib/types';
import StockChart, { ChartHint, Holding, StockChartData } from '@/components/StockChart';

const TYPE_LABELS: Record<string, string> = {
  resistance:      '벽 (Resistance)',
  support:         '지지 (Support)',
  supply_level:    '매물대 (Supply Level)',
  faded_supply:    '흐린 매물대 (Faded Supply Zone)',
  last_buy_zone:   '마지막 매물대 (Last Buy Zone)',
  short_target:    '단기 목표주가 (Short Target)',
  long_target:     '장기 목표주가 (Long Target)',
  buy_stop:        '매수 중지 (Buy Halt)',
  trailing_supply: '추격 매물대 (Trailing Supply)',
  note_only:       '메모 (Note Only)',
};
const TYPE_COLORS: Record<string, string> = {
  resistance: '#ff5252', support: '#00e676', supply_level: '#f59e0b',
  faded_supply: '#a78bfa', last_buy_zone: '#f43f5e',
  short_target: '#60a5fa', long_target: '#818cf8', buy_stop: '#ef4444',
  trailing_supply: '#fb923c', note_only: '#64748b',
};

type Period = '5d' | '1mo' | '3mo' | '6mo' | '1y';
type Interval = '1m' | '15m' | '1d' | '1wk';

const PERIODS: { value: Period; label: string }[] = [
  { value: '5d',  label: '5D' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y',  label: '1Y' },
];

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '1m',  label: '1m' },
  { value: '15m', label: '15m' },
  { value: '1d',  label: 'Daily' },
  { value: '1wk', label: 'Weekly' },
];

function fmtNum(p: number | null): string {
  if (p == null) return '—';
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPrice(p: string | null): string {
  if (!p) return '—';
  return p.trim().split(/\s+/).map(part => {
    const n = parseFloat(part.replace(/,/g, ''));
    return isNaN(n) ? part : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }).join(' ');
}

interface Props {
  ticker: string;
  hints: TradingHint[];
  onClose: () => void;
  onAddHint: (ticker: string) => void;
  onEditHint: (hint: TradingHint) => void;
  onDeleteHint: (id: number) => void;
}

const btnStyle = (active: boolean) => ({
  padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
  background: active ? 'var(--accent)' : 'var(--border)',
  color: active ? 'white' : 'var(--text)',
} as React.CSSProperties);

export default function HintAnalysisModal({ ticker, hints, onClose, onAddHint, onEditHint, onDeleteHint }: Props) {
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === 'undefined') return '1mo';
    return (localStorage.getItem('chart_period') as Period) ?? '1mo';
  });
  const [interval, setIntervalState] = useState<Interval>(() => {
    if (typeof window === 'undefined') return '1d';
    return (localStorage.getItem('chart_interval') as Interval) ?? '1d';
  });
  const [resolvedInterval, setResolvedInterval] = useState('1d');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  const handlePeriod = (p: Period) => { localStorage.setItem('chart_period', p); setPeriod(p); };
  const handleInterval = (iv: Interval) => { localStorage.setItem('chart_interval', iv); setIntervalState(iv); };

  const handleChartLoaded = useCallback((data: StockChartData) => {
    setCurrentPrice(data.price);
    setHoldings(data.holdings);
    setResolvedInterval(data.resolvedInterval);
  }, []);

  const intervalCorrected = resolvedInterval !== interval;

  const chartHints: ChartHint[] = hints.map(h => ({
    date: h.hint_date,
    type: h.type,
    price: h.price,
    note: h.note,
  }));

  const totalQty = holdings.reduce((s, h) => s + h.quantity, 0);
  const totalValue = holdings.reduce((s, h) => s + h.quantity * currentPrice, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 820, width: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{ticker}</h2>
            {currentPrice > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                Price: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtNum(currentPrice)}</span>
              </div>
            )}

            {/* Per-account holdings */}
            {holdings.length > 0 && currentPrice > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {holdings.map(h => (
                  <div key={h.account_id} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ minWidth: 90, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                      {h.account_name}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>{h.quantity.toLocaleString('en-US')} sh</span>
                    <span style={{ color: '#64748b' }}>@ {fmtNum(h.avg_cost)}</span>
                    <span style={{ color: '#64748b' }}>=</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtNum(h.quantity * currentPrice)}</span>
                  </div>
                ))}
                {holdings.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 1 }}>
                    <span style={{ minWidth: 90, fontWeight: 600, color: 'var(--text)' }}>Total</span>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{totalQty.toLocaleString('en-US')} sh</span>
                    <span style={{ color: '#64748b' }}></span>
                    <span style={{ color: '#64748b' }}>=</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtNum(totalValue)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 6 }}
              onClick={() => onAddHint(ticker)}
            >
              <PlusCircle size={14} /> Add Hint
            </button>
            <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Period + Interval selector */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => handlePeriod(p.value)} style={btnStyle(period === p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {INTERVALS.map(iv => (
              <button key={iv.value} onClick={() => handleInterval(iv.value)} style={btnStyle(interval === iv.value)}>
                {iv.label}
              </button>
            ))}
          </div>
          {intervalCorrected && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>→ {resolvedInterval} (auto)</span>
          )}
        </div>

        {/* Chart */}
        <StockChart
          ticker={ticker}
          period={period}
          interval={interval}
          hideTransactions
          chartHints={chartHints}
          svgOpacity={0.5}
          onLoaded={handleChartLoaded}
        />

        {/* Hints table */}
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Stock Price at Creation</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hints.map(h => (
                <tr key={h.id}>
                  <td className="muted">{h.hint_date}</td>
                  <td>
                    <span style={{ color: TYPE_COLORS[h.type] ?? 'var(--muted)', fontWeight: 500, fontSize: 12 }}>
                      {TYPE_LABELS[h.type] ?? h.type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtPrice(h.price)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(h.current_price)}
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {h.note
                      ? <span title={h.note} style={{ color: 'var(--muted)', fontSize: 12, cursor: 'default' }}>
                          {h.note.length > 25 ? h.note.slice(0, 25) + '…' : h.note}
                        </span>
                      : <span className="muted">—</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                    <button style={{ background: 'none', color: 'var(--accent)', padding: 4 }}
                      onClick={() => onEditHint(h)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button style={{ background: 'none', color: 'var(--red)', padding: 4 }}
                      onClick={() => onDeleteHint(h.id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hints.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>No hints for {ticker}</div>
          )}
        </div>
      </div>
    </div>
  );
}
