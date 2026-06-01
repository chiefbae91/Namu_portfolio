'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

export interface WashSaleEntry {
  ticker: string;
  sellDate: string;
  loss: number;
  buysInWindow: { date: string; quantity: number; price: number; daysFromSell: number }[];
}

export interface TaxEfficiencyData {
  score: number;
  longTermPct: number;
  shortTermPct: number;
  longTermCount: number;
  shortTermCount: number;
  longTermGains: number;
  longTermLosses: number;
  shortTermGains: number;
  shortTermLosses: number;
  estimatedTax: number;
  potentialSavings: number;
  deductibleLoss: number;
  washSales: WashSaleEntry[];
  detail: string;
  recommendation: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${str}` : `$${str}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '' : ''}${n.toFixed(2)}%`;
}

function scoreColor(score: number) {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function ScoreGauge({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 12) / 2, cx = size / 2;
  const c = Math.PI * r;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
      <path d={`M 6,${size/2} A ${r},${r} 0 0 1 ${size-6},${size/2}`}
        fill="none" stroke="var(--border)" strokeWidth={9} strokeLinecap="round" />
      <path d={`M 6,${size/2} A ${r},${r} 0 0 1 ${size-6},${size/2}`}
        fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={cx} y={size/2+2} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{score}</text>
      <text x={cx} y={size/2+16} textAnchor="middle" fontSize={10} fill="var(--muted)">/100</text>
    </svg>
  );
}

const TIPS = [
  { title: '장기 보유 비중 높이기', items: ['1년 이상 보유 목표 설정', '충동 매도 자제', '목표가 도달 전 조기 매도 금지'] },
  { title: 'Wash Sale 방지', items: ['손절 후 30일 이내 재매입 금지', '유사 ETF로 대체 투자', '30일 후 재진입 계획 수립'] },
  { title: '세금 손실 수확', items: ['12월에 손실 거래 정리', '장기 손실로 단기 수익 상쇄', '년 $3,000 손실 공제 활용'] },
  { title: '세금 유예 계좌 활용', items: ['401(k), IRA 계좌 활용', '단기 거래를 세금 유예 계좌에서 진행', '장기 투자는 일반 계좌 활용'] },
];

// ── main component ────────────────────────────────────────────────────────────

export default function TaxEfficiencyAnalysis({ data }: { data: TaxEfficiencyData }) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(data.score);
  const hasWashSales = data.washSales.length > 0;

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${hasWashSales ? '#ef444450' : 'var(--border)'}`,
      borderRadius: 12, overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreGauge score={data.score} size={100} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>E. 세금 효율성</span>
            {hasWashSales && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                color: '#ef4444', background: '#ef444422', padding: '2px 8px', borderRadius: 12,
              }}>
                <AlertTriangle size={11} /> Wash Sale {data.washSales.length}건
              </span>
            )}
          </div>
          <div style={{
            display: 'inline-flex', padding: '3px 10px', borderRadius: 20,
            fontSize: 12, fontWeight: 700, background: `${color}22`, color,
          }}>
            {data.score >= 70 ? '좋음 (장기 위주)' : data.score >= 40 ? '보통' : '개선 필요'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
            장기 {data.longTermCount}건 ({data.longTermPct.toFixed(1)}%)
            &nbsp;·&nbsp; 단기 {data.shortTermCount}건 ({data.shortTermPct.toFixed(1)}%)
            &nbsp;·&nbsp; 예상 세금 {fmtUSD(data.estimatedTax)}
          </div>
          {data.recommendation && (
            <div style={{ fontSize: 12, color: hasWashSales ? '#ef4444' : color, marginTop: 4, fontWeight: 500 }}>
              {data.recommendation}
            </div>
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

      {/* ── Expanded ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>

          {/* 🚨 Wash Sale 경고 */}
          {hasWashSales && (
            <div style={{
              background: '#ef444415', border: '1px solid #ef444440', borderRadius: 10,
              padding: '14px 16px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                  🚨 Wash Sale {data.washSales.length}건 감지!
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, margin: '0 0 12px' }}>
                아래 손실 거래는 IRS Wash Sale Rule에 의해 세금 공제가 제한될 수 있습니다.
                (매도 30일 전후에 동일 종목 재매입)
              </p>

              {data.washSales.map((ws, i) => (
                <div key={i} style={{
                  background: '#ef444410', borderRadius: 8, padding: '10px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', marginBottom: 4 }}>
                    {ws.ticker}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>
                    ❌ {ws.sellDate} 손실 매도: <strong>{fmtUSD(ws.loss)}</strong> 공제 불가
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    재매입: {ws.buysInWindow.map((b, j) => (
                      <span key={j}>
                        {b.date} ({b.daysFromSell >= 0 ? '+' : ''}{b.daysFromSell}일,
                        {b.quantity.toLocaleString()}주 @ ${b.price.toFixed(2)})
                        {j < ws.buysInWindow.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ background: '#ef444415', borderRadius: 8, padding: '10px 14px', marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>💡 해결 방법</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
                  • 손절 후 30일간 동일 종목 재매입 금지<br />
                  • 유사 ETF/종목으로 대체 (예: NVDA → 반도체 ETF SMH)<br />
                  • 30일 경과 후 원래 종목 재매입 가능
                </div>
              </div>
            </div>
          )}

          {!hasWashSales && (
            <div style={{
              background: '#10b98115', border: '1px solid #10b98140', borderRadius: 10,
              padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#10b981',
            }}>
              ✅ Wash Sale 없음! 모든 손실이 세금 공제 가능합니다.
            </div>
          )}

          {/* 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            {/* LT vs ST */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>장기 vs 단기 거래</div>
              {[
                { label: '장기 (1년+)', count: data.longTermCount, pct: data.longTermPct, color: '#10b981' },
                { label: '단기 (1년 미만)', count: data.shortTermCount, pct: data.shortTermPct, color: '#f59e0b' },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
                    <span style={{ color: 'var(--muted)' }}>{item.count}건 ({fmtPct(item.pct)})</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                    <div style={{ height: 6, borderRadius: 3, background: item.color, width: `${item.pct}%`, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Gains/Losses */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>수익/손실 상세</div>
              {[
                { label: '장기 수익', value: data.longTermGains, c: '#10b981' },
                { label: '장기 손실', value: -data.longTermLosses, c: '#ef4444' },
                { label: '단기 수익', value: data.shortTermGains, c: '#10b981' },
                { label: '단기 손실', value: -data.shortTermLosses, c: '#ef4444' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: item.value >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    {item.value >= 0 ? '+' : ''}{fmtUSD(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 예상 세금 계산 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>💰 예상 세금 계산 (미국 기준)</div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--border)' }}>
                    <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '8px 14px' }}>항목</th>
                    <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '8px 14px' }}>금액</th>
                    <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '8px 14px' }}>세율</th>
                    <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '8px 14px' }}>예상 세금</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}>장기 수익 (Long-term)</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>+{fmtUSD(data.longTermGains)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }}>15%</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(data.longTermGains * 0.15)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}>단기 수익 (Short-term)</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>+{fmtUSD(data.shortTermGains)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, color: '#ef4444' }}>32%</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(data.shortTermGains * 0.32)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }}>손실 공제 (최대 $3,000)</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>-{fmtUSD(data.deductibleLoss)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '8px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>-{fmtUSD(data.deductibleLoss * 0.32)}</td>
                  </tr>
                  <tr style={{ background: 'var(--border)', fontWeight: 700 }}>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>예상 세금 합계</td>
                    <td style={{ padding: '10px 14px' }} />
                    <td style={{ padding: '10px 14px' }} />
                    <td style={{ textAlign: 'right', padding: '10px 14px', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>
                      {fmtUSD(data.estimatedTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {data.potentialSavings > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                💡 모든 수익을 장기로 전환 시 절감 가능: +{fmtUSD(data.potentialSavings)}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, opacity: 0.7 }}>
              * 2024 미국 기준 단순 추정 (장기 15%, 단기 32%). 실제 세금은 소득 구간·주 세금 등에 따라 다릅니다.
            </div>
          </div>

          {/* 개선 방법 */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 세금 효율성 개선 방법</div>
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

        </div>
      )}
    </div>
  );
}
