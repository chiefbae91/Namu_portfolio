'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, PiggyBank } from 'lucide-react';
import RetirementWithdrawalPlanner from '@/components/RetirementWithdrawalPlanner';

export default function RetirementPlannerPage() {
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { window.location.href = '/login'; return; }
      setUser({ email: u.email || '' });
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 60px', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--header-bg)', borderBottom: '1px solid var(--border)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
          <ArrowLeft size={15} /> 홈
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <PiggyBank size={18} color="var(--accent)" />
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>은퇴 인출 계획 시뮬레이터</h1>
        <div style={{ flex: 1 }} />
        {user && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user.email}</span>}
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        {user && <RetirementWithdrawalPlanner />}
      </div>
    </div>
  );
}
