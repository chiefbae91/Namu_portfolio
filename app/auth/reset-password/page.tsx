'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

function getStrength(password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: '', color: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: '약함', color: '#ef4444' };
  if (score === 2) return { level: 2, label: '보통', color: '#f59e0b' };
  return { level: 3, label: '강함', color: '#10b981' };
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const strength = getStrength(password);
  const isMatch = confirm.length > 0 && password === confirm;
  const isMismatch = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    if (!done) return;
    const timer = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) {
          clearInterval(timer);
          window.location.href = '/login';
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [done]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setDone(true);
    }
  };

  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );

  if (done) {
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
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, background: 'rgba(16,185,129,0.15)',
            borderRadius: '50%', margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              비밀번호 변경 완료
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              비밀번호가 성공적으로 변경되었습니다.<br />
              {countdown}초 후 로그인 페이지로 이동합니다.
            </p>
          </div>
          <a
            href="/login"
            style={{
              display: 'block',
              padding: '11px 0',
              background: 'var(--accent)',
              color: 'white',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            지금 로그인하기
          </a>
        </div>
      </div>
    );
  }

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
            새 비밀번호 설정
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            새로운 비밀번호를 입력해 주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* New password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              새 비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="최소 6자 이상"
                required
                autoFocus
                style={{ fontSize: 14, padding: '10px 40px 10px 12px', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Password strength */}
            {password.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: strength.level >= n ? strength.color : 'var(--border)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              비밀번호 확인
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="비밀번호를 다시 입력"
                required
                style={{
                  fontSize: 14,
                  padding: '10px 40px 10px 12px',
                  width: '100%',
                  boxSizing: 'border-box',
                  borderColor: isMismatch ? '#ef4444' : isMatch ? '#10b981' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {isMatch && (
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                ✓ 비밀번호가 일치합니다
              </span>
            )}
            {isMismatch && (
              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                비밀번호가 일치하지 않습니다
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || isMismatch}
            style={{
              marginTop: 4,
              background: 'var(--accent)',
              color: 'white',
              padding: '11px 0',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              opacity: loading || isMismatch ? 0.6 : 1,
              cursor: loading || isMismatch ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '변경 중…' : '비밀번호 변경'}
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
      </div>
    </div>
  );
}
