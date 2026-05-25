'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Currency, ExchangeRates, TradingHint } from '@/lib/types';
import { formatCurrency, formatDate, DateFormat } from '@/lib/format';
import { DetectedPattern } from '@/lib/patternDetector';
import StockChart, { StockChartData, TxRow, Holding, ChartHint, PatternHighlight } from '@/components/StockChart';
import { getLabelMap, resolveAccountName } from '@/lib/accountLabelMap';

type Period   = '5d' | '1mo' | '3mo' | '6mo' | '1y';
type Interval = '1m' | '15m' | '1d' | '1wk';
type ActiveTab = 'history' | 'hints' | 'patterns';

const PERIODS: { value: Period; label: string }[] = [
  { value: '5d',  label: '5D'  },
  { value: '1mo', label: '1M'  },
  { value: '3mo', label: '3M'  },
  { value: '6mo', label: '6M'  },
  { value: '1y',  label: '1Y'  },
];

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '1m',  label: '1m'     },
  { value: '15m', label: '15m'    },
  { value: '1d',  label: 'Daily'  },
  { value: '1wk', label: 'Weekly' },
];

const TX_TYPE_LABELS: Record<string, string> = { buy: 'Buy', sell: 'Sell', dividend: 'Dividend' };
const TX_TYPE_COLORS: Record<string, string> = {
  buy: 'var(--color-price-up)', sell: 'var(--color-price-down)', dividend: 'var(--color-dividend)',
};

const HINT_TYPE_LABELS: Record<string, string> = {
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

const HINT_TYPE_COLORS: Record<string, string> = {
  resistance:      'var(--hint-resistance)',
  support:         'var(--hint-support)',
  supply_level:    'var(--hint-supply-level)',
  faded_supply:    'var(--hint-faded-supply)',
  last_buy_zone:   'var(--hint-last-buy-zone)',
  short_target:    'var(--hint-short-target)',
  long_target:     'var(--hint-long-target)',
  buy_stop:        'var(--hint-buy-stop)',
  trailing_supply: 'var(--hint-trailing-supply)',
  note_only:       'var(--hint-note-only)',
  accumulation:    'var(--hint-accumulation)',
};

const PAGE_SIZE = 10;

function fmtHintPrice(p: string | number | number[] | null): string {
  if (p == null || p === '') return '—';
  const str = Array.isArray(p) ? p.join(' ') : String(p);
  const parts = str.trim().split(/[\s,]+/).map(part => {
    const n = parseFloat(part.replace(/,/g, ''));
    return isNaN(n) ? null : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '—';
}

function fmtNum(p: number | null): string {
  if (p == null) return '—';
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const thu = new Date(d); thu.setDate(d.getDate() + (4 - (d.getDay() || 7)));
  const year = thu.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function formatPatternDateRange(start: string, end: string, ri: string): string {
  const intraday = ri === '1m' || ri === '15m';
  if (intraday) {
    const sDay = start.slice(5, 10), eDay = end.slice(5, 10);
    const sTime = start.slice(11, 16), eTime = end.slice(11, 16);
    return sDay === eDay ? `${sTime} ~ ${eTime}` : `${sDay} ${sTime} ~ ${eDay} ${eTime}`;
  }
  if (ri === '1wk') return `${isoWeek(start)} ~ ${isoWeek(end)}`;
  return `${start.slice(0, 10)} ~ ${end.slice(0, 10)}`;
}

function AccountBadge({ name }: { name: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: 'var(--border)', color: 'var(--muted)',
      whiteSpace: 'nowrap',
    }}>{name}</span>
  );
}

// ── Toggle Switch ──────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 30, height: 17, borderRadius: 9, position: 'relative',
          background: checked ? 'var(--accent)' : 'var(--border)',
          transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 15 : 2,
          width: 13, height: 13, borderRadius: '50%', background: 'white',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <span style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--muted)', fontWeight: checked ? 600 : 400 }}>
        {label}
      </span>
    </label>
  );
}

// ── Pattern Card ───────────────────────────────────────────────────────────────

function PatternCard({
  pattern, currentPrice, resolvedInterval, selected, onSelect,
}: {
  pattern: DetectedPattern; currentPrice: number; resolvedInterval: string;
  selected: boolean; onSelect: () => void;
}) {
  const signalColor = pattern.signal === 'Bullish'
    ? 'var(--color-price-up)' : pattern.signal === 'Bearish'
    ? 'var(--color-price-down)' : 'var(--muted)';
  const signalIcon = pattern.signal === 'Bullish' ? '▲' : pattern.signal === 'Bearish' ? '▼' : '→';

  const targetPct = pattern.targetPrice && currentPrice > 0
    ? ((pattern.targetPrice - currentPrice) / currentPrice * 100)
    : null;

  const dateRange = formatPatternDateRange(pattern.startDate, pattern.endDate, resolvedInterval);

  return (
    <div
      className="card"
      onClick={onSelect}
      style={{
        padding: '12px 16px', cursor: 'pointer', transition: 'outline 0.12s',
        outline: selected ? `1.5px solid ${signalColor}` : undefined,
        background: selected ? `color-mix(in srgb, ${signalColor} 6%, var(--surface))` : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {pattern.name}
          {selected && (
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: signalColor, flexShrink: 0,
            }} />
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ color: signalColor, fontWeight: 600, fontSize: 12 }}>
            {signalIcon} {pattern.signal}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
            background: `color-mix(in srgb, ${signalColor} 15%, transparent)`,
            color: signalColor, border: `1px solid color-mix(in srgb, ${signalColor} 30%, transparent)`,
          }}>
            {pattern.confidence}%
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        {pattern.neckline != null && (
          <span>Neckline: <strong style={{ color: 'var(--text)' }}>${pattern.neckline.toFixed(2)}</strong></span>
        )}
        {pattern.targetPrice != null && (
          <span>
            Target: <strong style={{ color: signalColor }}>${pattern.targetPrice.toFixed(2)}</strong>
            {targetPct != null && (
              <span style={{ color: signalColor, marginLeft: 4 }}>
                ({targetPct >= 0 ? '+' : ''}{targetPct.toFixed(1)}%)
              </span>
            )}
          </span>
        )}
        <span style={{ fontSize: 11, opacity: 0.7 }}>{dateRange}</span>
      </div>

      {pattern.description && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>
          {pattern.description}
        </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string;
  currency: Currency;
  rates: ExchangeRates;
  onClose: () => void;
  onAddTransaction: () => void;
  onShowHistory?: (ticker: string) => void;
  initialTab?: 'history' | 'hints';
  hintRefreshTrigger?: number;
  onAddHint?: (ticker: string) => void;
  onEditHint?: (hint: TradingHint) => void;
  onDeleteHint?: (id: string | number) => void;
  dateFormat?: DateFormat;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TradeAnalysisModal({
  ticker, currency, rates, onClose, onAddTransaction, onShowHistory,
  initialTab = 'history', hintRefreshTrigger,
  onAddHint, onEditHint, onDeleteHint, dateFormat = 'MM/DD/YY',
}: Props) {
  // ── Chart controls ──
  const [period, setPeriod] = useState<Period>(() =>
    typeof window === 'undefined' ? '1mo' : (localStorage.getItem('chart_period') as Period) ?? '1mo'
  );
  const [interval, setIntervalState] = useState<Interval>(() =>
    typeof window === 'undefined' ? '1d' : (localStorage.getItem('chart_interval') as Interval) ?? '1d'
  );

  // ── Chart data ──
  const [currentPrice, setCurrentPrice]     = useState(0);
  const [transactions, setTransactions]     = useState<TxRow[]>([]);
  const [holdings, setHoldings]             = useState<Holding[]>([]);
  const [resolvedInterval, setResolvedInterval] = useState('1d');

  // ── Toggle states ──
  const [showTrades,   setShowTrades]   = useState(true);
  const [showHints,    setShowHints]    = useState(initialTab === 'hints');
  const [showPatterns, setShowPatterns] = useState(false);

  // ── Active bottom tab ──
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  // ── Hints data ──
  const [hintsData,    setHintsData]    = useState<TradingHint[]>([]);
  const [hintsLoaded,  setHintsLoaded]  = useState(false);
  const [hintsLoading, setHintsLoading] = useState(false);

  // ── Patterns data + client-side cache ──
  const [patternsData,    setPatternsData]    = useState<DetectedPattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsLoaded,  setPatternsLoaded]  = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<DetectedPattern | null>(null);
  const patternCache = useRef<Map<string, DetectedPattern[]>>(new Map());

  const [labelMap, setLabelMap] = useState<Record<string, string>>(getLabelMap);
  useEffect(() => {
    const h = () => setLabelMap(getLabelMap());
    window.addEventListener('account_label_map_changed', h);
    return () => window.removeEventListener('account_label_map_changed', h);
  }, []);

  const fmt = (v: number) => formatCurrency(v, currency, rates);

  const handleChartLoaded = useCallback((data: StockChartData) => {
    setCurrentPrice(data.price);
    setTransactions(data.transactions);
    setHoldings(data.holdings);
    setResolvedInterval(data.resolvedInterval);
  }, []);

  const handlePeriod = (p: Period) => {
    localStorage.setItem('chart_period', p);
    setPeriod(p);
  };
  const handleInterval = (iv: Interval) => {
    localStorage.setItem('chart_interval', iv);
    setIntervalState(iv);
  };

  // ── Patterns cache key ──
  const cacheKey = `${ticker}_${period}_${interval}`;

  // ── Load patterns ──
  const loadPatterns = useCallback(async (key: string, p: Period, iv: Interval) => {
    const cached = patternCache.current.get(key);
    if (cached) { setPatternsData(cached); setPatternsLoaded(true); return; }

    setPatternsLoading(true);
    setPatternsLoaded(false);
    try {
      const res = await fetch(`/api/patterns?ticker=${encodeURIComponent(ticker)}&period=${p}&interval=${iv}`);
      const data = await res.json();
      const patterns: DetectedPattern[] = data.patterns ?? [];
      patternCache.current.set(key, patterns);
      setPatternsData(patterns);
      setPatternsLoaded(true);
    } catch {
      setPatternsData([]);
      setPatternsLoaded(true);
    } finally {
      setPatternsLoading(false);
    }
  }, [ticker]);

  // ── Re-load patterns when period/interval changes (if tab is active or toggle on) ──
  useEffect(() => {
    setSelectedPattern(null);
    if (activeTab === 'patterns' || showPatterns) {
      loadPatterns(cacheKey, period, interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // ── Hints ──
  const refreshHints = useCallback(async () => {
    setHintsLoading(true);
    try {
      const res = await fetch('/api/trading-hints');
      const data: TradingHint[] = await res.json();
      setHintsData(data.filter(h => h.ticker === ticker));
      setHintsLoaded(true);
    } catch { /* ignore */ }
    finally { setHintsLoading(false); }
  }, [ticker]);

  useEffect(() => {
    if ((activeTab === 'hints' || showHints) && !hintsLoaded && !hintsLoading) refreshHints();
  }, [activeTab, showHints, hintsLoaded, hintsLoading, refreshHints]);

  useEffect(() => { setHintsLoaded(false); }, [hintRefreshTrigger]);

  // ── Patterns toggle handler ──
  const handlePatternsToggle = (on: boolean) => {
    setShowPatterns(on);
    if (on) {
      setActiveTab('patterns');
      loadPatterns(cacheKey, period, interval);
    } else {
      setActiveTab(initialTab);
      setSelectedPattern(null);
    }
  };

  // ── Patterns tab click ──
  const handlePatternsTabClick = () => {
    setActiveTab('patterns');
    setShowPatterns(true);
    loadPatterns(cacheKey, period, interval);
  };

  const chartHints: ChartHint[] | undefined = showHints
    ? hintsData.map(h => ({ date: h.hint_date, type: h.type, price: h.price ?? null, note: h.note }))
    : undefined;

  const patternHighlight: PatternHighlight | null = selectedPattern ? {
    startDate: selectedPattern.startDate,
    endDate: selectedPattern.endDate,
    neckline: selectedPattern.neckline,
    signal: selectedPattern.signal,
  } : null;

  const preview = transactions.slice(0, PAGE_SIZE);
  const hasMore = transactions.length > PAGE_SIZE;
  const intervalCorrected = resolvedInterval !== interval;
  const totalQty   = holdings.reduce((s, h) => s + h.quantity, 0);
  const totalValue = holdings.reduce((s, h) => s + h.quantity * currentPrice, 0);

  // Sync activeTab when ticker/context changes (safety net for same-component prop updates)
  useEffect(() => {
    setActiveTab(initialTab);
    setShowHints(initialTab === 'hints');
    setShowPatterns(false);
    setSelectedPattern(null);
  }, [ticker, initialTab]);

  // ── Styles ──
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, borderRadius: 4,
    background: active ? 'var(--accent)' : 'var(--border)',
    color: active ? 'white' : 'var(--text)',
    fontWeight: active ? 600 : 400,
  });

  const ivBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, borderRadius: 4,
    background: active ? 'var(--border)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--muted)',
    fontWeight: active ? 600 : 400,
    border: active ? '1px solid #475569' : '1px solid transparent',
  });

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{ticker}</h2>
            {currentPrice > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>Price: {fmt(currentPrice)}</div>
            )}
            {holdings.length > 0 && currentPrice > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {holdings.map(h => (
                  <div key={h.account_id} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ minWidth: 90, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                      {resolveAccountName(h.account_name, labelMap)}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>{h.quantity.toLocaleString('en-US')} sh</span>
                    <span style={{ color: '#64748b' }}>@ {fmt(h.avg_cost)}</span>
                    <span style={{ color: '#64748b' }}>=</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(h.quantity * currentPrice)}</span>
                  </div>
                ))}
                {holdings.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 1 }}>
                    <span style={{ minWidth: 90, fontWeight: 600, color: 'var(--text)' }}>Total</span>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{totalQty.toLocaleString('en-US')} sh</span>
                    <span style={{ color: '#64748b' }}></span>
                    <span style={{ color: '#64748b' }}>=</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(totalValue)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {activeTab === 'history' && (
              <button onClick={onAddTransaction}
                style={{ background: 'var(--accent)', color: 'white', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, borderRadius: 6 }}>
                <PlusCircle size={14} /> Add Trade
              </button>
            )}
            {activeTab === 'hints' && onAddHint && (
              <button onClick={() => onAddHint(ticker)}
                style={{ background: 'var(--accent)', color: 'white', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, borderRadius: 6 }}>
                <PlusCircle size={14} /> Add Hint
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={20} /></button>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Period */}
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => handlePeriod(p.value)} style={btnStyle(period === p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
          {/* Interval */}
          <div style={{ display: 'flex', gap: 4 }}>
            {INTERVALS.map(iv => (
              <button key={iv.value} onClick={() => handleInterval(iv.value)} style={ivBtnStyle(interval === iv.value)}>
                {iv.label}
              </button>
            ))}
          </div>
          {intervalCorrected && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>→ {resolvedInterval} (auto)</span>
          )}
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
          {/* Toggles */}
          <Toggle checked={showTrades}   onChange={setShowTrades}                                                                                    label="Trades"   />
          <Toggle checked={showHints}    onChange={on => { setShowHints(on); if (on) { setActiveTab('hints'); if (!hintsLoaded && !hintsLoading) refreshHints(); } }} label="Hints"    />
          <Toggle checked={showPatterns} onChange={handlePatternsToggle}                                                                                            label="Patterns" />
        </div>

        {/* ── Chart ── */}
        <StockChart
          ticker={ticker}
          period={period}
          interval={interval}
          svgOpacity={0.5}
          onLoaded={handleChartLoaded}
          hideTransactions={!showTrades}
          chartHints={chartHints}
          patternHighlight={patternHighlight}
        />

        {/* ── Tabs + Content ── */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
            <button style={tabBtnStyle(activeTab === 'history')} onClick={() => { setActiveTab('history'); setShowHints(false); }}>
              Trading History
            </button>
            <button style={tabBtnStyle(activeTab === 'hints')} onClick={() => { setActiveTab('hints'); setShowHints(true); if (!hintsLoaded && !hintsLoading) refreshHints(); }}>
              Trading Hints{activeTab === 'hints' && hintsLoading ? ' …' : ''}
            </button>
            <button style={tabBtnStyle(activeTab === 'patterns')} onClick={handlePatternsTabClick}>
              Patterns
            </button>
          </div>

          {/* ── Trading History tab ── */}
          {activeTab === 'history' && (
            <div style={{ paddingTop: 14 }}>
              {transactions.length > 0 ? (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th><th>Account</th><th>Symbol</th><th>Type</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Price</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((tx, i) => {
                          const total = tx.quantity > 0 ? tx.quantity * tx.price : tx.price;
                          return (
                            <tr key={tx.id ?? i}>
                              <td className="muted">{formatDate(tx.date, dateFormat)}</td>
                              <td><AccountBadge name={resolveAccountName(tx.account_name, labelMap)} /></td>
                              <td style={{ fontWeight: 500 }}>{tx.ticker}</td>
                              <td>
                                <span style={{ color: TX_TYPE_COLORS[tx.type?.toLowerCase()] || 'var(--muted)', fontWeight: 500 }}>
                                  {TX_TYPE_LABELS[tx.type?.toLowerCase()] || tx.type}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>{tx.quantity > 0 ? tx.quantity.toLocaleString('en-US') : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{tx.price > 0 ? fmt(tx.price) : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                              <td style={{ textAlign: 'right' }} className="muted">{tx.fee > 0 ? fmt(tx.fee) : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hasMore && (
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      <button
                        onClick={() => { onClose(); onShowHistory?.(ticker); }}
                        style={{ background: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                        More ({transactions.length - PAGE_SIZE} more trades)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>No trades for {ticker}</div>
              )}
            </div>
          )}

          {/* ── Trading Hints tab ── */}
          {activeTab === 'hints' && (
            <div style={{ paddingTop: 14 }}>
              {hintsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>Loading hints…</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Hint Price</th>
                        <th style={{ textAlign: 'right' }}>Price at Creation</th>
                        <th>Note</th>
                        {(onEditHint || onDeleteHint) && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {hintsData.map(h => (
                        <tr key={h.id}>
                          <td className="muted">{formatDate(h.hint_date, dateFormat)}</td>
                          <td>
                            <span style={{ color: HINT_TYPE_COLORS[h.type] ?? 'var(--muted)', fontWeight: 500, fontSize: 12 }}>
                              {HINT_TYPE_LABELS[h.type] ?? h.type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {fmtHintPrice(h.price)}
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
                          {(onEditHint || onDeleteHint) && (
                            <td style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                              {onEditHint && (
                                <button style={{ background: 'none', color: 'var(--accent)', padding: 4 }}
                                  onClick={() => onEditHint(h)} title="Edit">
                                  <Pencil size={13} />
                                </button>
                              )}
                              {onDeleteHint && (
                                <button style={{ background: 'none', color: 'var(--red)', padding: 4 }}
                                  onClick={() => onDeleteHint(h.id)} title="Delete">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hintsData.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>No hints for {ticker}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Patterns tab ── */}
          {activeTab === 'patterns' && (
            <div style={{ paddingTop: 14 }}>
              {patternsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--accent)',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>패턴을 읽고 있습니다…</span>
                </div>
              ) : !patternsLoaded ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>
                  Patterns 토글을 켜거나 탭을 클릭하면 분석을 시작합니다.
                </div>
              ) : patternsData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                  감지된 패턴이 없습니다
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
                  {patternsData.map((p, i) => (
                    <PatternCard
                      key={i}
                      pattern={p}
                      currentPrice={currentPrice}
                      resolvedInterval={resolvedInterval}
                      selected={selectedPattern === p}
                      onSelect={() => setSelectedPattern(prev => prev === p ? null : p)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
