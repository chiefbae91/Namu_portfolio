'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceDot, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  ticker: string;
  onClose: () => void;
}

interface HistoryPoint { date: string; close: number; }
interface TxPoint { date: string; type: string; quantity: number; price: number; }

export default function TradeAnalysisModal({ ticker, onClose }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [transactions, setTransactions] = useState<TxPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);

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

  const txByDate = transactions.reduce<Record<string, TxPoint[]>>((acc, tx) => {
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

  const CustomDot = (type: string, color: string) => (props: any) => {
    const { cx, cy, payload } = props;
    if (payload[type] === null) return null;
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={1.5} />;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 860 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{ticker}</h2>
            {currentPrice > 0 && (
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>현재가 ${currentPrice.toFixed(2)}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>로딩 중...</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>가격 데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
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

        {transactions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>날짜</th><th>유형</th><th>수량</th><th>단가</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i}>
                    <td>{tx.date}</td>
                    <td>
                      <span style={{
                        color: tx.type === 'buy' ? 'var(--green)' : tx.type === 'sell' ? 'var(--red)' : '#f59e0b',
                        fontWeight: 500
                      }}>
                        {tx.type === 'buy' ? '매수' : tx.type === 'sell' ? '매도' : '배당'}
                      </span>
                    </td>
                    <td>{tx.quantity}</td>
                    <td>${tx.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
