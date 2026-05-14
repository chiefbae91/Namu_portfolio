'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface MigrateResult {
  userId: string;
  results: Record<string, { updated: number | null; error: string | null }>;
}

export default function AdminPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return; }
      setUserId(user.id);
      setUserEmail(user.email ?? null);
    });
  }, []);

  const runMigration = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const sqlStatements = userId ? [
    {
      table: 'trading_hints',
      sql: `UPDATE trading_hints\nSET created_by = '${userId}'\nWHERE created_by IS NULL\n   OR created_by = '00000000-0000-0000-0000-000000000000';`,
    },
    {
      table: 'accounts',
      sql: `UPDATE accounts\nSET user_id = '${userId}'\nWHERE user_id IS NULL\n   OR user_id = '00000000-0000-0000-0000-000000000000';`,
    },
    {
      table: 'transactions',
      sql: `UPDATE transactions\nSET user_id = '${userId}'\nWHERE user_id IS NULL\n   OR user_id = '00000000-0000-0000-0000-000000000000';`,
    },
    {
      table: 'cash_flow',
      sql: `UPDATE cash_flow\nSET user_id = '${userId}'\nWHERE user_id IS NULL\n   OR user_id = '00000000-0000-0000-0000-000000000000';`,
    },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            Admin — Migrate User ID
          </h1>
          <a href="/" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
            ← Back to Portfolio
          </a>
        </div>

        {/* User Info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>
            LOGGED IN AS
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{userEmail ?? '...'}</div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em', marginTop: 4 }}>
            USER ID (복사해서 SQL Editor에 사용)
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 13,
            background: '#12151f',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span>{userId ?? '로딩 중...'}</span>
            {userId && (
              <button
                onClick={() => navigator.clipboard.writeText(userId)}
                style={{ background: 'var(--border)', color: 'var(--muted)', padding: '4px 10px', fontSize: 11 }}
              >
                복사
              </button>
            )}
          </div>
        </div>

        {/* Run Button */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              자동 실행 (API 방식)
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              accounts, transactions, cash_flow의 <code style={{ color: 'var(--accent)' }}>user_id</code>와
              trading_hints의 <code style={{ color: 'var(--accent)' }}>created_by</code>를 현재 유저 ID로 업데이트합니다.
            </div>
          </div>

          <button
            onClick={runMigration}
            disabled={running || !userId}
            style={{
              background: 'var(--accent)',
              color: 'white',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: 14,
              alignSelf: 'flex-start',
            }}
          >
            {running ? '실행 중...' : '▶ Update user_id 실행'}
          </button>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>결과</div>
              {Object.entries(result.results).map(([table, r]) => (
                <div key={table} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: '#12151f',
                  borderRadius: 6,
                  border: `1px solid ${r.error ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text)', flex: 1 }}>{table}</span>
                  {r.error
                    ? <span style={{ fontSize: 12, color: '#ef4444' }}>❌ {r.error}</span>
                    : <span style={{ fontSize: 12, color: '#10b981' }}>✅ {r.updated ?? 0}행 업데이트</span>
                  }
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual SQL */}
        {userId && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              수동 실행 — Supabase SQL Editor용
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Supabase 대시보드 → SQL Editor에서 아래 SQL을 직접 실행할 수 있습니다.
            </div>
            {sqlStatements.map(({ table, sql }) => (
              <div key={table} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    {table}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(sql)}
                    style={{ background: 'var(--border)', color: 'var(--muted)', padding: '3px 8px', fontSize: 11 }}
                  >
                    복사
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: '#12151f',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                }}>
                  {sql}
                </pre>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
