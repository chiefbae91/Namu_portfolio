'use client';

import React, { useState, useMemo } from 'react';
import { runSimulation } from '@/lib/retirementCalc';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  maximumFractionDigits: 0
}).format(n);

const DEFAULTS = {
  currentAge: 53,
  retireAge: 62,
  endAge: 90,
  currentYear: new Date().getFullYear(),
  portfolioBalance: 600000,
  annualReturn: 7,
  withdrawalRate: 4,
  ssStartAge: 67,
  ssMonthly: 2000,
  ssCola: 2.5,
  inflation: 2.5,
  livingExpenses: [
    { fromAge: 53, monthly: 5000 },
    { fromAge: 62, monthly: 6000 },
    { fromAge: 72, monthly: 5000 },
    { fromAge: 82, monthly: 4000 }
  ]
};

export default function RetirementPage() {
  const [params, setParams] = useState(DEFAULTS);
  const [calculated, setCalculated] = useState(false);

  const result = useMemo(() => {
    if (!calculated) return null;
    return runSimulation(params);
  }, [params, calculated]);

  const set = (key: string, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setCalculated(false);
  };

  const setExpense = (idx: number, key: string, value: string) => {
    const updated = [...params.livingExpenses];
    updated[idx] = { ...updated[idx], [key]: Number(value) };
    setParams(prev => ({ ...prev, livingExpenses: updated }));
    setCalculated(false);
  };

  const addExpense = () => {
    setParams(prev => ({
      ...prev,
      livingExpenses: [...prev.livingExpenses, { fromAge: 87, monthly: 4000 }]
    }));
  };

  const removeExpense = (idx: number) => {
    setParams(prev => ({
      ...prev,
      livingExpenses: prev.livingExpenses.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '1.5rem',
      padding: '1.5rem',
      height: 'calc(100vh - 60px)',
      overflow: 'hidden'
    }}>

      {/* 왼쪽: 입력 패널 */}
      <div style={{
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          🎯 은퇴 계획 설정
        </h2>

        <Section title="📅 기간">
          <Row label="현재 나이">
            <Input type="number" value={params.currentAge}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('currentAge', +e.target.value)} />
          </Row>
          <Row label="은퇴 나이">
            <Input type="number" value={params.retireAge}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('retireAge', +e.target.value)} />
          </Row>
          <Row label="시뮬레이션 종료 나이">
            <Input type="number" value={params.endAge}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('endAge', +e.target.value)} />
          </Row>
        </Section>

        <Section title="💼 투자 계좌">
          <Row label="현재 잔액 ($)">
            <Input type="number" step={10000} value={params.portfolioBalance}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('portfolioBalance', +e.target.value)} />
          </Row>
          <Row label="연 수익률 (%)">
            <Input type="number" step={0.5} value={params.annualReturn}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('annualReturn', +e.target.value)} />
          </Row>
          <Row label="은퇴 후 출금률 (%)">
            <Input type="number" step={0.5} value={params.withdrawalRate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('withdrawalRate', +e.target.value)} />
          </Row>
        </Section>

        <Section title="🏛️ Social Security">
          <Row label="수령 시작 나이">
            <Input type="number" value={params.ssStartAge}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('ssStartAge', +e.target.value)} />
          </Row>
          <Row label="월 수령액 ($)">
            <Input type="number" step={100} value={params.ssMonthly}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('ssMonthly', +e.target.value)} />
          </Row>
          <Row label="COLA (%)">
            <Input type="number" step={0.1} value={params.ssCola}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('ssCola', +e.target.value)} />
          </Row>
        </Section>

        <Section title="🏠 생활비 (나이 구간별)">
          {params.livingExpenses.map((e, idx) => (
            <div key={idx} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '6px',
              marginBottom: '6px',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  시작 나이
                </div>
                <Input type="number" value={e.fromAge}
                  onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setExpense(idx, 'fromAge', ev.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  월 생활비 ($)
                </div>
                <Input type="number" step={500} value={e.monthly}
                  onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setExpense(idx, 'monthly', ev.target.value)} />
              </div>
              <button
                onClick={() => removeExpense(idx)}
                style={{
                  marginTop: '14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-danger)',
                  fontSize: '16px'
                }}
              >✕</button>
            </div>
          ))}
          <button
            onClick={addExpense}
            style={{
              width: '100%',
              padding: '6px',
              background: 'none',
              border: '0.5px dashed var(--color-border-tertiary)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'var(--color-text-secondary)'
            }}
          >
            + 구간 추가
          </button>
        </Section>

        <Section title="📈 인플레이션">
          <Row label="연 인플레이션 (%)">
            <Input type="number" step={0.1} value={params.inflation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('inflation', +e.target.value)} />
          </Row>
        </Section>

        <button
          onClick={() => setCalculated(true)}
          style={{
            width: '100%',
            padding: '14px',
            background: 'var(--color-text-success)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius-md)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          📊 시뮬레이션 시작
        </button>
      </div>

      {/* 오른쪽: 결과 */}
      <div style={{
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {!result ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--color-text-tertiary)',
            fontSize: '14px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
            <p>설정 후 시뮬레이션을 시작하세요.</p>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px'
            }}>
              <SummaryCard
                label="최종 자산"
                value={fmt(result.summary.finalBalance)}
                color={result.summary.finalBalance > 0
                  ? 'var(--color-text-success)'
                  : 'var(--color-text-danger)'}
              />
              <SummaryCard
                label="현금 부족 나이"
                value={result.summary.shortfallAge
                  ? `${result.summary.shortfallAge}세`
                  : '없음 ✅'}
                color={result.summary.shortfallAge
                  ? 'var(--color-text-danger)'
                  : 'var(--color-text-success)'}
              />
              <SummaryCard
                label="총 SS 수령액"
                value={fmt(result.summary.totalSS)}
                color="var(--color-text-info)"
              />
              <SummaryCard
                label="안전 구간"
                value={`${result.summary.safetyRate}%`}
                color={result.summary.safetyRate > 80
                  ? 'var(--color-text-success)'
                  : result.summary.safetyRate > 50
                  ? 'var(--color-text-warning)'
                  : 'var(--color-text-danger)'}
              />
            </div>

            <div style={{
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-lg)',
              padding: '1rem'
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '13px', fontWeight: '500' }}>
                📈 자산 추이
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={result.rows}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="age"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${v}세`}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      fmt(value),
                      name === 'balance' ? '잔액' :
                      name === 'livingExpense' ? '생활비' : 'SS 수령'
                    ]}
                    labelFormatter={(v: number) => `${v}세 (${params.currentYear + v - params.currentAge}년)`}
                  />
                  <Legend
                    formatter={(v: string) =>
                      v === 'balance' ? '자산 잔액' :
                      v === 'livingExpense' ? '생활비' : 'SS 수령액'
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#colorBalance)"
                  />
                  <Area
                    type="monotone"
                    dataKey="livingExpense"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#colorExpense)"
                  />
                  <Area
                    type="monotone"
                    dataKey="ssAnnual"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    fill="none"
                    strokeDasharray="4 2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-lg)',
              padding: '1rem',
              overflowX: 'auto'
            }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '13px', fontWeight: '500' }}>
                📋 연도별 상세
              </h3>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                    {['나이', '년도', '수익', '출금', 'SS', '생활비', '현금흐름', '잔액'].map(h => (
                      <th key={h} style={{
                        padding: '8px 6px',
                        textAlign: 'right',
                        fontWeight: '500',
                        color: 'var(--color-text-secondary)'
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '0.5px solid var(--color-border-tertiary)',
                        background: row.netCashFlow < 0
                          ? 'rgba(239,68,68,0.05)'
                          : row.age === params.retireAge
                          ? 'rgba(59,130,246,0.05)'
                          : 'transparent'
                      }}
                    >
                      <td style={{ padding: '6px', textAlign: 'right' }}>
                        {row.age === params.retireAge
                          ? <b style={{ color: 'var(--color-text-info)' }}>{row.age}세 🏖️</b>
                          : `${row.age}세`}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{row.year}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-success)' }}>
                        {fmt(row.annualGain)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{fmt(row.withdrawal)}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-info)' }}>
                        {fmt(row.ssAnnual)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-danger)' }}>
                        {fmt(row.livingExpense)}
                      </td>
                      <td style={{
                        padding: '6px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: row.netCashFlow >= 0
                          ? 'var(--color-text-success)'
                          : 'var(--color-text-danger)'
                      }}>
                        {fmt(row.netCashFlow)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: '500' }}>
                        {fmt(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '1rem'
    }}>
      <p style={{ margin: '0 0 0.8rem', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px'
    }}>
      <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{label}</label>
      <div style={{ width: '120px' }}>{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '5px 8px',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '4px',
        background: 'var(--color-background-primary)',
        color: 'var(--color-text-primary)',
        fontSize: '12px',
        textAlign: 'right',
        boxSizing: 'border-box'
      }}
    />
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '1rem'
    }}>
      <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color }}>
        {value}
      </p>
    </div>
  );
}
