'use client';

import React from 'react';
import { YearData, RetirementSummary } from '@/lib/retirementCalculations';

function fmtUSD(n: number): string {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  let str: string;
  if (abs >= 1_000_000) {
    str = `$${(abs / 1_000_000).toFixed(2)}M`;
  } else {
    str = `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return n < 0 ? `-${str}` : str;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

interface SummaryCardProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}

function SummaryCard({ label, value, valueColor, sub }: SummaryCardProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 8,
      padding: '0.9rem 1rem',
    }}>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: valueColor ?? 'var(--text)' }}>{value}</p>
      {sub && <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

interface Props {
  plan: YearData[] | null;
  summary: RetirementSummary | null;
}

export function RetirementResults({ plan, summary }: Props) {
  if (!plan || !summary) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--muted)', fontSize: 13, textAlign: 'center',
      }}>
        <div>
          <p style={{ fontSize: 32, margin: '0 0 10px' }}>📊</p>
          <p style={{ margin: 0 }}>설정을 입력하고 [계산]을 눌러주세요.</p>
        </div>
      </div>
    );
  }

  const safetyColor = summary.safetyMargin >= 80 ? 'var(--green)'
    : summary.safetyMargin >= 50 ? '#f59e0b' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <SummaryCard
          label="최종 자산"
          value={fmtUSD(summary.endingAssets)}
          valueColor={summary.endingAssets > 0 ? 'var(--green)' : 'var(--red)'}
        />
        <SummaryCard
          label="상태"
          value={summary.hasShortfall ? '⚠️ 부족' : '✅ 안정'}
          valueColor={summary.hasShortfall ? 'var(--red)' : 'var(--green)'}
          sub={summary.shortfallStartYear ? `${summary.shortfallStartYear}년부터 적자` : undefined}
        />
        <SummaryCard
          label="안전 마진"
          value={fmtPct(summary.safetyMargin)}
          valueColor={safetyColor}
          sub="현금흐름 흑자 비율"
        />
        <SummaryCard
          label="총 SS 수령액"
          value={fmtUSD(summary.totalSSReceived)}
          valueColor="var(--accent)"
        />
      </div>

      {/* 연도별 현금 흐름 미니 바 차트 */}
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        padding: '1rem',
      }}>
        <p style={{ margin: '0 0 0.8rem', fontSize: 12, fontWeight: 500 }}>📊 연도별 현금 흐름</p>
        <MiniBarChart plan={plan} />
      </div>

      {/* 총자산 추이 */}
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        padding: '1rem',
      }}>
        <p style={{ margin: '0 0 0.8rem', fontSize: 12, fontWeight: 500 }}>📈 총자산 추이</p>
        <AssetTrendChart plan={plan} />
      </div>

      {/* 연도별 상세 테이블 */}
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        padding: '1rem',
      }}>
        <p style={{ margin: '0 0 0.8rem', fontSize: 12, fontWeight: 500 }}>📋 연도별 상세 현금 흐름</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['연도', 'SS', '출금', '생활비', '현금흐름', '총자산'].map(h => (
                  <th key={h} style={{ textAlign: h === '연도' ? 'left' : 'right', padding: '6px 4px', fontWeight: 500, color: 'var(--muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.map((row, idx) => {
                const totalWithdrawal = Object.values(row.accountBalances).reduce((s, a) => s + a.withdrawal, 0);
                const isDeficit = row.netCashFlow < 0;
                return (
                  <tr key={idx} style={{
                    borderBottom: '0.5px solid var(--border)',
                    background: isDeficit ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}>
                    <td style={{ padding: '5px 4px', fontWeight: 500 }}>{row.year}</td>
                    <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--muted)' }}>{fmtUSD(row.ss)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--muted)' }}>{fmtUSD(totalWithdrawal)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--muted)' }}>{fmtUSD(row.livingExpense)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 500, color: isDeficit ? 'var(--red)' : 'var(--green)' }}>
                      {row.netCashFlow >= 0 ? '+' : ''}{fmtUSD(row.netCashFlow)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 500 }}>{fmtUSD(row.totalAssets)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ plan }: { plan: YearData[] }) {
  const maxAbs = Math.max(...plan.map(y => Math.abs(y.netCashFlow)), 1);
  const barWidth = Math.max(4, Math.min(16, Math.floor(600 / plan.length) - 2));
  const chartHeight = 80;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg height={chartHeight + 20} width={plan.length * (barWidth + 2) + 20} style={{ display: 'block' }}>
        <line x1={10} y1={chartHeight / 2} x2={plan.length * (barWidth + 2) + 10} y2={chartHeight / 2}
          stroke="var(--border)" strokeWidth={0.5} />
        {plan.map((row, idx) => {
          const isPos = row.netCashFlow >= 0;
          const ratio = Math.min(Math.abs(row.netCashFlow) / maxAbs, 1);
          const barH = Math.max(2, ratio * (chartHeight / 2 - 4));
          const x = 10 + idx * (barWidth + 2);
          const y = isPos ? chartHeight / 2 - barH : chartHeight / 2;
          return (
            <g key={idx}>
              <rect x={x} y={y} width={barWidth} height={barH}
                fill={isPos ? 'var(--green)' : 'var(--red)'} opacity={0.8} rx={1} />
              {idx % Math.ceil(plan.length / 8) === 0 && (
                <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" fontSize={8} fill="var(--muted)">
                  {String(row.year).slice(2)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AssetTrendChart({ plan }: { plan: YearData[] }) {
  const maxAssets = Math.max(...plan.map(y => y.totalAssets), 1);
  const width = 560;
  const height = 90;
  const pad = { left: 10, right: 10, top: 8, bottom: 18 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const points = plan.map((row, idx) => {
    const x = pad.left + (idx / Math.max(plan.length - 1, 1)) * w;
    const y = pad.top + (1 - row.totalAssets / maxAssets) * h;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${pad.left},${pad.top + h}`,
    ...points,
    `${pad.left + w},${pad.top + h}`,
  ].join(' ');

  const yearStep = Math.ceil(plan.length / 7);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg height={height} width={width} style={{ display: 'block' }}>
        <polygon points={areaPoints} fill="var(--accent)" opacity={0.15} />
        <polyline points={points.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
        {plan.filter((_, i) => i % yearStep === 0 || i === plan.length - 1).map((row, i) => {
          const idx = plan.indexOf(row);
          const x = pad.left + (idx / Math.max(plan.length - 1, 1)) * w;
          return (
            <text key={i} x={x} y={height - 2} textAnchor="middle" fontSize={8} fill="var(--muted)">
              {row.year}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
