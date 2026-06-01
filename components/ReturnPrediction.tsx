'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ReturnScenario {
  label: string;
  monthlyRate: number;
  yearlyPct: number;
  fiveYearPct: number;
  tenYearPct: number;
  riskLevel: string;
}

export interface MonthlyProjectionRow {
  months: number;
  label: string;
  cumulativePct: number;
  multiplier: number;
}

export interface ReturnPredictionData {
  currentPnlPct: number;
  currentPnl: number;
  monthlyExpected: number;
  yearlyExpected: number;
  fiveYearExpected: number;
  tenYearExpected: number;
  confidence: number;
  winRate: number;
  avgGainPct: number;
  avgLossPct: number;
  tradesPerMonth: number;
  dataStartDate: string;
  dataEndDate: string;
  dataMonths: number;
  netMonthlyWin: number;
  netMonthlyLoss: number;
  scenarios: ReturnScenario[];
  projections: MonthlyProjectionRow[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function p(n: number, d = 2) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
}

function pctColor(n: number) {
  if (n > 0) return 'var(--color-price-up)';
  if (n < 0) return 'var(--color-price-down)';
  return 'var(--muted)';
}

function confidenceColor(c: number) {
  if (c >= 70) return '#10b981';
  if (c >= 50) return '#f59e0b';
  return '#ef4444';
}

const SCENARIO_COLORS: Record<string, string> = {
  '보수적': '#60a5fa',
  '중립':   '#10b981',
  '공격적': '#f97316',
};

// ── main component ────────────────────────────────────────────────────────────

export default function ReturnPrediction({ data }: { data: ReturnPredictionData }) {
  const [expanded, setExpanded] = useState(false);
  const conf = data.confidence;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>

        {/* Key figures */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, flex: 1 }}>
          {[
            { label: '실현 수익률',     value: p(data.currentPnlPct) },
            { label: '월 예상',         value: p(data.monthlyExpected) },
            { label: '1년 예상',         value: p(data.yearlyExpected) },
            { label: '5년 예상 (복리)', value: p(data.fiveYearExpected) },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 7, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(parseFloat(item.value)) }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Confidence + expand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 8, padding: '8px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>신뢰도</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: confidenceColor(conf) }}>
              {conf.toFixed(2)}%
            </div>
          </div>
          <button onClick={() => setExpanded(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'var(--border)', color: 'var(--text)',
          }}>
            {expanded ? <><ChevronUp size={13} /> 접기</> : <><ChevronDown size={13} /> 상세보기</>}
          </button>
        </div>
      </div>

      {/* ── Expanded ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>

          {/* Core stats */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 핵심 통계</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--muted)' }}>데이터 기간</div>
                {[
                  { k: '분석 대상',  v: `${data.projections.length > 0 ? '—' : '—'} (closed trades)` },
                  { k: '데이터 기간', v: data.dataStartDate && data.dataEndDate ? `${data.dataStartDate} ~ ${data.dataEndDate} (${data.dataMonths}개월)` : '—' },
                  { k: '월간 거래',  v: `${data.tradesPerMonth.toFixed(2)}건` },
                  { k: '승률',       v: `${data.winRate.toFixed(2)}%` },
                ].map(r => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--muted)' }}>{r.k}</span>
                    <span style={{ fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--muted)' }}>수익 통계</div>
                {[
                  { k: '평균 수익',       v: p(data.avgGainPct),              c: 'var(--color-price-up)' },
                  { k: '평균 손실',       v: `−${data.avgLossPct.toFixed(2)}%`, c: 'var(--color-price-down)' },
                  { k: '순 월간 수익',    v: p(data.netMonthlyWin),           c: 'var(--color-price-up)' },
                  { k: '순 월간 손실',    v: `−${data.netMonthlyLoss.toFixed(2)}%`, c: 'var(--color-price-down)' },
                  { k: '월간 순 기대값', v: p(data.monthlyExpected),          c: pctColor(data.monthlyExpected) },
                ].map(r => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--muted)' }}>{r.k}</span>
                    <span style={{ fontWeight: 600, color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scenario analysis */}
          {data.scenarios.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📈 시나리오 분석</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {data.scenarios.map((sc, i) => {
                  const isNeutral = sc.label === '중립';
                  const color = SCENARIO_COLORS[sc.label] ?? '#10b981';
                  return (
                    <div key={sc.label} style={{
                      background: isNeutral ? `${color}15` : 'var(--bg)',
                      border: isNeutral ? `2px solid ${color}` : '1px solid var(--border)',
                      borderRadius: 9, padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>
                          {['【보수적】', '【중립】 ✅', '【공격적】'][i]}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>위험 {sc.riskLevel}</span>
                      </div>
                      {[
                        { label: '월간 수익', value: p(sc.monthlyRate) },
                        { label: '1년 예상',  value: p(sc.yearlyPct) },
                        { label: '5년 예상',  value: p(sc.fiveYearPct) },
                        { label: '10년 예상', value: p(sc.tenYearPct) },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                          <span style={{ fontWeight: 600, color: pctColor(parseFloat(item.value)) }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly projection table */}
          {data.projections.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📅 기간별 누적 수익률 예측</div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>기간</th>
                      <th style={{ textAlign: 'right' }}>누적 수익률</th>
                      <th style={{ textAlign: 'right' }}>배율</th>
                      <th style={{ textAlign: 'right' }}>$100,000 기준</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projections.map(row => (
                      <tr key={row.months}>
                        <td style={{ fontWeight: row.months === 12 || row.months === 60 ? 700 : 400 }}>
                          {row.label}
                        </td>
                        <td style={{
                          textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                          color: pctColor(row.cumulativePct),
                        }}>
                          {p(row.cumulativePct)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {row.multiplier.toFixed(4)}×
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: pctColor(row.cumulativePct), fontWeight: 600 }}>
                          ${(100000 * row.multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, opacity: 0.7 }}>
                * $100,000 가정, 월 복리 {data.monthlyExpected.toFixed(2)}% 적용
              </div>
            </div>
          )}

          {/* Confidence breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              신뢰도 {data.confidence.toFixed(2)}% 분석
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px 16px' }}>
              {[
                { label: '데이터 샘플 충분성', value: data.dataMonths >= 12 ? '충분함 ✅' : '부족 (12개월+ 권장)', ok: data.dataMonths >= 12 },
                { label: '데이터 기간',        value: `${data.dataMonths}개월`, ok: data.dataMonths >= 6 },
                { label: '외부 요인',          value: '미포함 (시장 변동, 경제 위기 등)', ok: false },
                { label: '스타일 변화 위험',   value: '미반영', ok: false },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 500, color: item.ok ? '#10b981' : '#f59e0b' }}>{item.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' }}>
                신뢰도 {data.confidence.toFixed(2)}%는 과거 패턴이 반복된다는 가정 하의 통계적 추정입니다.
                나머지 {(100 - data.confidence).toFixed(2)}%는 시장 변동, 거래 습관 변화, 외부 충격 등 예상치 못한 요인입니다.
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, padding: '12px 16px',
            fontSize: 11, color: 'var(--muted)', lineHeight: 1.7,
          }}>
            ⚠️ <strong>중요 고지:</strong> 예측은 과거 거래 성과 기반이므로 미래 수익을 보장하지 않습니다.
            경제 위기, 정책 변화, 개인의 거래 습관 변경, 시장 구조 변화 등 예상 외 요인이 발생할 수 있습니다.
            본 예측은 참고용이며 투자 조언이 아닙니다.
          </div>

        </div>
      )}
    </div>
  );
}
