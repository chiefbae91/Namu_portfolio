'use client';
import { X, Plus } from 'lucide-react';
import type { AccountConfig, WithdrawalRule } from '@/components/RetirementWithdrawalPlanner';

interface Props {
  onClose: () => void;
  baseMonthlyLivingKRW: number; setBaseMonthlyLivingKRW: (v: number) => void;
  expenseAdjustPct: number; setExpenseAdjustPct: (v: number) => void;
  inflationPct: number; setInflationPct: (v: number) => void;
  fxRate: number; setFxRate: (v: number) => void;
  fxAdjustPct: number; setFxAdjustPct: (v: number) => void;
  ssMonthlyUSD: number; setSsMonthlyUSD: (v: number) => void;
  ssColaPct: number; setSsColaPct: (v: number) => void;
  ssStartAge: number; setSsStartAge: (v: number) => void;
  accounts: AccountConfig[];
  updateAccount: (id: string, field: keyof AccountConfig, value: number) => void;
  setBufferAccount: (id: string) => void;
  addScheduleRule: (accountId: string) => void;
  updateScheduleRule: (accountId: string, ruleIndex: number, field: keyof WithdrawalRule, value: number) => void;
  removeScheduleRule: (accountId: string, ruleIndex: number) => void;
}

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

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 16, marginBottom: 16,
};
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' };
const helpTextStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 };

export default function RetirementSettingsModal({
  onClose,
  baseMonthlyLivingKRW, setBaseMonthlyLivingKRW,
  expenseAdjustPct, setExpenseAdjustPct,
  inflationPct, setInflationPct,
  fxRate, setFxRate,
  fxAdjustPct, setFxAdjustPct,
  ssMonthlyUSD, setSsMonthlyUSD,
  ssColaPct, setSsColaPct,
  ssStartAge, setSsStartAge,
  accounts, updateAccount, setBufferAccount, addScheduleRule, updateScheduleRule, removeScheduleRule,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>은퇴 인출 계획 설정</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {/* ===== 생활비 설정 ===== */}
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>생활비 설정</div>
          <div style={gridStyle}>
            <div>
              <FieldLabel>초기 월 생활비 (백만원)</FieldLabel>
              <NumberField
                value={baseMonthlyLivingKRW / 1_000_000}
                onChange={v => setBaseMonthlyLivingKRW(v * 1_000_000)}
                step={0.1}
              />
            </div>
            <div>
              <FieldLabel>환율 (원/달러)</FieldLabel>
              <NumberField value={fxRate} onChange={setFxRate} />
            </div>
            <div>
              <FieldLabel>환율 조정: {fxAdjustPct > 0 ? '+' : ''}{fxAdjustPct}%</FieldLabel>
              <input
                type="range" min={-20} max={20} step={1}
                value={fxAdjustPct}
                onChange={e => setFxAdjustPct(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
            <div>
              <FieldLabel>인플레이션 (%/년)</FieldLabel>
              <NumberField value={inflationPct} onChange={setInflationPct} step={0.1} />
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
          <p style={helpTextStyle}>
            지출은 은퇴 스마일 곡선(65세까지 유지 → 84세 -26% 저점 → 98세 90% 회복)을 자동 적용합니다.
            환율은 현재 시세가 기본값으로 채워지며, 두 슬라이더로 각각 ±20% 범위에서 민감도를 확인할 수 있습니다.
          </p>
        </section>

        {/* ===== Social Security ===== */}
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Social Security</div>
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
          <div style={sectionTitleStyle}>계좌별 설정</div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>계좌</th>
                  <th>잔액 ($)</th>
                  <th>기대수익률 (%)</th>
                  <th>인출률 (%/년)</th>
                  <th>인출 시작 연령</th>
                  <th>자동조정</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{a.name}</td>
                    <td style={{ verticalAlign: 'top' }}><NumberField value={a.balance} onChange={v => updateAccount(a.id, 'balance', v)} width={120} /></td>
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
                    <td style={{ textAlign: 'center', verticalAlign: 'top' }}>
                      <input
                        type="radio" name="bufferAccount" checked={a.isBuffer}
                        onChange={() => setBufferAccount(a.id)}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={helpTextStyle}>
            인출률은 계좌마다 여러 연령 구간으로 나눠 설정할 수 있습니다 (예: 54세~2%, 65세~4%).
            각 나이에는 시작 연령이 그 나이 이하인 구간 중 가장 늦게 시작하는 구간의 인출률이 적용됩니다.
            "자동조정" 계좌는 설정한 인출률만큼을 <strong>최소 인출액</strong>으로 매년 인출하고,
            나머지 계좌들의 인출액 합이 필요액에 못 미치면 그 부족분과 최소 인출액 중 더 큰 금액을 인출합니다.
            정확히 한 계좌만 선택할 수 있습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
