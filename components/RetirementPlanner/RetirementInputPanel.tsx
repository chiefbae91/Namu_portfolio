'use client';

import React, { useState, useEffect } from 'react';
import { RetirementAccount, SocialSecurity, LivingExpense } from '@/lib/retirementCalculations';

export interface RetirementInputs {
  startYear: number;
  endYear: number;
  accounts: RetirementAccount[];
  socialSecurity: SocialSecurity;
  livingExpenses: LivingExpense[];
  inflationRate: number;
}

interface Props {
  initialAccounts: Array<{ id: string | number; name: string; totalValue: number }>;
  onCalculate: (inputs: RetirementInputs) => void;
  onReset: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 7px',
  borderRadius: 4,
  border: '0.5px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 11,
  boxSizing: 'border-box',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '1.25rem',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.6rem',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--muted)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg)',
  padding: '10px',
  borderRadius: 6,
  marginBottom: 6,
  border: '0.5px solid var(--border)',
};

export function RetirementInputPanel({ initialAccounts, onCalculate, onReset }: Props) {
  const [inputs, setInputs] = useState<RetirementInputs>({
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 35,
    accounts: [],
    socialSecurity: { startYear: new Date().getFullYear(), monthlyAmount: 2500, colaPercent: 2.5 },
    livingExpenses: [{ year: new Date().getFullYear(), amount: 80000 }],
    inflationRate: 2.5,
  });

  useEffect(() => {
    if (initialAccounts.length === 0) return;
    setInputs(prev => ({
      ...prev,
      accounts: initialAccounts.map(a => ({
        id: a.id,
        name: a.name,
        currentBalance: a.totalValue,
        annualReturn: 7.5,
        withdrawalStartYear: new Date().getFullYear(),
      })),
    }));
  }, [initialAccounts]);

  const updateAccount = (idx: number, field: keyof RetirementAccount, value: number) => {
    const updated = inputs.accounts.map((a, i) => i === idx ? { ...a, [field]: value } : a);
    setInputs(p => ({ ...p, accounts: updated }));
  };

  const updateExpense = (idx: number, field: keyof LivingExpense, value: number) => {
    const updated = inputs.livingExpenses.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    setInputs(p => ({ ...p, livingExpenses: updated }));
  };

  const addExpense = () => {
    const lastYear = Math.max(...inputs.livingExpenses.map(e => e.year));
    setInputs(p => ({ ...p, livingExpenses: [...p.livingExpenses, { year: lastYear + 5, amount: p.livingExpenses[p.livingExpenses.length - 1]?.amount ?? 80000 }] }));
  };

  const removeExpense = (idx: number) => {
    if (inputs.livingExpenses.length <= 1) return;
    setInputs(p => ({ ...p, livingExpenses: p.livingExpenses.filter((_, i) => i !== idx) }));
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 8,
      padding: '1.25rem',
      overflowY: 'auto',
      maxHeight: 'calc(100vh - 100px)',
    }}>
      <h2 style={{ margin: '0 0 1.25rem', fontSize: 15, fontWeight: 600 }}>설정 입력</h2>

      {/* 분석 기간 */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>📅 분석 기간</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>시작 년도</label>
            <input type="number" value={inputs.startYear} style={inputStyle}
              onChange={e => setInputs(p => ({ ...p, startYear: +e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>종료 년도</label>
            <input type="number" value={inputs.endYear} style={inputStyle}
              onChange={e => setInputs(p => ({ ...p, endYear: +e.target.value }))} />
          </div>
        </div>
      </div>

      {/* 계좌 설정 */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>💼 계좌 설정</p>
        {inputs.accounts.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>잔액 있는 계좌를 불러오는 중...</p>
        )}
        {inputs.accounts.map((acc, idx) => (
          <div key={idx} style={cardStyle}>
            <p style={{ margin: '0 0 7px', fontSize: 12, fontWeight: 500 }}>{acc.name}</p>
            <p style={{ margin: '0 0 7px', fontSize: 10, color: 'var(--muted)' }}>
              현재 잔액: ${acc.currentBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>연 수익률 (%)</label>
                <input type="number" step="0.1" value={acc.annualReturn} style={inputStyle}
                  onChange={e => updateAccount(idx, 'annualReturn', +e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>출금 시작 년도</label>
                <input type="number" value={acc.withdrawalStartYear} style={inputStyle}
                  onChange={e => updateAccount(idx, 'withdrawalStartYear', +e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Social Security */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>🏛️ Social Security</p>
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>수령 시작 년도</label>
              <input type="number" value={inputs.socialSecurity.startYear} style={inputStyle}
                onChange={e => setInputs(p => ({ ...p, socialSecurity: { ...p.socialSecurity, startYear: +e.target.value } }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>월 수령액 ($)</label>
              <input type="number" step="100" value={inputs.socialSecurity.monthlyAmount} style={inputStyle}
                onChange={e => setInputs(p => ({ ...p, socialSecurity: { ...p.socialSecurity, monthlyAmount: +e.target.value } }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>COLA (%)</label>
            <input type="number" step="0.1" value={inputs.socialSecurity.colaPercent} style={inputStyle}
              onChange={e => setInputs(p => ({ ...p, socialSecurity: { ...p.socialSecurity, colaPercent: +e.target.value } }))} />
          </div>
        </div>
      </div>

      {/* 생활비 */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <p style={{ ...sectionTitleStyle, margin: 0 }}>🏠 생활비 (5년 단위)</p>
          <button onClick={addExpense} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            + 추가
          </button>
        </div>
        {inputs.livingExpenses.map((exp, idx) => (
          <div key={idx} style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>시작 년도</label>
              <input type="number" value={exp.year} style={inputStyle}
                onChange={e => updateExpense(idx, 'year', +e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>연 생활비 ($)</label>
              <input type="number" step="1000" value={exp.amount} style={inputStyle}
                onChange={e => updateExpense(idx, 'amount', +e.target.value)} />
            </div>
            <button onClick={() => removeExpense(idx)} disabled={inputs.livingExpenses.length <= 1}
              style={{ fontSize: 10, padding: '5px 7px', background: 'none', color: 'var(--muted)', border: '0.5px solid var(--border)', borderRadius: 4, cursor: inputs.livingExpenses.length <= 1 ? 'not-allowed' : 'pointer' }}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 인플레이션 */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>📈 인플레이션 (%/년)</p>
        <input type="number" step="0.1" value={inputs.inflationRate} style={inputStyle}
          onChange={e => setInputs(p => ({ ...p, inflationRate: +e.target.value }))} />
      </div>

      {/* 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => onCalculate(inputs)} style={{
          padding: '9px', background: 'var(--green)', color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500
        }}>
          📊 계산
        </button>
        <button onClick={onReset} style={{
          padding: '9px', background: 'none', color: 'var(--muted)',
          border: '0.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12
        }}>
          🔄 초기화
        </button>
      </div>
    </div>
  );
}
