'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ConcentrationData {
  score: number;
  topHoldings: { ticker: string; pct: number }[];
  top3pct: number;
  top5pct: number;
  top10pct: number;
  totalTickers: number;
  hhi: number;
  levelNum: number;
  level: string;
  scenario: { top1impact: number; top3impact: number };
  detail: string;
  recommendation: string | null;
  expectedImprovement: { targetPct: number };
}

function levelColor(levelNum: number) {
  const m: Record<number, string> = { 1: '#64748b', 2: '#10b981', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };
  return m[levelNum] ?? '#f59e0b';
}
function levelBg(levelNum: number) {
  return `${levelColor(levelNum)}22`;
}

function ScoreGauge({ score, levelNum, size = 100 }: { score: number; levelNum: number; size?: number }) {
  const r = (size - 12) / 2, cx = size / 2;
  const circumference = Math.PI * r;
  const color = levelColor(levelNum);
  return (
    <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
      <path d={`M 6,${size/2} A ${r},${r} 0 0 1 ${size-6},${size/2}`}
        fill="none" stroke="var(--border)" strokeWidth={9} strokeLinecap="round" />
      <path d={`M 6,${size/2} A ${r},${r} 0 0 1 ${size-6},${size/2}`}
        fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={cx} y={size/2+2} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{score}</text>
      <text x={cx} y={size/2+16} textAnchor="middle" fontSize={10} fill="var(--muted)">/100</text>
    </svg>
  );
}

const LEVEL_INFO = [
  {
    range: '0~20% (과분산)', title: '종목 너무 많음', color: '#64748b', levelNum: 1,
    items: ['종목 40개 이상', '관리 어려움', '거래비용 증가'],
    advice: '우량주 10~15개로 집중하여 관리 효율성을 높이세요.',
  },
  {
    range: '21~40% (저집중도)', title: '적절 ✅', color: '#10b981', levelNum: 2,
    items: ['균형 잡힌 포트폴리오', '위험이 잘 분산', '관리하기 좋음'],
    advice: '추천: 현재 유지. 우량주 비중을 유지하세요.',
  },
  {
    range: '41~60% (중집중도)', title: '중간 수준', color: '#f59e0b', levelNum: 3,
    items: ['소수 종목에 치중', '일부 집중 위험 발생', '조정 권장'],
    advice: '하위 종목 일부를 청산하고 분산도를 높이세요.',
  },
  {
    range: '61~80% (고집중도)', title: '주의 필요', color: '#f97316', levelNum: 4,
    items: ['매우 집중된 투자', '종목 급락 시 큰 손실', '즉시 분산 필요'],
    advice: '상위 2~3개 종목 비중을 낮추고 다양한 섹터로 분산하세요.',
  },
  {
    range: '81~100% (극도집중)', title: '위험! 긴급 분산', color: '#ef4444', levelNum: 5,
    items: ['1~2개 종목에만 집중', '극도의 집중 위험', '한 종목 급락 = 포트폴리오 붕괴'],
    advice: '즉시 다른 종목으로 분산 투자하세요. 단일 종목 의존도를 낮추는 것이 최우선입니다.',
  },
];

const TIPS = [
  { title: '우량주 중심 유지', items: ['상위 3종목 집중력 유지', '개별 기업 리스크 모니터링', '추가 분산 전에 기존 종목 수익화'] },
  { title: '섹터별 분산 확인', items: ['기술주 집중 시 다른 섹터 추가', '경기방어주 포함 검토', '섹터 간 상관관계 확인'] },
  { title: '과도한 소액 종목 정리', items: ['비중 1% 미만 종목 청산 검토', '우량주 3~5개로 집중', '관리 효율성 향상'] },
  { title: '신규 진입 기준 설정', items: ['신규 종목: 전체의 5% 이상 금지', '소액으로 테스트 후 확대', '부실 종목 즉시 청산'] },
  { title: '분기별 리밸런싱', items: ['분기마다 비중 점검', 'Top 3 종목이 40% 초과 시 조정', '저수익 종목 정기 청산'] },
];

export default function ConcentrationAnalysis({ data }: { data: ConcentrationData }) {
  const [expanded, setExpanded] = useState(false);
  const color = levelColor(data.levelNum);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreGauge score={data.score} levelNum={data.levelNum} size={100} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>C. 집중투자 성향</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
            borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: levelBg(data.levelNum), color,
          }}>{data.level}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
            Top 3 = {data.top3pct.toFixed(2)}%
            &nbsp;·&nbsp; Top 5 = {data.top5pct.toFixed(2)}%
            &nbsp;·&nbsp; 총 {data.totalTickers}개 종목
          </div>
          {data.recommendation && (
            <div style={{ fontSize: 12, color, marginTop: 4, fontWeight: 500 }}>{data.recommendation}</div>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
          borderRadius: 6, fontSize: 12, fontWeight: 600,
          background: 'var(--border)', color: 'var(--text)', flexShrink: 0,
        }}>
          {expanded ? <><ChevronUp size={13} /> 접기</> : <><ChevronDown size={13} /> 상세보기</>}
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>

          {/* 설명 */}
          <div style={{
            background: 'var(--bg)', borderRadius: 8, padding: '14px 16px',
            borderLeft: `3px solid ${color}`, marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>집중투자 성향이란?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              포트폴리오가 <strong>특정 종목에 얼마나 집중</strong>되어 있는지 측정합니다.
              현재 Top 3 종목이 전체의 {data.top3pct.toFixed(1)}%를 차지합니다.
              {data.levelNum === 2 && (
                <><br />• 다양한 종목에 투자 중<br />• 위험이 분산되어 있음<br />• 균형 잡힌 포트폴리오</>
              )}
              {data.levelNum >= 4 && (
                <><br />• 소수 종목에 집중 → 한 종목 급락 시 큰 영향<br />
                • 분산 투자를 통해 리스크를 낮추는 것이 중요합니다</>
              )}
            </div>
          </div>

          {/* 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>집중도 통계</div>
              {[
                { label: 'Top 1 비중', value: `${data.topHoldings[0]?.pct.toFixed(2) ?? '—'}% (${data.topHoldings[0]?.ticker ?? '—'})` },
                { label: 'Top 3 비중', value: `${data.top3pct.toFixed(2)}%` },
                { label: 'Top 5 비중', value: `${data.top5pct.toFixed(2)}%` },
                { label: 'Top 10 비중', value: `${data.top10pct.toFixed(2)}%` },
                { label: '총 종목 수', value: `${data.totalTickers}개` },
                { label: 'Herfindahl Index', value: data.hhi.toFixed(4) },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.value}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, opacity: 0.7 }}>
                HHI: 낮을수록 분산도 높음 (0~1)
              </div>
            </div>

            {/* Scenario */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📊 시나리오 분석 (-20% 급락 시)</div>
              {[
                {
                  label: `${data.topHoldings[0]?.ticker ?? 'Top 1'} -20% 하락`,
                  impact: data.scenario.top1impact,
                  ok: Math.abs(data.scenario.top1impact) < 5,
                },
                {
                  label: `Top 3 동시 -20% 하락`,
                  impact: data.scenario.top3impact,
                  ok: Math.abs(data.scenario.top3impact) < 10,
                },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.ok ? '#f59e0b' : '#ef4444' }}>
                    {item.impact.toFixed(2)}%
                    <span style={{ fontSize: 12, marginLeft: 6, fontWeight: 400 }}>
                      포트폴리오 영향
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: item.ok ? '#10b981' : '#ef4444', marginTop: 2 }}>
                    {item.ok ? '✅ 견딜 수 있는 수준' : '⚠️ 큰 영향 — 분산 필요'}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7 }}>
                * 매수금액 비중 기반 추정
              </div>
            </div>
          </div>

          {/* Top 10 Holdings Table */}
          {data.topHoldings.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>포트폴리오 분포 (매수금액 기준 Top 10)</div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: 40 }}>순위</th>
                      <th style={{ textAlign: 'left' }}>종목</th>
                      <th style={{ textAlign: 'right' }}>비중</th>
                      <th style={{ textAlign: 'right', width: 120 }}>비중 바</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topHoldings.map((h, i) => {
                      const isTop3 = i < 3;
                      return (
                        <tr key={h.ticker}>
                          <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                          <td style={{ fontWeight: isTop3 ? 700 : 500, color: isTop3 ? color : 'var(--text)' }}>
                            {h.ticker}
                            {i === 0 && <span style={{ marginLeft: 6, fontSize: 10, color, background: `${color}22`, padding: '1px 5px', borderRadius: 3 }}>1위</span>}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {h.pct.toFixed(2)}%
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                              <div style={{
                                height: 6, borderRadius: 3,
                                background: isTop3 ? color : 'var(--accent)',
                                width: `${Math.min(100, h.pct / (data.topHoldings[0]?.pct || 1) * 100)}%`,
                                transition: 'width 0.8s ease',
                              }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {data.totalTickers > 10 && (
                      <tr>
                        <td style={{ color: 'var(--muted)' }}>11+</td>
                        <td style={{ color: 'var(--muted)' }}>기타 {data.totalTickers - 10}개 종목</td>
                        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                          {Math.max(0, 100 - data.top10pct).toFixed(2)}%
                        </td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 레벨별 특징 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>집중도 레벨별 특징</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 8 }}>
              {LEVEL_INFO.map(lv => {
                const isCurrent = lv.levelNum === data.levelNum;
                return (
                  <div key={lv.range} style={{
                    borderRadius: 8, padding: '12px 14px',
                    background: isCurrent ? `${lv.color}15` : 'var(--bg)',
                    border: isCurrent ? `2px solid ${lv.color}` : '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 10, color: lv.color, fontWeight: 700, marginBottom: 3 }}>
                      {lv.range} {isCurrent && '← 현재'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: lv.color, marginBottom: 6 }}>{lv.title}</div>
                    {lv.items.map(item => (
                      <div key={item} style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>• {item}</div>
                    ))}
                    <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 6, fontStyle: 'italic' }}>→ {lv.advice}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 개선 방법 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 집중투자 성향 개선 방법</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {TIPS.map((tip, i) => (
                <div key={tip.title} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{i + 1}. {tip.title}</div>
                  {tip.items.map(item => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>• {item}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 예상 개선 효과 */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📈 개선 시 예상 효과</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>현재 상태</div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>Top 3 비중: <strong style={{ color }}>{data.top3pct.toFixed(2)}%</strong></div>
                <div style={{ fontSize: 13 }}>총 종목 수: <strong>{data.totalTickers}개</strong></div>
              </div>
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>개선 목표</div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>
                  Top 3 목표: <strong style={{ color: '#10b981' }}>{data.expectedImprovement.targetPct.toFixed(1)}%</strong>
                  <span style={{ fontSize: 11, color: '#10b981', marginLeft: 4 }}>
                    (-{(data.top3pct - data.expectedImprovement.targetPct).toFixed(1)}% 감소)
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>
                  예상 효과: <strong style={{ color: '#10b981' }}>포트폴리오 안정성 향상</strong>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, opacity: 0.7 }}>
              ⚠ 예상 수치는 과거 데이터 기반 추정이며 실제 결과와 다를 수 있습니다.
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
