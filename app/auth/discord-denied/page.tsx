'use client';

import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Suspense } from 'react';

function DeniedContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') ?? '디스코드 프리미엄 멤버만 접근이 가능합니다.';

  const handleLogout = async () => {
    await createClient().auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '40px 36px', width: '100%', maxWidth: 380,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>🚫</div>

        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
            접근 권한 없음
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        <div style={{
          background: 'var(--bg)', borderRadius: 8, padding: '14px 18px',
          fontSize: 12, color: 'var(--muted)', width: '100%',
        }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>필요 역할</p>
          <p style={{ margin: 0 }}>YouTube Member · premiumoption</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <a
            href="/api/auth/discord"
            style={{
              display: 'block', padding: '11px 0',
              background: '#5865F2', color: 'white', borderRadius: 8,
              fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none',
            }}
          >
            Discord 다시 인증
          </a>
          <button
            onClick={handleLogout}
            style={{
              padding: '11px 0', background: 'var(--border)', color: 'var(--muted)',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiscordDeniedPage() {
  return (
    <Suspense>
      <DeniedContent />
    </Suspense>
  );
}
