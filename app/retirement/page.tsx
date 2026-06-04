'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { RetirementInputPanel, RetirementInputs } from '@/components/RetirementPlanner/RetirementInputPanel';
import { RetirementResults } from '@/components/RetirementPlanner/RetirementResults';
import { calculateRetirementPlan, RetirementResult } from '@/lib/retirementCalculations';

interface AccountWithValue {
  id: string | number;
  name: string;
  totalValue: number;
}

export default function RetirementPage() {
  const [accounts, setAccounts] = useState<AccountWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RetirementResult | null>(null);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const [accountsRes, portfolioRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/portfolio'),
        ]);

        if (!accountsRes.ok || !portfolioRes.ok) { setLoading(false); return; }

        const accountsData = await accountsRes.json();
        const portfolioData = await portfolioRes.json();

        // account_breakdown: [{ account_id, account_name, cash, stock_value }]
        const breakdown: Array<{ account_id: string | number; cash: number; stock_value: number }> = portfolioData.account_breakdown ?? [];
        const accountValues: Record<string, number> = {};
        breakdown.forEach(b => {
          accountValues[String(b.account_id)] = (b.cash ?? 0) + (b.stock_value ?? 0);
        });

        const withValues: AccountWithValue[] = (accountsData as Array<{ id: string | number; name: string; hidden?: number | boolean }>)
          .filter(a => !a.hidden)
          .map(a => ({
            id: a.id,
            name: a.name,
            totalValue: accountValues[String(a.id)] ?? 0,
          }))
          .filter(a => a.totalValue > 0);

        setAccounts(withValues);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  const handleCalculate = (inputs: RetirementInputs) => {
    const r = calculateRetirementPlan({
      startYear: inputs.startYear,
      endYear: inputs.endYear,
      accounts: inputs.accounts,
      socialSecurity: inputs.socialSecurity,
      livingExpenses: inputs.livingExpenses,
      inflationRate: inputs.inflationRate,
    });
    setResult(r);
  };

  const handleReset = () => setResult(null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* 헤더 */}
      <header style={{
        height: 52,
        background: 'var(--header-bg)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.25rem',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/" style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <ArrowLeft size={14} /> 포트폴리오
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>🏖️ 은퇴 계획 시뮬레이터</span>
      </header>

      {/* 로딩 */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 52px)', color: 'var(--muted)', fontSize: 13 }}>
          계좌 데이터 로딩 중...
        </div>
      )}

      {/* 계좌 없음 */}
      {!loading && accounts.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 52px)', color: 'var(--muted)', textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: 32, margin: '0 0 10px' }}>💼</p>
            <p style={{ fontSize: 14, margin: '0 0 6px', color: 'var(--text)' }}>은퇴 계획 시뮬레이터</p>
            <p style={{ fontSize: 12, margin: 0 }}>잔액이 있는 계좌가 필요합니다.<br />포트폴리오에서 주식을 추가해주세요.</p>
          </div>
        </div>
      )}

      {/* 메인 레이아웃 */}
      {!loading && accounts.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1.25rem',
          padding: '1.25rem',
          maxWidth: 1400,
          margin: '0 auto',
          alignItems: 'start',
        }}>
          <RetirementInputPanel
            initialAccounts={accounts}
            onCalculate={handleCalculate}
            onReset={handleReset}
          />
          <RetirementResults
            plan={result?.plan ?? null}
            summary={result?.summary ?? null}
          />
        </div>
      )}
    </div>
  );
}
