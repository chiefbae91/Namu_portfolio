'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Currency, ExchangeRates, TradingHint } from '@/lib/types';
import { formatCurrency, formatDate, DateFormat } from '@/lib/format';
import StockChart, { StockChartData, TxRow, Holding, ChartHint } from '@/components/StockChart';
import { getLabelMap, resolveAccountName } from '@/lib/accountLabelMap';

type Period = '5d' | '1mo' | '3mo' | '6mo' | '1y';
type Interval = '1m' | '15m' | '1d' | '1wk';

const PERIODS: { value: Period; label: string }[] = [
  { value: '5d', label: '5D' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
];

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '15m', label: '15m' },
  { value: '1d', label: 'Daily' },
  { value: '1wk', label: 'Weekly' },
];

const TX_TYPE_LABELS: Record<string, string> = { buy: 'Buy', sell: 'Sell', dividend: 'Dividend' };
const TX_TYPE_COLORS: Record<string, string> = { buy: 'var(--color-price-up)', sell: 'var(--color-price-down)', dividend: 'var(--color-dividend)' };

const BADGE_COLORS: [string, string][] = [
  ['robinhood', '#00c853'], ['chase', '#1e88e5'], ['fidelity', '#f59e0b'],
  ['schwab', '#8b5cf6'], ['etrade', '#06b6d4'], ['webull', '#ef4444'],
  ['tdameritrade', '#fb923c'],
];
function badgeColor(name: string): string {
  const l = name.toLowerCase();
  for (const [key, color] of BADGE_COLORS) { if (l.includes(key)) return color; }
  return '#666';
}
const BROKER_ABBR_MODAL: Record<string, string> = {
  robinhood: 'RH', fidelity: 'FI', schwab: 'SC',
  etrade: 'ET', webull: 'WB', tdameritrade: 'TD',
};
function badgeLabel(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, abbr] of Object.entries(BROKER_ABBR_MODAL)) {
    if (lower.includes(key)) return abbr;
  }
  const acct = name.match(/^Acct\s+(\d+)$/i);
  if (acct) return `A${acct[1]}`;
  const words = name.trim().split(/\s+/);
  if (words.length > 1) return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  return name.slice(0, 2).toUpperCase();
}
function AccountBadge({ name }: { name?: string }) {
  if (!name) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 3, background: badgeColor(name), color: 'white', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {badgeLabel(name)}
    </span>
  );
}

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

export default function TradeAnalysisModal({
  ticker, currency, rates, onClose, onAddTransaction, onShowHistory,
  initialTab = 'history', hintRefreshTrigger,
  onAddHint, onEditHint, onDeleteHint, dateFormat = 'MM/DD/YY',
}: Props) {
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === 'undefined') return '1mo';
    return (localStorage.getItem('chart_period') as Period) ?? '1mo';
  });
  const [interval, setIntervalState] = useState<Interval>(() => {
    if (typeof window === 'undefined') return '1d';
    return (localStorage.getItem('chart_interval') as Interval) ?? '1d';
  });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [resolvedInterval, setResolvedInterval] = useState('1d');

  const [activeTab, setActiveTab] = useState<'history' | 'hints'>(initialTab);
  const [hintsData, setHintsData] = useState<TradingHint[]>([]);
  const [hintsLoaded, setHintsLoaded] = useState(false);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [labelMap, setLabelMap] = useState<Record<string, string>>(getLabelMap);

  useEffect(() => {
    const handler = () => setLabelMap(getLabelMap());
    window.addEventListener('account_label_map_changed', handler);
    return () => window.removeEventListener('account_label_map_changed', handler);
  }, []);

  const fmt = (v: number) => formatCurrency(v, currency, rates);

  const handleChartLoaded = useCallback((data: StockChartData) => {
    setCurrentPrice(data.price);
    setTransactions(data.transactions);
    setHoldings(data.holdings);
    setResolvedInterval(data.resolvedInterval);
  }, []);

  const handlePeriod = (p: Period) => { localStorage.setItem('chart_period', p); setPeriod(p); };
  const handleInterval = (iv: Interval) => { localStorage.setItem('chart_interval', iv); setIntervalState(iv); };

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

  // Load hints when switching to hints tab (lazy)
  useEffect(() => {
    if (activeTab === 'hints' && !hintsLoaded && !hintsLoading) {
      refreshHints();
    }
  }, [activeTab, hintsLoaded, hintsLoading, refreshHints]);

  // Re-fetch when parent signals a change (add/edit/delete)
  useEffect(() => {
    setHintsLoaded(false);
  }, [hintRefreshTrigger]);

  const switchToHints = () => setActiveTab('hints');
  const switchToHistory = () => setActiveTab('history');

  const chartHints: ChartHint[] | undefined = activeTab === 'hints'
    ? hintsData.map(h => ({ date: h.hint_date, type: h.type, price: h.price ?? null, note: h.note }))
    : undefined;

  const preview = transactions.slice(0, PAGE_SIZE);
  const hasMore = transactions.length > PAGE_SIZE;
  const intervalCorrected = resolvedInterval !== interval;
  const totalQty = holdings.reduce((s, h) => s + h.quantity, 0);
  const totalValue = holdings.reduce((s, h) => s + h.quantity * currentPrice, 0);

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
        {/* Header */}
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

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => handlePeriod(p.value)} style={btnStyle(period === p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
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
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontSize: 12, color: activeTab === 'hints' ? 'var(--text)' : 'var(--muted)', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={activeTab === 'hints'}
              onChange={e => e.target.checked ? switchToHints() : switchToHistory()}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            Hints{hintsLoading ? ' …' : ''}
          </label>
        </div>

        {/* Chart */}
        <StockChart
          ticker={ticker}
          period={period}
          interval={interval}
          svgOpacity={0.5}
          onLoaded={handleChartLoaded}
          chartHints={chartHints}
        />

        {/* Tabs + Content */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
            <button style={tabBtnStyle(activeTab === 'history')} onClick={switchToHistory}>
              History
            </button>
            <button style={tabBtnStyle(activeTab === 'hints')} onClick={switchToHints}>
              Hints{hintsLoading ? ' …' : ''}
            </button>
          </div>

          {/* History tab */}
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

          {/* Hints tab */}
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
                          <td className="muted">{h.hint_date}</td>
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
        </div>
      </div>
    </div>
  );
}
