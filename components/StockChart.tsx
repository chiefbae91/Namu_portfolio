'use client';
import { memo, useEffect, useRef, useState } from 'react';
import CandlestickChart, { OHLCPoint, ChartTx, ChartHint } from './CandlestickChart';
export type { ChartHint };

export interface TxRow {
  id: number;
  date: string;
  type: string;
  subtype?: string | null;
  quantity: number;
  price: number;
  fee: number;
  ticker: string;
  account_name: string;
  notes?: string | null;
}

export interface Holding {
  account_id: number;
  account_name: string;
  quantity: number;
  avg_cost: number;
}

export interface StockChartData {
  price: number;
  transactions: TxRow[];
  resolvedInterval: string;
  holdings: Holding[];
}

interface Props {
  ticker: string;
  period: string;
  interval: string;
  hideTransactions?: boolean;
  chartHints?: ChartHint[];
  svgOpacity?: number;
  onLoaded?: (data: StockChartData) => void;
}

const StockChart = memo(function StockChart({ ticker, period, interval, hideTransactions, chartHints, svgOpacity, onLoaded }: Props) {
  const [candles, setCandles] = useState<OHLCPoint[]>([]);
  const [chartTxs, setChartTxs] = useState<ChartTx[]>([]);
  const [resolvedInterval, setResolvedInterval] = useState(interval);
  const [loading, setLoading] = useState(true);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/market-price?ticker=${encodeURIComponent(ticker)}&range=${period}&interval=${interval}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const newCandles: OHLCPoint[] = data.candles ?? [];
        const newTxs: TxRow[] = data.transactions ?? [];
        const ri: string = data.resolvedInterval ?? interval;
        setCandles(newCandles);
        setChartTxs(newTxs.map(tx => ({ date: tx.date, type: tx.type, subtype: tx.subtype, price: tx.price, quantity: tx.quantity, notes: tx.notes })));
        setResolvedInterval(ri);
        onLoadedRef.current?.({ price: data.price ?? 0, transactions: newTxs, resolvedInterval: ri, holdings: data.holdings ?? [] });
      })
      .catch(() => {
        if (cancelled) return;
        setCandles([]);
        setChartTxs([]);
        onLoadedRef.current?.({ price: 0, transactions: [], resolvedInterval: interval, holdings: [] });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [ticker, period, interval]);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 320 }}>
      <CandlestickChart candles={candles} transactions={hideTransactions ? [] : chartTxs} chartHints={chartHints} resolvedInterval={resolvedInterval} svgOpacity={svgOpacity} />
      {loading && candles.length > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,12,20,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4, pointerEvents: 'none',
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>로딩 중...</span>
        </div>
      )}
      {loading && candles.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: 'var(--muted)', fontSize: 13 }}>
          로딩 중...
        </div>
      )}
    </div>
  );
});

export default StockChart;
