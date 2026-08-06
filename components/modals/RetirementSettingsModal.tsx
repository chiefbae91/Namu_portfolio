'use client';
import { X, Plus } from 'lucide-react';
import type { AccountConfig, LivingExpenseRule, RealAccount, WithdrawalRule } from '@/components/RetirementWithdrawalPlanner';

interface Props {
  onClose: () => void;
  livingExpenseSchedule: LivingExpenseRule[]; updateLivingExpenseRule: (fromAge: number, monthlyKRW: number) => void;
  expenseAdjustPct: number; setExpenseAdjustPct: (v: number) => void;
  inflationPct: number; setInflationPct: (v: number) => void;
  fxRate: number;
  fxAdjustKRW: number; setFxAdjustKRW: (v: number) => void;
  ssMonthlyUSD: number; setSsMonthlyUSD: (v: number) => void;
  ssColaPct: number; setSsColaPct: (v: number) => void;
  ssStartAge: number; setSsStartAge: (v: number) => void;
  accounts: AccountConfig[];
  updateAccount: (id: string, field: keyof AccountConfig, value: number) => void;
  setBufferAccount: (id: string) => void;
  addScheduleRule: (accountId: string) => void;
  updateScheduleRule: (accountId: string, ruleIndex: number, field: keyof WithdrawalRule, value: number) => void;
  removeScheduleRule: (accountId: string, ruleIndex: number) => void;
  realAccounts: RealAccount[];
  linkAccount: (id: string, realAccountId: string) => void;
}

// 1,000만원 ~ 2,000만원, 100만원 단위
const LIVING_OPTIONS = Array.from({ length: 11 }, (_, i) => (1000 + i * 100) * 10_000);
// 환율 조정: -200원 ~ +200원, 50원 단위
const FX_ADJUST_OPTIONS = [-200, -150, -100, -50, 0, 50, 100, 150, 200];

// ── Small building blocks ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{children}</label>;
}

function NumberField({ value, onChange, step, min, max, width }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; width?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: width ?? '100%' }}
    />
  );
}

function fmtUSD(v: number) {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 16, marginBottom: 16,
};
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text)' };
const helpTextStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 };

export default function RetirementSettingsModal({
  onClose,
  livingExpenseSchedule, updateLivingExpenseRule,
  expenseAdjustPct, setExpenseAdjustPct,
  inflationPct, setInflationPct,
  fxRate,
  fxAdjustKRW, setFxAdjustKRW,
  ssMonthlyUSD, setSsMonthlyUSD,
  ssColaPct, setSsColaPct,
  ssStartAge, setSsStartAge,
  accounts, updateAccount, setBufferAccount, addScheduleRule, updateScheduleRule, removeScheduleRule,
  realAccounts, linkAccount,
}: Props) {
  const bufferAccountId = accounts.find(a => a.isBuffer)?.id ?? '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 920, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>은퇴 인출 계획 설정</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {/* ===== 생활비 설정 ===== */}
        <section style={cardStyle}>
          <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>생활비 설정</div>
          <div style={gridStyle}>
            <div>
              <FieldLabel>인플레이션 (%/년)</FieldLabel>
              <NumberField value={inflationPct} onChange={setInflationPct} step={0.1} />
            </div>
            <div>
              <FieldLabel>환율 (현재 시세)</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="text" value={`${(fxRate + fxAdjustKRW).toLocaleString('ko-KR')}원`} disabled style={{ flex: 1, minWidth: 0 }} />
                <select
                  value={fxAdjustKRW}
                  onChange={e => setFxAdjustKRW(Number(e.target.value))}
                  style={{ width: 90 }}
                >
                  {FX_ADJUST_OPTIONS.map(v => (
                    <option key={v} value={v}>{v > 0 ? `+${v}` : v}원</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>생활비 조정: {expenseAdjustPct > 0 ? '+' : ''}{expenseAdjustPct}%</FieldLabel>
              <input
                type="range" min={-20} max={20} step={1}
                value={expenseAdjustPct}
                onChange={e => setExpenseAdjustPct(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>5년 단위 월 생활비 (오늘가치 기준)</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {livingExpenseSchedule.map(rule => (
                <div key={rule.fromAge}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{rule.fromAge}세~</span>
                  <select
                    value={rule.monthlyKRW}
                    onChange={e => updateLivingExpenseRule(rule.fromAge, Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {LIVING_OPTIONS.map(v => (
                      <option key={v} value={v}>{(v / 10_000).toLocaleString('ko-KR')}만원</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <p style={helpTextStyle}>
            지출은 은퇴 스마일 곡선(65세까지 유지 → 84세 -26% 저점 → 98세 90% 회복)을 자동 적용합니다.
            월 생활비는 5년 단위로 다르게 설정할 수 있으며, 인플레이션은 구간과 무관하게 항상 53세(현재) 기준으로 복리 누적됩니다.
            환율은 현재 시세를 기준으로 드롭다운에서 ±200원까지 조정할 수 있습니다.
          </p>
        </section>

        {/* ===== Social Security ===== */}
        <section style={cardStyle}>
          <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>Social Security</div>
          <div style={gridStyle}>
            <div>
              <FieldLabel>예상 월 수급액 ($)</FieldLabel>
              <NumberField value={ssMonthlyUSD} onChange={setSsMonthlyUSD} />
            </div>
            <div>
              <FieldLabel>COLA (%/년)</FieldLabel>
              <NumberField value={ssColaPct} onChange={setSsColaPct} step={0.1} />
            </div>
            <div>
              <FieldLabel>수급 시작 연령</FieldLabel>
              <NumberField value={ssStartAge} onChange={setSsStartAge} min={62} max={70} />
            </div>
          </div>
          <p style={helpTextStyle}>
            SS 수급액이 생활비를 먼저 커버하고, 부족분만 계좌에서 인출하는 구조로 계산됩니다.
          </p>
        </section>

        {/* ===== 계좌별 설정 ===== */}
        <section style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={sectionTitleStyle}>계좌별 설정</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>자동조정 계좌</span>
              <select value={bufferAccountId} onChange={e => setBufferAccount(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>계좌</th>
                  <th>잔액 ($)</th>
                  <th>기대수익률 (%)</th>
                  <th>인출률 (%/년)</th>
                  <th>인출 연령</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{a.name}</td>
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{fmtUSD(a.balance)}</div>
                      <select
                        value={a.linkedAccountId ?? ''}
                        onChange={e => linkAccount(a.id, e.target.value)}
                        style={{ fontSize: 11, width: 140 }}
                      >
                        <option value="">계좌 연결 안함</option>
                        {realAccounts.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td style={{ verticalAlign: 'top' }}><NumberField value={a.expectedReturn} onChange={v => updateAccount(a.id, 'expectedReturn', v)} step={0.1} width={80} /></td>
                    <td style={{ verticalAlign: 'top' }}>
                      {[...a.withdrawalSchedule]
                        .map((rule, i) => ({ rule, i }))
                        .sort((x, y) => x.rule.fromAge - y.rule.fromAge)
                        .map(({ rule, i }) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <NumberField value={rule.fromAge} onChange={v => updateScheduleRule(a.id, i, 'fromAge', v)} width={50} />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>세~</span>
                            <NumberField value={rule.rate} onChange={v => updateScheduleRule(a.id, i, 'rate', v)} step={0.5} width={55} />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>%</span>
                            {a.withdrawalSchedule.length > 1 && (
                              <button
                                onClick={() => removeScheduleRule(a.id, i)}
                                title="구간 삭제"
                                style={{ background: 'none', padding: 2, color: 'var(--muted)', display: 'flex' }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      <button
                        onClick={() => addScheduleRule(a.id)}
                        className="btn-sm btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}
                      >
                        <Plus size={11} /> 구간 추가
                      </button>
                      {a.isBuffer && <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginTop: 4 }}>최소 인출률</span>}
                    </td>
                    <td style={{ verticalAlign: 'top' }}><NumberField value={a.startAge} onChange={v => updateAccount(a.id, 'startAge', v)} width={80} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={helpTextStyle}>
            잔액은 직접 입력할 수 없으며, 연결한 실제 계좌의 현재 잔액(현금+평가금액)이 자동으로 적용됩니다.
            인출률은 계좌마다 여러 연령 구간으로 나눠 설정할 수 있습니다 (예: 54세~2%, 65세~4%).
            각 나이에는 시작 연령이 그 나이 이하인 구간 중 가장 늦게 시작하는 구간의 인출률이 적용됩니다.
            상단의 "자동조정 계좌"는 설정한 인출률만큼을 <strong>최소 인출액</strong>으로 매년 인출하고,
            나머지 계좌들의 인출액 합이 필요액에 못 미치면 그 부족분과 최소 인출액 중 더 큰 금액을 인출합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
