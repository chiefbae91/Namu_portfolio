'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

type Range = '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y';
const RANGES: Range[] = ['1W', '1M', '3M', '6M', '1Y', '2Y', '5Y'];

interface DataPoint { date: string; value: number; }

function fmtUSD(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtYAxis(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
function fmtTick(dateStr: string, range: Range): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (range === '1W' || range === '1M' || range === '3M')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (range === '6M' || range === '1Y')
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  return dt.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });
}
function fmtTooltipLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function xTicks(data: DataPoint[]): string[] {
  if (data.length <= 6) return data.map(d => d.date);
  const count = 5;
  const step = Math.floor((data.length - 1) / count);
  const ticks = [data[0].date];
  for (let i = step; i < data.length - 1; i += step) ticks.push(data[i].date);
  ticks.push(data[data.length - 1].date);
  return [...new Set(ticks)];
}

interface Props {
  accountId: string | number;
  accountName: string;
  onClose: () => void;
}

export default function AccountHistoryModal({ accountId, accountName, onClose }: Props) {
  const [range, setRange] = useState<Range>('1M');
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData([]);
    fetch(`/api/account-history?account_id=${accountId}&range=${range}`)
      .then(r => r.json())
      .then(d => setData(d.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [accountId, range]);

  const firstVal = data[0]?.value ?? 0;
  const lastVal = data[data.length - 1]?.value ?? 0;
  const change = lastVal - firstVal;
  const changePct = firstVal !== 0 ? (change / Math.abs(firstVal)) * 100 : 0;
  const changeColor = change >= 0 ? 'var(--green)' : 'var(--red)';

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, borderRadius: 4,
    background: active ? 'var(--accent)' : 'var(--border)',
    color: active ? 'white' : 'var(--text)',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{accountName}</h2>
            {!loading && data.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>{fmtUSD(lastVal)}</span>
                <span style={{ fontSize: 13, color: changeColor, fontWeight: 600 }}>
                  {change >= 0 ? '+' : ''}{fmtUSD(change)}&nbsp;
                  ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>vs start of {range}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Range buttons */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={btnStyle(range === r)}>{r}</button>
          ))}
        </div>

        {/* Chart */}
        {loading ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                ticks={xTicks(data)}
                tickFormatter={d => fmtTick(d, range)}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtYAxis}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={(() => {
                  const vals = data.map(d => d.value);
                  const min = Math.min(...vals);
                  const max = Math.max(...vals);
                  const pad = (max - min) * 0.1 || max * 0.05;
                  return [min - pad, max + pad];
                })()}
              />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, maxWidth: 200, overflow: 'auto' }}
                labelStyle={{ color: 'var(--muted)', marginBottom: 4, fontSize: 11 }}
                itemStyle={{ color: 'var(--text)' }}
                formatter={(v: number) => [fmtUSD(v), 'Portfolio Value']}
                labelFormatter={fmtTooltipLabel}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#colorValue)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
