import React from 'react';
import { render } from '@testing-library/react';
import CandlestickChart, { OHLCPoint, ChartTx } from '../components/CandlestickChart';

const candle: OHLCPoint = {
  time: 1700000000,
  date: '2024-01-15',
  open: 100,
  high: 110,
  low: 90,
  close: 105,
};

const buyTx: ChartTx = { date: '2024-01-15', type: 'buy', price: 100, quantity: 10 };
const sellTx: ChartTx = { date: '2024-01-15', type: 'sell', price: 105, quantity: 5 };
const divTx: ChartTx = { date: '2024-01-15', type: 'dividend', price: 0, quantity: 0 };
const buyUpperTx: ChartTx = { date: '2024-01-15', type: 'Buy', price: 100, quantity: 10 };

// Scope to the main chart SVG (cursor:crosshair) to avoid picking up legend SVGs
function chartSvg(container: HTMLElement) {
  return container.querySelector<SVGSVGElement>('svg[style*="crosshair"]')!;
}
function chartPolygons(container: HTMLElement) {
  return Array.from(chartSvg(container).querySelectorAll('polygon'));
}
function chartCircles(container: HTMLElement) {
  return Array.from(chartSvg(container).querySelectorAll('circle'));
}

describe('CandlestickChart marker rendering', () => {
  it('buy renders a green polygon (▲) in the chart, not a circle', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[buyTx]} />
    );
    const buyPolygon = chartPolygons(container).find(p => p.getAttribute('fill') === '#10b981');
    expect(buyPolygon).toBeTruthy();

    const greenCircle = chartCircles(container).find(c => c.getAttribute('fill') === '#10b981');
    expect(greenCircle).toBeUndefined();
  });

  it('buy polygon is placed below the candle low (apex Y < base Y)', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[buyTx]} />
    );
    const buyPolygon = chartPolygons(container).find(
      p => p.getAttribute('fill') === '#10b981'
    ) as SVGPolygonElement;
    expect(buyPolygon).toBeTruthy();
    const ys = buyPolygon.getAttribute('points')!.split(' ').map(pt => parseFloat(pt.split(',')[1]));
    // ▲: apex is topmost (smallest Y), base points have larger Y
    expect(Math.min(...ys)).toBeLessThan(Math.max(...ys));
  });

  it('sell renders a red polygon (▼) in the chart, not a circle', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[sellTx]} />
    );
    const sellPolygon = chartPolygons(container).find(p => p.getAttribute('fill') === '#ef4444');
    expect(sellPolygon).toBeTruthy();
  });

  it('sell polygon is placed above the candle high (▼ orientation)', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[sellTx]} />
    );
    const sellPolygon = chartPolygons(container).find(
      p => p.getAttribute('fill') === '#ef4444'
    ) as SVGPolygonElement;
    expect(sellPolygon).toBeTruthy();
    const ys = sellPolygon.getAttribute('points')!.split(' ').map(pt => parseFloat(pt.split(',')[1]));
    // ▼: top two points are smallest Y, apex is largest Y
    const sorted = [...ys].sort((a, b) => a - b);
    expect(sorted[0]).toBeLessThan(sorted[2]); // top < apex
  });

  it('dividend renders an amber circle in the chart', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[divTx]} />
    );
    const amberCircle = chartCircles(container).find(c => c.getAttribute('fill') === '#f59e0b');
    expect(amberCircle).toBeTruthy();
  });

  it('buy polygon has strokeLinejoin=round (matches legend icon)', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[buyTx]} />
    );
    const buyPolygon = chartPolygons(container).find(p => p.getAttribute('fill') === '#10b981');
    expect(buyPolygon?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('uppercase type "Buy" falls to amber circle — StockChart must normalise before passing', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[buyUpperTx]} />
    );
    // Chart compares strictly (=== 'buy'), so 'Buy' hits the else branch → amber circle
    const greenPolygon = chartPolygons(container).find(p => p.getAttribute('fill') === '#10b981');
    expect(greenPolygon).toBeUndefined();
    const amberCircle = chartCircles(container).find(c => c.getAttribute('fill') === '#f59e0b');
    expect(amberCircle).toBeTruthy();
  });

  it('snapshot: buy is a green ▲ below the candle low', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[buyTx]} />
    );
    expect(chartSvg(container)).toMatchSnapshot();
  });

  it('snapshot: sell is a red ▼ above the candle high', () => {
    const { container } = render(
      <CandlestickChart candles={[candle]} transactions={[sellTx]} />
    );
    expect(chartSvg(container)).toMatchSnapshot();
  });
});
