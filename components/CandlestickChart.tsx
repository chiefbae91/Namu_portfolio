'use client';
import { useEffect, useRef, useState } from 'react';

export interface OHLCPoint {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartTx {
  date: string;
  type: string;
  price: number;
  quantity: number;
}

interface Props {
  candles: OHLCPoint[];
  transactions?: ChartTx[];
  resolvedInterval?: string;
}

interface TooltipState {
  x: number;
  y: number;
  candle: OHLCPoint;
  txs: ChartTx[];
}

const PAD = { top: 16, right: 20, bottom: 36, left: 64 };
const H = 320;
const TX_COLORS: Record<string, string> = { buy: '#00e676', sell: '#ff5252', dividend: '#f59e0b' };
const TX_LABELS: Record<string, string> = { buy: '매수', sell: '매도', dividend: '배당' };

function formatXLabel(date: string, interval: string): string {
  if (interval === '1m' || interval === '15m') return date.slice(11, 16) || date.slice(5, 10);
  return date.slice(5);
}

export default function CandlestickChart({ candles, transactions = [], resolvedInterval = '1d' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setWidth(e[0].contentRect.width || 600));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (candles.length === 0) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>가격 데이터 없음</div>;
  }

  const cw = width - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const allPrices = candles.flatMap(c => [c.high, c.low]).filter(v => v != null && !isNaN(v));
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const span = maxP - minP || 1;
  const yMin = minP - span * 0.05;
  const yMax = maxP + span * 0.05;
  const ySpan = yMax - yMin;

  const toY = (p: number) => ch - ((p - yMin) / ySpan) * ch;

  const slot = cw / candles.length;
  const bodyW = Math.max(1, Math.min(14, slot * 0.65));

  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (ySpan * i) / 4);
  const xStep = Math.max(1, Math.ceil(candles.length / 6));
  const xTicks = candles
    .map((c, i) => ({ i, label: formatXLabel(c.date, resolvedInterval) }))
    .filter((_, i) => i % xStep === 0);

  // Tx lookup by date, only show on first candle of each day for intraday
  const txByDate: Record<string, ChartTx[]> = {};
  for (const tx of transactions) {
    const k = tx.date.slice(0, 10);
    (txByDate[k] ??= []).push(tx);
  }

  const isIntraday = resolvedInterval === '1m' || resolvedInterval === '15m';
  const candleTxs = candles.map((c, i) => {
    const dateKey = c.date.slice(0, 10);
    if (!isIntraday) return txByDate[dateKey] ?? [];
    if (i > 0 && candles[i - 1].date.slice(0, 10) === dateKey) return [];
    return txByDate[dateKey] ?? [];
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD.left;
    const idx = Math.floor(mx / slot);
    if (idx >= 0 && idx < candles.length) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        candle: candles[idx],
        txs: candleTxs[idx],
      });
    } else {
      setTooltip(null);
    }
  };

  const toRight = tooltip ? tooltip.x < width * 0.62 : true;

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative', userSelect: 'none' }}>
      <svg
        width={width}
        height={H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: 'crosshair', display: 'block' }}
      >
        {/* Y grid + labels */}
        {yTicks.map((tick, i) => {
          const y = PAD.top + toY(tick);
          const label = tick >= 1000 ? `$${Math.round(tick).toLocaleString()}` : `$${tick.toFixed(2)}`;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={PAD.left + cw} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">{label}</text>
            </g>
          );
        })}

        {/* X labels */}
        {xTicks.map(({ i, label }) => (
          <text key={i} x={PAD.left + i * slot + slot / 2} y={PAD.top + ch + 18} textAnchor="middle" fontSize={10} fill="#64748b">
            {label}
          </text>
        ))}

        {/* Candles */}
        {candles.map((c, i) => {
          const cx = PAD.left + i * slot + slot / 2;
          const up = c.close >= c.open;
          const color = up ? '#00e676' : '#ff5252';
          const bodyY1 = PAD.top + toY(Math.max(c.open, c.close));
          const bodyY2 = PAD.top + toY(Math.min(c.open, c.close));
          const bh = Math.max(1, bodyY2 - bodyY1);
          const txs = candleTxs[i];

          return (
            <g key={i}>
              <line x1={cx} y1={PAD.top + toY(c.high)} x2={cx} y2={PAD.top + toY(c.low)} stroke={color} strokeWidth={1} />
              <rect x={cx - bodyW / 2} y={bodyY1} width={bodyW} height={bh} fill={color} />
              {txs.map((tx, j) => (
                <circle
                  key={j}
                  cx={cx + (j - (txs.length - 1) / 2) * 7}
                  cy={PAD.top + ch + 30}
                  r={3.5}
                  fill={TX_COLORS[tx.type] ?? '#94a3b8'}
                />
              ))}
            </g>
          );
        })}

        {/* Crosshair */}
        {tooltip && (
          <line
            x1={tooltip.x} y1={PAD.top}
            x2={tooltip.x} y2={PAD.top + ch}
            stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4,4"
          />
        )}
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: toRight ? tooltip.x + 14 : undefined,
          right: toRight ? undefined : width - tooltip.x + 14,
          top: Math.max(4, tooltip.y - 56),
          background: '#1a1d27',
          border: '1px solid #2a2d3a',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 50,
          minWidth: 164,
        }}>
          <div style={{ color: '#94a3b8', marginBottom: 5, fontSize: 11 }}>{tooltip.candle.date}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: '#64748b' }}>O</span><span style={{ color: '#e2e8f0' }}>${tooltip.candle.open?.toFixed(2)}</span>
            <span style={{ color: '#00e676' }}>H</span><span style={{ color: '#e2e8f0' }}>${tooltip.candle.high?.toFixed(2)}</span>
            <span style={{ color: '#ff5252' }}>L</span><span style={{ color: '#e2e8f0' }}>${tooltip.candle.low?.toFixed(2)}</span>
            <span style={{ color: '#94a3b8' }}>C</span><span style={{ color: '#e2e8f0' }}>${tooltip.candle.close?.toFixed(2)}</span>
          </div>
          {tooltip.txs.length > 0 && (
            <div style={{ marginTop: 6, borderTop: '1px solid #2a2d3a', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tooltip.txs.map((tx, i) => (
                <div key={i} style={{ color: TX_COLORS[tx.type] ?? '#94a3b8', fontSize: 11 }}>
                  {TX_LABELS[tx.type] ?? tx.type}{tx.quantity > 0 ? ` ×${tx.quantity}` : ''} @ ${tx.price?.toFixed(2)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
