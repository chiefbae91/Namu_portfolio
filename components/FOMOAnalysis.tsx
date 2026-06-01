'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface FomoTicker {
  ticker: string;
  buyCount: number;
  avgFomoRatio: number;
  observedHigh: number;
  avgBuyPrice: number;
  avgPnlPct: number | null;
}

export interface FomoScoreData {
  score: number;
  detail: string;
  recommendation: string | null;
  level: string;
  levelNum: number;
  totalBuys: number;
  fomoTickers: FomoTicker[];
  expectedImprovement: { targetScore: number; winRateGain: number; avgGainBoost: number };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 76) return '#ef4444';
  if (score >= 51) return '#f97316';
  if (score >= 21) return '#f59e0b';
  return '#10b981';
}

function levelBg(levelNum: number) {
  const map: Record<number, string> = { 1: '#10b98122', 2: '#f59e0b22', 3: '#f9730622', 4: '#ef444422' };
  return map[levelNum] ?? '#f59e0b22';
}

function ScoreGauge({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const cx = size / 2;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = scoreColor(score);
  return (
    <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
      <path d={`M 6,${size / 2} A ${r},${r} 0 0 1 ${size - 6},${size / 2}`}
        fill="none" stroke="var(--border)" strokeWidth={9} strokeLinecap="round" />
      <path d={`M 6,${size / 2} A ${r},${r} 0 0 1 ${size - 6},${size / 2}`}
        fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={cx} y={size / 2 + 2} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{score}</text>
      <text x={cx} y={size / 2 + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">/100</text>
    </svg>
  );
}

const LEVEL_INFO = [
  {
    range: '0~20점',
    title: '신중한 투자자',
    color: '#10b981',
    items: ['저점에서 체계적으로 매수', '인내심이 뛰어남', '충동 매수 거의 없음'],
    advice: '현재 방식을 유지하세요.',
  },
  {
    range: '21~50점',
    title: '적절한 수준',
    color: '#f59e0b',
    items: ['균형 잡힌 거래 습관', '약간의 고점 매수 경향', '소폭 개선 여지 있음'],
    advice: '저점 진입 비중을 조금 더 늘리면 됩니다.',
  },
  {
    range: '51~75점',
    title: '높은 수준 (주의)',
    color: '#f97316',
    items: ['고점 근처에서 자주 매수', '손실 거래가 많을 가능성', '즉시 개선 필요'],
    advice: '매수 전 기술 분석 확인, 조정 후 진입 습관을 들이세요.',
  },
  {
    range: '76~100점',
    title: '매우 높음 (위험!)',
    color: '#ef4444',
    items: ['거의 모든 거래가 고점 매수', '충동적인 거래 스타일', '장기 손실 누적 위험'],
    advice: '분할 매수 전략 도입, 1시간 대기 후 거래 규칙 적용 권장.',
  },
];

const IMPROVEMENT_TIPS = [
  {
    title: '분석 기반 거래',
    items: ['매수 전 기술 분석 수행', '저점 확인 후 매수', '목표가 미리 설정'],
  },
  {
    title: '대기 시간 늘리기',
    items: ['고점에서 최소 3~5일 대기', '조정 기간을 기다리기', '20일 이동평균선 아래에서 매수'],
  },
  {
    title: '포지션 크기 관리',
    items: ['첫 진입: 전체의 30%만', '저점 재확인 후 추가 매수', '분할 매수 전략 활용'],
  },
  {
    title: '감정 제어',
    items: ['매수/매도 규칙 문서화', '충동적 거래 금지 규칙', '1시간 대기 후 거래'],
  },
  {
    title: '패턴 인식',
    items: ['추격매수 vs 저점 분석', '자신의 패턴 인식', '실수 기록 및 검토'],
  },
];

// ── main component ────────────────────────────────────────────────────────────

export default function FOMOAnalysis({
  data,
  winRate,
}: {
  data: FomoScoreData;
  winRate: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(data.score);
  const currentLevel = LEVEL_INFO[data.levelNum - 1] ?? LEVEL_INFO[1];

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid var(--border)`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* ── Score header ── */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreGauge score={data.score} size={100} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>A. FOMO (추격매수) 점수</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: levelBg(data.levelNum), color,
          }}>
            {data.level}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
            분석 대상 {data.totalBuys}건 매수 거래
          </div>
          {data.recommendation && (
            <div style={{ fontSize: 12, color, marginTop: 4, lineHeight: 1.4, fontWeight: 500 }}>
              {data.recommendation}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'var(--border)', color: 'var(--text)',
            flexShrink: 0,
          }}
        >
          {expanded ? <><ChevronUp size={13} /> 접기</> : <><ChevronDown size={13} /> 상세보기</>}
        </button>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>

          {/* FOMO 설명 */}
          <div style={{
            background: 'var(--bg)', borderRadius: 8, padding: '14px 16px', marginBottom: 20,
            borderLeft: `3px solid ${color}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>FOMO란?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              <strong>Fear Of Missing Out</strong>의 약자로, 상승 기회를 놓칠까 봐 고점 근처에서 충동적으로 매수하는 행태입니다.<br />
              {data.score >= 51 && (
                <>
                  현재 FOMO 점수가 높다는 것은:<br />
                  • 최근 고점 이후 매수하는 경향이 있습니다<br />
                  • 충동적인 거래 결정이 많습니다<br />
                  • 장기적으로 손실률이 높아질 수 있습니다
                </>
              )}
              {data.score <= 50 && (
                <>
                  낮은 FOMO 점수는 저점 근처에서 체계적으로 진입하고 있음을 뜻합니다.<br />
                  이 습관을 유지하면 장기적으로 유리한 진입 단가를 확보할 수 있습니다.
                </>
              )}
            </div>
          </div>

          {/* 종목별 FOMO 테이블 */}
          {data.fomoTickers.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>종목별 FOMO 분석</div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>종목</th>
                      <th style={{ textAlign: 'right' }}>매수횟수</th>
                      <th style={{ textAlign: 'right' }}>평균매수가</th>
                      <th style={{ textAlign: 'right' }}>관찰최고가</th>
                      <th style={{ textAlign: 'right' }}>FOMO점수</th>
                      <th style={{ textAlign: 'right' }}>실현수익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fomoTickers.map(t => {
                      const fc = scoreColor(t.avgFomoRatio);
                      return (
                        <tr key={t.ticker}>
                          <td style={{ fontWeight: 600 }}>{t.ticker}</td>
                          <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{t.buyCount}건</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            ${t.avgBuyPrice.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            ${t.observedHigh.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ color: fc, fontWeight: 700 }}>{t.avgFomoRatio}점</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {t.avgPnlPct !== null ? (
                              <span style={{ color: t.avgPnlPct >= 0 ? 'var(--color-price-up)' : 'var(--color-price-down)', fontWeight: 600 }}>
                                {t.avgPnlPct >= 0 ? '+' : ''}{t.avgPnlPct.toFixed(2)}%
                              </span>
                            ) : <span style={{ color: 'var(--muted)' }}>보유중</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, opacity: 0.7 }}>
                * FOMO점수: 해당 종목의 관찰 가격 범위에서 매수가의 위치 (0=저점, 100=고점)
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
                    <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 6, fontStyle: 'italic' }}>
                      → {lv.advice}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 개선 방법 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 FOMO 점수 개선 방법</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {IMPROVEMENT_TIPS.map((tip, i) => (
                <div key={tip.title} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
                    {i + 1}. {tip.title}
                  </div>
                  {tip.items.map(item => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>• {item}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 예상 개선 효과 */}
          {data.score >= 40 && (
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📈 개선 시 예상 효과</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>현재 상태</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    FOMO 점수: <strong style={{ color }}>{data.score}점</strong>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    승률: <strong>{winRate.toFixed(1)}%</strong>
                  </div>
                </div>
                <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>개선 목표 달성 시</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    FOMO 점수: <strong style={{ color: '#10b981' }}>{data.expectedImprovement.targetScore}점</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>
                      ({data.score - data.expectedImprovement.targetScore}점 감소)
                    </span>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    예상 승률: <strong style={{ color: '#10b981' }}>
                      {(winRate + data.expectedImprovement.winRateGain).toFixed(1)}%
                    </strong>
                    <span style={{ fontSize: 11, color: '#10b981', marginLeft: 4 }}>
                      (+{data.expectedImprovement.winRateGain.toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    평균 수익 향상: <strong style={{ color: '#10b981' }}>
                      +{data.expectedImprovement.avgGainBoost.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, opacity: 0.7 }}>
                ⚠ 예상 수치는 과거 거래 패턴 기반 추정이며 실제 결과와 다를 수 있습니다.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
