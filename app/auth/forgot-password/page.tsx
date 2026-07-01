'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/api/auth/callback?next=/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent)',
            borderRadius: 12, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            비밀번호 찾기
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            가입한 이메일 주소를 입력하면<br />재설정 링크를 보내드립니다.
          </p>
        </div>

        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10,
              padding: '20px 16px',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📧</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                이메일을 전송했습니다
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text)' }}>{email}</strong>로<br />
                비밀번호 재설정 링크를 보냈습니다.<br />
                이메일을 확인해 주세요.
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              이메일이 오지 않으면 스팸 폴더를 확인하거나{' '}
              <button
                onClick={() => { setSent(false); setError(null); }}
                style={{ background: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0, cursor: 'pointer' }}
              >
                다시 시도
              </button>
              해 주세요.
            </p>
            <a
              href="/login"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '10px 0',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--muted)',
                textDecoration: 'none',
              }}
            >
              로그인으로 돌아가기
            </a>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  background: 'var(--accent)',
                  color: 'white',
                  padding: '11px 0',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {loading ? '전송 중…' : '재설정 링크 보내기'}
              </button>
            </form>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#ef4444',
                textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            <a
              href="/login"
              style={{
                display: 'block',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--muted)',
                textDecoration: 'none',
              }}
            >
              ← 로그인으로 돌아가기
            </a>
          </>
        )}
      </div>
    </div>
  );
}
