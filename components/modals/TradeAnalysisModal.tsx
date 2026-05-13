'use client';
import { useEffect, useState } from 'react';
import { X, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import CandlestickChart, { OHLCPoint, ChartTx } from '@/components/CandlestickChart';

type Period = '5d' | '1mo' | '3mo' | '6mo' | '1y';
type Interval = '1m' | '15m' | '1d' | '1wk';

const PERIODS: { value: Period; label: string }[] = [
  { value: '5d', label: '5일' },
  { value: '1mo', label: '1개월' },
  { value: '3mo', label: '3개월' },
  { value: '6mo', label: '6개월' },
  { value: '1y', label: '1년' },
];

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '1m', label: '1분' },
  { value: '15m', label: '15분' },
  { value: '1d', label: '일봉' },
  { value: '1wk', label: '주봉' },
];

const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', dividend: '배당' };
const TYPE_COLORS: Record<string, string> = { buy: '#00e676', sell: '#ff5252', dividend: '#f59e0b' };

const PAGE_SIZE = 10;

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

interface TxRow {
  id: number;
  date: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  ticker: string;
  account_name: string;
}

interface Props {
  ticker: string;
  currency: Currency;
  rates: ExchangeRates;
  onClose: () => void;
  onAddTransaction: () => void;
}

export default function TradeAnalysisModal({ ticker, currency, rates, onClose, onAddTransaction }: Props) {
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === 'undefined') return '1mo';
    return (localStorage.getItem('chart_period') as Period) ?? '1mo';
  });
  const [interval, setIntervalState] = useState<Interval>(() => {
    if (typeof window === 'undefined') return '1d';
    return (localStorage.getItem('chart_interval') as Interval) ?? '1d';
  });
  const [candles, setCandles] = useState<OHLCPoint[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [resolvedInterval, setResolvedInterval] = useState<string>('1d');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fmt = (v: number) => formatCurrency(v, currency, rates);

  useEffect(() => { localStorage.setItem('chart_period', period); }, [period]);
  useEffect(() => { localStorage.setItem('chart_interval', interval); }, [interval]);

  useEffect(() => {
    setLoading(true);
    setCandles([]);
    fetch(`/api/market-price?ticker=${encodeURIComponent(ticker)}&range=${period}&interval=${interval}`)
      .then(r => r.json())
      .then(data => {
        setCandles(data.candles ?? []);
        setTransactions(data.transactions ?? []);
        setCurrentPrice(data.price ?? 0);
        setResolvedInterval(data.resolvedInterval ?? interval);
      })
      .catch(() => { setCandles([]); setTransactions([]); })
      .finally(() => setLoading(false));
  }, [ticker, period, interval]);

  const chartTxs: ChartTx[] = transactions.map(tx => ({
    date: tx.date,
    type: tx.type,
    price: tx.price,
    quantity: tx.quantity,
  }));

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, transactions.length);
  const paginated = transactions.slice(start, end);

  const intervalCorrected = resolvedInterval !== interval;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{ticker}</h2>
            {currentPrice > 0 && (
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>현재가 {fmt(currentPrice)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onAddTransaction}
              style={{ background: 'var(--accent)', color: 'white', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, borderRadius: 6 }}>
              <PlusCircle size={14} /> 거래 입력
            </button>
            <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={20} /></button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={btnStyle(period === p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {INTERVALS.map(iv => (
              <button key={iv.value} onClick={() => setIntervalState(iv.value)} style={ivBtnStyle(interval === iv.value)}>
                {iv.label}
              </button>
            ))}
          </div>
          {intervalCorrected && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>→ {resolvedInterval} (자동 조정)</span>
          )}
        </div>

        {/* Chart */}
        <div style={{ minHeight: 320 }}>
          {loading
            ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>로딩 중...</div>
            : <CandlestickChart candles={candles} transactions={chartTxs} resolvedInterval={resolvedInterval} />
          }
        </div>

        {/* Transaction History */}
        {!loading && transactions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>거래 히스토리</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{start + 1}–{end} / {transactions.length}건</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>날짜</th><th>계좌</th><th>종목</th><th>유형</th>
                    <th style={{ textAlign: 'right' }}>수량</th>
                    <th style={{ textAlign: 'right' }}>단가</th>
                    <th style={{ textAlign: 'right' }}>총액</th>
                    <th style={{ textAlign: 'right' }}>수수료</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((tx, i) => {
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

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 }}>
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  style={{ padding: '4px 10px', background: 'var(--border)', color: page === 1 ? 'var(--muted)' : 'var(--text)', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ChevronLeft size={12} /> 이전
                </button>
                {getPageNums(page, totalPages).map((p, i) =>
                  p === null
                    ? <span key={`e${i}`} style={{ padding: '4px 6px', color: 'var(--muted)', fontSize: 12 }}>…</span>
                    : <button key={p} onClick={() => setPage(p)}
                        style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: p === page ? 700 : 400, background: p === page ? 'var(--accent)' : 'var(--border)', color: p === page ? 'white' : 'var(--text)' }}>
                        {p}
                      </button>
                )}
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                  style={{ padding: '4px 10px', background: 'var(--border)', color: page === totalPages ? 'var(--muted)' : 'var(--text)', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                  다음 <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
