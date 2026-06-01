'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface StopLossData {
  score: number;
  avgLossPct: number;
  avgLossDays: number;
  maxLossPct: number;
  maxLossTicker: string;
  totalLossCount: number;
  totalTradeCount: number;
  cutoff: { within1d: number; within3d: number; within7d: number; over7d: number };
  worstTrades: { ticker: string; buyPrice: number; sellPrice: number; lossPct: number; holdDays: number }[];
  levelNum: number;
  level: string;
  detail: string;
  recommendation: string | null;
  expectedImprovement: { targetScore: number; lossReduction: number };
}

function scoreColor(score: number) {
  if (score >= 76) return '#10b981';
  if (score >= 51) return '#60a5fa';
  if (score >= 21) return '#f59e0b';
  return '#ef4444';
}
function levelBg(levelNum: number) {
  const m: Record<number, string> = { 4: '#10b98122', 3: '#60a5fa22', 2: '#f59e0b22', 1: '#ef444422' };
  return m[levelNum] ?? '#f59e0b22';
}

function ScoreGauge({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 12) / 2, cx = size / 2;
  const circumference = Math.PI * r;
  const color = scoreColor(score);
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

function CutoffBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--muted)' }}>{count}건 ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
        <div style={{ height: 6, borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

const LEVEL_INFO = [
  {
    range: '0~20점', title: '손절 능력 부족', color: '#ef4444',
    items: ['손실을 오래 보유', '평균 손실률 -5% 이상', '손실이 확대되는 경향'],
    advice: '모든 거래에 -3% 손절선을 설정하고 예외 없이 집행하세요.',
  },
  {
    range: '21~50점', title: '보통 수준', color: '#f59e0b',
    items: ['평균 손실률 -3~5%', '손절까지 5~10일', '일부 거래에서 과도 보유'],
    advice: '손절 기간을 3일 이내로 단축하는 훈련을 권장합니다.',
  },
  {
    range: '51~75점', title: '좋은 수준', color: '#60a5fa',
    items: ['평균 손실률 -2~3%', '손절까지 2~5일', '대부분 효율적으로 손절'],
    advice: '현재 방식을 유지하면서 최대 손실 거래를 줄이세요.',
  },
  {
    range: '76~100점', title: '우수 수준 (모범!)', color: '#10b981',
    items: ['평균 손실률 -1~2%', '손절까지 1~3일', '거의 모든 손실을 신속 처리'],
    advice: '추천: 현재 전략 유지. 손절 후 재진입 규칙도 체계화하세요.',
  },
];

const TIPS = [
  { title: '손절선 규칙화', items: ['모든 거래에 -2~3% 손절선 설정', '예외 없이 집행', '손절선 알림 설정'] },
  { title: '손절 기간 단축', items: ['목표: 평균 2일 이내', '초반 손실 시 즉시 검토', '보유 3일 경과 시 자동 검토'] },
  { title: '문제 거래 분석', items: ['최대 손실 거래 패턴 파악', '반복되는 실수 기록', '동일 패턴 재발 방지'] },
  { title: '손절 후 재진입', items: ['손절 후 최소 2주 대기', '심리적 회복 후 재진입', '같은 종목 재진입 시 규칙 강화'] },
  { title: '주간 손절 리뷰', items: ['매주 손실 거래 분석', '손절 규칙 준수 확인', '패턴 인식 및 교정'] },
];

export default function StopLossAnalysis({ data }: { data: StopLossData }) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(data.score);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreGauge score={data.score} size={100} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>B. 손절 능력 점수</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
            borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: levelBg(data.levelNum), color,
          }}>{data.level}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
            전체 {data.totalTradeCount}건 중 손실 {data.totalLossCount}건
            &nbsp;·&nbsp;평균 손실 {data.avgLossPct.toFixed(2)}%
            &nbsp;·&nbsp;평균 {Math.round(data.avgLossDays)}일
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
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>손절 능력이란?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              손실 거래에서 얼마나 <strong>빠르고 효율적으로 손실을 최소화</strong>하는지 측정합니다.
              {data.score >= 76 ? (
                <><br />현재 당신의 손절 능력이 우수하다는 것은:<br />
                • 손실을 빨리 인정하고 판매<br />• 손실이 확대되지 않도록 관리<br />• 포트폴리오 보호 능력이 뛰어남</>
              ) : data.score < 50 ? (
                <><br />현재 손절 능력을 개선하면:<br />
                • 같은 실수가 반복되는 손실 방지<br />• 큰 손실이 포트폴리오를 갉아먹는 상황 차단<br />• 심리적 부담 감소 및 다음 거래 집중력 향상</>
              ) : null}
            </div>
          </div>

          {/* 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>손절 통계</div>
              {[
                { label: '손실 거래 비중', value: `${data.totalLossCount}건 / ${data.totalTradeCount}건 (${data.totalTradeCount > 0 ? (data.totalLossCount / data.totalTradeCount * 100).toFixed(1) : 0}%)` },
                { label: '평균 손실률', value: `-${data.avgLossPct.toFixed(2)}%`, color: '#ef4444' },
                { label: '최대 손실', value: `-${data.maxLossPct.toFixed(2)}% (${data.maxLossTicker})`, color: '#ef4444' },
                { label: '평균 손절 기간', value: `${Math.round(data.avgLossDays)}일` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: item.color ?? 'var(--text)' }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>손절 타이밍 분포</div>
              <CutoffBar label="1일 내 손절" count={data.cutoff.within1d} total={data.totalLossCount} color="#10b981" />
              <CutoffBar label="3일 내 손절" count={data.cutoff.within3d} total={data.totalLossCount} color="#60a5fa" />
              <CutoffBar label="7일 내 손절" count={data.cutoff.within7d} total={data.totalLossCount} color="#f59e0b" />
              <CutoffBar label="7일 초과 보유" count={data.cutoff.over7d}  total={data.totalLossCount} color="#ef4444" />
            </div>
          </div>

          {/* 손실 거래 테이블 */}
          {data.worstTrades.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>손실 거래 상세 (손실 큰 순)</div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>종목</th>
                      <th style={{ textAlign: 'right' }}>매수가</th>
                      <th style={{ textAlign: 'right' }}>손절가</th>
                      <th style={{ textAlign: 'right' }}>손실률</th>
                      <th style={{ textAlign: 'right' }}>보유기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.worstTrades.map((t, i) => {
                      const isBig = Math.abs(t.lossPct) > 10 || t.holdDays > 14;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{t.ticker}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${t.buyPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${t.sellPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                            {t.lossPct.toFixed(2)}%
                            {isBig && <span style={{ marginLeft: 4, fontSize: 11 }}>⚠️</span>}
                          </td>
                          <td style={{ textAlign: 'right', color: t.holdDays > 7 ? '#ef4444' : 'var(--muted)' }}>
                            {t.holdDays}일
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, opacity: 0.7 }}>
                ⚠️ = 손실률 10% 초과 또는 보유기간 14일 초과
              </div>
            </div>
          )}

          {/* 레벨별 특징 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>점수 레벨별 특징</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {LEVEL_INFO.map((lv, i) => {
                const isCurrent = (i + 1) === data.levelNum;
                return (
                  <div key={lv.range} style={{
                    borderRadius: 8, padding: '12px 14px',
                    background: isCurrent ? `${lv.color}15` : 'var(--bg)',
                    border: isCurrent ? `2px solid ${lv.color}` : '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 11, color: lv.color, fontWeight: 700, marginBottom: 4 }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 손절 능력 개선 방법</div>
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
                <div style={{ fontSize: 13, marginBottom: 3 }}>손절 점수: <strong style={{ color }}>{data.score}점</strong></div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>평균 손실: <strong style={{ color: '#ef4444' }}>-{data.avgLossPct.toFixed(2)}%</strong></div>
                <div style={{ fontSize: 13 }}>평균 손절 기간: <strong>{Math.round(data.avgLossDays)}일</strong></div>
              </div>
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>개선 목표 달성 시</div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>
                  손절 점수: <strong style={{ color: '#10b981' }}>{data.expectedImprovement.targetScore}점</strong>
                  <span style={{ fontSize: 11, color: '#10b981', marginLeft: 4 }}>
                    (+{data.expectedImprovement.targetScore - data.score}점)
                  </span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>
                  평균 손실: <strong style={{ color: '#10b981' }}>
                    -{Math.max(0.5, data.avgLossPct - data.expectedImprovement.lossReduction).toFixed(2)}%
                  </strong>
                  {data.expectedImprovement.lossReduction > 0 && (
                    <span style={{ fontSize: 11, color: '#10b981', marginLeft: 4 }}>
                      (-{data.expectedImprovement.lossReduction.toFixed(2)}% 감소)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13 }}>
                  목표 손절 기간: <strong style={{ color: '#10b981' }}>
                    {Math.max(1, Math.round(data.avgLossDays * 0.7))}일
                  </strong>
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
