'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Account } from '@/lib/types';
import { BarChart2, ArrowLeft, RefreshCw } from 'lucide-react';
import FOMOAnalysis, { FomoScoreData } from '@/components/FOMOAnalysis';
import StopLossAnalysis, { StopLossData } from '@/components/StopLossAnalysis';
import ConcentrationAnalysis, { ConcentrationData } from '@/components/ConcentrationAnalysis';
import ReturnPrediction, { ReturnPredictionData } from '@/components/ReturnPrediction';
import TaxEfficiencyAnalysis, { TaxEfficiencyData } from '@/components/TaxEfficiencyAnalysis';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  summary: {
    totalTxCount: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    totalPnlPct: number;
  };
  fomoScore: FomoScoreData;
  stopLossScore: StopLossData;
  concentration: ConcentrationData;
  tradingStyle: {
    type: string;
    similarity: Record<string, number>;
    description: string;
    avgHoldDays: number;
    tradesPerMonth: number;
    winRate: number;
  };
  taxEfficiency: TaxEfficiencyData;
  returnPrediction: ReturnPredictionData;
  recommendations: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPct(n: number, decimals = 2) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

function fmtUSD(n: number, showSign = true): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatted = `$${str}`;
  if (!showSign) return formatted;
  return n >= 0 ? `+${formatted}` : `-${formatted}`;
}

function scoreColor(score: number, invert = false) {
  const s = invert ? 100 - score : score;
  if (s >= 70) return '#10b981';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

// ── ScoreGauge ────────────────────────────────────────────────────────────────

function ScoreGauge({ score, invert = false, size = 90 }: { score: number; invert?: boolean; size?: number }) {
  const pct = score / 100;
  const r   = (size - 10) / 2;
  const cx  = size / 2;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct);
  const color = scoreColor(score, invert);
  return (
    <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
      <path d={`M 5,${size / 2} A ${r},${r} 0 0 1 ${size - 5},${size / 2}`}
        fill="none" stroke="var(--border)" strokeWidth={8} strokeLinecap="round" />
      <path d={`M 5,${size / 2} A ${r},${r} 0 0 1 ${size - 5},${size / 2}`}
        fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transform: 'none', transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={cx} y={size / 2 + 2} textAnchor="middle" fontSize={20} fontWeight={700} fill={color}>{score}</text>
      <text x={cx} y={size / 2 + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">/100</text>
    </svg>
  );
}

// ── ScoreCard ─────────────────────────────────────────────────────────────────

function ScoreCard({
  title, score, invert = false, detail, extra, invertGauge,
}: {
  title: string; score: number; invert?: boolean; detail: string; extra?: React.ReactNode; invertGauge?: boolean;
}) {
  const color = scoreColor(score, invert);
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      minWidth: 180,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'center', marginBottom: 4 }}>{title}</div>
      <ScoreGauge score={score} invert={invertGauge ?? invert} />
      <div style={{ fontSize: 11, color, fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{detail}</div>
      {extra && <div style={{ marginTop: 6, width: '100%' }}>{extra}</div>}
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '14px 18px', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── StyleBar ──────────────────────────────────────────────────────────────────

function StyleBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, value);
  const color = pct >= 60 ? '#6366f1' : pct >= 30 ? '#8b5cf6' : 'var(--border)';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
        <div style={{ height: 6, borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { window.location.href = '/login'; return; }
      setUser({ email: u.email || '' });

      const res = await fetch('/api/accounts');
      if (res.ok) {
        const accts: Account[] = await res.json();
        const visible = accts.filter(a => !a.hidden);
        setAccounts(visible);
        const saved = localStorage.getItem('analysis_selected_accounts');
        if (saved) {
          try {
            const ids = JSON.parse(saved) as string[];
            const validIds = ids.filter(id => visible.some(a => String(a.id) === id));
            setSelected(new Set(validIds.length ? validIds : visible.map(a => String(a.id))));
          } catch { setSelected(new Set(visible.map(a => String(a.id)))); }
        } else {
          setSelected(new Set(visible.map(a => String(a.id))));
        }
      }
    })();
  }, []);

  const saveSelection = useCallback((sel: Set<string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem('analysis_selected_accounts', JSON.stringify([...sel]));
    }, 300);
  }, []);

  const toggleAll = () => {
    const allIds = accounts.map(a => String(a.id));
    const isAll = allIds.every(id => selected.has(id));
    const next = isAll ? new Set<string>() : new Set(allIds);
    setSelected(next);
    saveSelection(next);
  };

  const toggleAccount = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    saveSelection(next);
  };

  const runAnalysis = useCallback(async () => {
    if (selected.size === 0) { setError('계좌를 1개 이상 선택하세요.'); return; }
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const res = await fetch('/api/advanced-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: [...selected] }),
      });
      if (!res.ok) { setError('분석 중 오류가 발생했습니다.'); return; }
      const data = await res.json();
      if (data.empty) { setError('선택된 계좌에 거래 내역이 없습니다.'); return; }
      setResult(data);
    } catch {
      setError('분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const allSelected = accounts.length > 0 && accounts.every(a => selected.has(String(a.id)));

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
        <BarChart2 size={18} color="var(--accent)" />
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>거래 성향 분석</h1>
        <div style={{ flex: 1 }} />
        {user && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user.email}</span>}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Account Selector */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>계좌 선택</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
              전체 선택
            </label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {accounts.map(a => {
              const id = String(a.id);
              const on = selected.has(id);
              return (
                <label key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: on ? 600 : 400,
                  background: on ? 'var(--accent)' : 'var(--border)',
                  color: on ? 'white' : 'var(--muted)',
                  transition: 'background 0.15s',
                }}>
                  <input type="checkbox" checked={on} onChange={() => toggleAccount(id)} style={{ display: 'none' }} />
                  {a.name}
                </label>
              );
            })}
            {accounts.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>계좌 로딩 중…</span>}
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={runAnalysis}
              disabled={loading || selected.size === 0}
              style={{
                background: 'var(--accent)', color: 'white', padding: '8px 20px',
                fontSize: 13, fontWeight: 700, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 6,
                opacity: loading || selected.size === 0 ? 0.6 : 1,
                cursor: loading || selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? <><RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> 분석 중…</>
                : '분석 시작'}
            </button>
            {selected.size > 0 && !loading && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{selected.size}개 계좌 선택됨</span>
            )}
          </div>
          {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 14px',
              border: '4px solid var(--border)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.7s linear infinite',
            }} />
            <div style={{ fontSize: 14 }}>거래 데이터를 분석하고 있습니다…</div>
          </div>
        )}

        {!loading && !result && hasRun && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
            분석 결과가 없습니다. 계좌를 선택하고 분석을 시작하세요.
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <SummaryCard label="총 거래 횟수" value={`${result.summary.totalTrades}건`}
                sub={`총 거래내역 ${result.summary.totalTxCount}건`} />
              <SummaryCard
                label="승률"
                value={`${result.summary.winRate.toFixed(2)}%`}
                sub={`수익 ${result.summary.winningTrades}건 / 손실 ${result.summary.losingTrades}건`}
                color={result.summary.winRate >= 50 ? 'var(--color-price-up)' : 'var(--color-price-down)'}
              />
              <SummaryCard
                label="실현 손익"
                value={fmtUSD(result.summary.totalPnl)}
                sub={`${fmtPct(result.summary.totalPnlPct)} 투자 대비`}
                color={result.summary.totalPnl >= 0 ? 'var(--color-price-up)' : 'var(--color-price-down)'}
              />
              <SummaryCard
                label="평균 보유 기간"
                value={`${Math.round(result.tradingStyle.avgHoldDays)}일`}
                sub={`월 평균 ${result.tradingStyle.tradesPerMonth.toFixed(1)}회 거래`}
              />
            </div>

            {/* A. FOMO — full expandable card */}
            <div style={{ marginBottom: 12 }}>
              <FOMOAnalysis data={result.fomoScore} winRate={result.summary.winRate} />
            </div>

            {/* B. Stop-loss — full expandable card */}
            <div style={{ marginBottom: 12 }}>
              <StopLossAnalysis data={result.stopLossScore} />
            </div>

            {/* C. Concentration — full expandable card */}
            <div style={{ marginBottom: 20 }}>
              <ConcentrationAnalysis data={result.concentration} />
            </div>

            {/* E. Tax Efficiency — full expandable card */}
            <div style={{ marginBottom: 20 }}>
              <TaxEfficiencyAnalysis data={result.taxEfficiency} />
            </div>

            {/* D + F: Style + Return Prediction */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>

              {/* D. Trading Style */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>D. 거래 스타일 분류</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                  {result.tradingStyle.type}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  {result.tradingStyle.description}
                </div>
                {Object.entries(result.tradingStyle.similarity).map(([type, pct]) => (
                  <StyleBar key={type} label={type} value={pct} />
                ))}
                <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)' }}>
                  <span>평균 보유 {Math.round(result.tradingStyle.avgHoldDays)}일</span>
                  <span>월 {result.tradingStyle.tradesPerMonth.toFixed(1)}회</span>
                  <span>승률 {result.tradingStyle.winRate.toFixed(2)}%</span>
                </div>
              </div>

              {/* F. Return Prediction — full expandable card */}
              {result.returnPrediction.confidence > 0 ? (
                <ReturnPrediction data={result.returnPrediction} />
              ) : (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>F. 장기 수익률 예측</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    예측에 필요한 거래 데이터가 부족합니다. (최소 3건 필요)
                  </div>
                </div>
              )}
            </div>


            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>💡 개선 권고사항</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.recommendations.map((rec, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', borderRadius: 7,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                        {rec.includes('우수') || rec.includes('유지') ? '✅'
                          : rec.includes('필요') || rec.includes('높습니다') || rec.includes('권장') ? '⚠️' : 'ℹ️'}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              textAlign: 'center', fontSize: 11, color: 'var(--muted)', opacity: 0.6, lineHeight: 1.7,
            }}>
              모든 분석은 실현된 거래 데이터를 기반으로 하며 투자 조언이 아닙니다.<br />
              과거 거래 성과가 미래 수익을 보장하지 않습니다.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
