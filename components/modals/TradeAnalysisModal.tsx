'use client';
import { useCallback, useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import StockChart, { StockChartData, TxRow, Holding } from '@/components/StockChart';

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

const TYPE_LABELS: Record<string, string> = { buy: 'Buy', sell: 'Sell', dividend: 'Dividend' };
const TYPE_COLORS: Record<string, string> = { buy: '#00e676', sell: '#ff5252', dividend: '#f59e0b' };

const PAGE_SIZE = 10;

interface Props {
  ticker: string;
  currency: Currency;
  rates: ExchangeRates;
  onClose: () => void;
  onAddTransaction: () => void;
  onShowHistory?: (ticker: string) => void;
}

export default function TradeAnalysisModal({ ticker, currency, rates, onClose, onAddTransaction, onShowHistory }: Props) {
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
    background: active ? '#334155' : 'var(--border)',
    color: active ? '#e2e8f0' : 'var(--muted)',
    fontWeight: active ? 600 : 400,
    border: active ? '1px solid #475569' : '1px solid transparent',
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

            {/* Per-account holdings */}
            {holdings.length > 0 && currentPrice > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {holdings.map(h => (
                  <div key={h.account_id} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ minWidth: 90, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                      {h.account_name}
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
            <button onClick={onAddTransaction}
              style={{ background: 'var(--accent)', color: 'white', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, borderRadius: 6 }}>
              <PlusCircle size={14} /> Add Trade
            </button>
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
        </div>

        {/* Chart — owns its own loading state, no modal flicker */}
        <StockChart ticker={ticker} period={period} interval={interval} onLoaded={handleChartLoaded} />

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Trade History</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{transactions.length} trades</span>
            </div>

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
                        <td className="muted">{tx.date}</td>
                        <td>{tx.account_name}</td>
                        <td style={{ fontWeight: 500 }}>{tx.ticker}</td>
                        <td>
                          <span style={{ color: TYPE_COLORS[tx.type] || 'var(--muted)', fontWeight: 500 }}>
                            {TYPE_LABELS[tx.type] || tx.type}
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
          </div>
        )}
      </div>
    </div>
  );
}
