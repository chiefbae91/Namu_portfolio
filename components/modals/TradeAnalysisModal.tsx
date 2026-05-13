'use client';
import { useEffect, useState } from 'react';
import { X, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Currency, ExchangeRates } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface Props {
  ticker: string;
  currency: Currency;
  rates: ExchangeRates;
  onClose: () => void;
  onAddTransaction: () => void;
}

interface HistoryPoint { date: string; close: number; }
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

const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', dividend: '배당' };
const TYPE_COLORS: Record<string, string> = { buy: '#10b981', sell: '#ef4444', dividend: '#f59e0b' };

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

function CustomDot({ type, color, cx, cy, payload }: { type: string; color: string; cx?: number; cy?: number; payload?: any }) {
  if (!payload || payload[type] === null || payload[type] === undefined) return null;
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={1.5} />;
}

export default function TradeAnalysisModal({ ticker, currency, rates, onClose, onAddTransaction }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [page, setPage] = useState(1);

  const fmt = (v: number) => formatCurrency(v, currency, rates);

  useEffect(() => {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 2);
    const fromStr = from.toISOString().slice(0, 10);

    fetch(`/api/market-price?ticker=${encodeURIComponent(ticker)}&from=${fromStr}`)
      .then(r => r.json())
      .then(data => {
        setHistory(data.history || []);
        setTransactions(data.transactions || []);
        setCurrentPrice(data.price || 0);
      })
      .finally(() => setLoading(false));
  }, [ticker]);

  // Chart: group by date for overlay dots (use earliest buy/sell/div of that date)
  const txByDate = transactions.reduce<Record<string, TxRow[]>>((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = [];
    acc[tx.date].push(tx);
    return acc;
  }, {});

  const chartData = history.map(h => ({
    date: h.date,
    close: h.close,
    buy: txByDate[h.date]?.find(t => t.type === 'buy')?.price ?? null,
    sell: txByDate[h.date]?.find(t => t.type === 'sell')?.price ?? null,
    dividend: txByDate[h.date]?.find(t => t.type === 'dividend')?.price ?? null,
  }));

  // Pagination for history table
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, transactions.length);
  const paginated = transactions.slice(start, end);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
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

        {/* Chart */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>로딩 중...</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>가격 데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="close" stroke="#6366f1" dot={false} strokeWidth={2} name="종가" />
              <Line type="monotone" dataKey="buy" stroke="#10b981" dot={<CustomDot type="buy" color="#10b981" />} activeDot={false} strokeOpacity={0} name="매수" />
              <Line type="monotone" dataKey="sell" stroke="#ef4444" dot={<CustomDot type="sell" color="#ef4444" />} activeDot={false} strokeOpacity={0} name="매도" />
              <Line type="monotone" dataKey="dividend" stroke="#f59e0b" dot={<CustomDot type="dividend" color="#f59e0b" />} activeDot={false} strokeOpacity={0} name="배당" />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Transaction History */}
        {!loading && transactions.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>거래 히스토리</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {start + 1}–{end} / {transactions.length}건
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>계좌</th>
                    <th>종목</th>
                    <th>유형</th>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 }}>
                <button
                  onClick={() => setPage(p => p - 1)} disabled={page === 1}
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
                <button
                  onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
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
