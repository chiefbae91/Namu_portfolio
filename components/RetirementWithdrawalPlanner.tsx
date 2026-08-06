'use client';
import { useMemo, useState } from 'react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AccountConfig {
  id: string;
  name: string;
  balance: number;        // USD
  expectedReturn: number; // %/년
  withdrawalRate: number; // %/년
  startAge: number;       // 인출 시작 연령
  taxable: boolean;
  isBuffer: boolean;      // 자동조정 계좌 — 정확히 하나만 true
}

interface SimulationRow {
  age: number;
  livingNominal: number;      // 억원, 명목가치
  ssNominalKRW: number;       // 억원
  netNeedKRW: number;         // 억원, SS 커버 후 순수 필요 인출액
  totalWithdrawnKRW: number;  // 억원, 계좌에서 실제 인출한 금액
  shortfallKRW: number;       // 억원, 자동조정 계좌까지 소진돼도 못 채운 부족분
  surplusKRW: number;         // 억원, 고정 인출 계좌만으로 필요액을 초과한 잉여현금
  totalBalanceKRW: number;    // 억원
  totalBalanceUSD: number;
}

const DEFAULT_ACCOUNTS: AccountConfig[] = [
  { id: 'chase',     name: 'Chase (과세)',     balance: 1_400_127, expectedReturn: 8.4, withdrawalRate: 2.0, startAge: 54, taxable: true,  isBuffer: true },
  { id: 'robinhood', name: 'Robinhood (과세)', balance: 510_000,   expectedReturn: 8.4, withdrawalRate: 2.0, startAge: 54, taxable: true,  isBuffer: false },
  { id: 'trad_ira',  name: 'Traditional IRA',  balance: 193_000,   expectedReturn: 7.5, withdrawalRate: 0.0, startAge: 73, taxable: true,  isBuffer: false },
  { id: 'roth_ira',  name: 'Roth IRA',         balance: 100_000,   expectedReturn: 7.5, withdrawalRate: 0.0, startAge: 85, taxable: false, isBuffer: false },
];

const CURRENT_AGE = 53;
const END_AGE = 98;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtWon(v: number) {
  return Math.round(v).toLocaleString('ko-KR');
}

// 은퇴 지출 스마일 곡선: 65세까지 유지 → 84세 -26% 저점 → 98세 90%까지 회복
function spendingMultiplier(age: number) {
  if (age <= 65) return 1.0;
  if (age <= 84) return 1.0 - ((age - 65) / (84 - 65)) * 0.26;
  return 0.74 + ((age - 84) / (98 - 84)) * (0.90 - 0.74);
}

// ── Small building blocks ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{children}</label>;
}

function NumberField({ value, onChange, step, min, max, width, disabled }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; width?: number; disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: width ?? '100%', opacity: disabled ? 0.4 : 1 }}
    />
  );
}

function SummaryTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '14px 16px', flex: 1, minWidth: 150,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: warn ? 'var(--color-price-down)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RetirementWithdrawalPlanner() {
  const [accounts, setAccounts] = useState<AccountConfig[]>(DEFAULT_ACCOUNTS);
  const [fxRate, setFxRate] = useState(1450);
  const [baseMonthlyLivingKRW, setBaseMonthlyLivingKRW] = useState(13_000_000); // 월 1,300만원
  const [expenseAdjustPct, setExpenseAdjustPct] = useState(0); // -20 ~ +20
  const [inflationPct, setInflationPct] = useState(3.0);

  const [ssMonthlyUSD, setSsMonthlyUSD] = useState(1800);
  const [ssColaPct, setSsColaPct] = useState(2.5);
  const [ssStartAge, setSsStartAge] = useState(62);

  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const updateAccount = (id: string, field: keyof AccountConfig, value: number) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const setBufferAccount = (id: string) => {
    setAccounts(prev => prev.map(a => ({ ...a, isBuffer: a.id === id })));
  };

  // ===== 핵심 시뮬레이션 =====
  const simulation = useMemo<SimulationRow[]>(() => {
    const rows: SimulationRow[] = [];
    let accState = accounts.map(a => ({ ...a }));
    const expenseMult = 1 + expenseAdjustPct / 100;

    for (let age = CURRENT_AGE + 1; age <= END_AGE; age++) {
      const yearsFromStart = age - CURRENT_AGE;

      // 1) 오늘가치 기준 생활비 (스마일곡선 x 조정슬라이더), 명목가치로 환산 (인플레이션 복리)
      const livingTodayValue = (baseMonthlyLivingKRW * 12 / 1e8) * spendingMultiplier(age) * expenseMult; // 억원, 오늘가치
      const livingNominal = livingTodayValue * Math.pow(1 + inflationPct / 100, yearsFromStart); // 억원, 명목

      // 2) SS 수급액 (수급시작 연령 이후, COLA 복리 반영), 원화 환산
      let ssNominalKRW = 0;
      if (age >= ssStartAge) {
        const yearsSinceSS = age - ssStartAge;
        const ssMonthlyGrown = ssMonthlyUSD * Math.pow(1 + ssColaPct / 100, yearsSinceSS);
        ssNominalKRW = (ssMonthlyGrown * 12 * fxRate) / 1e8; // 억원
      }

      // 3) SS가 생활비를 먼저 커버 → 계좌에서 인출해야 할 순생활비
      const netNeedKRW = Math.max(0, livingNominal - ssNominalKRW);

      // 4) 계좌별 인출
      //    Step A: 자동조정 계좌가 아닌 계좌들은 각자 설정된 인출률대로 고정 인출
      //    Step B: 자동조정 계좌는 (필요액 - A에서 나온 금액)만큼만 추가 인출.
      //            이미 충분하면 0원 인출, 부족하면 그 차액을 인출.
      let nonBufferWithdrawnKRW = 0;

      accState = accState.map(a => {
        if (a.isBuffer) return a; // 자동조정 계좌는 Step B에서 처리
        let withdrawnUSD = 0;
        if (age >= a.startAge && a.balance > 0) {
          withdrawnUSD = Math.min(a.balance * (a.withdrawalRate / 100), a.balance);
        }
        const withdrawnKRW = (withdrawnUSD * fxRate) / 1e8;
        nonBufferWithdrawnKRW += withdrawnKRW;

        const balanceAfterWithdrawal = a.balance - withdrawnUSD;
        const balanceAfterGrowth = balanceAfterWithdrawal * (1 + a.expectedReturn / 100);
        return { ...a, balance: balanceAfterGrowth };
      });

      const shortfallBeforeBufferKRW = Math.max(0, netNeedKRW - nonBufferWithdrawnKRW);
      let bufferWithdrawnKRW = 0;

      accState = accState.map(a => {
        if (!a.isBuffer) return a;
        let withdrawnUSD = 0;
        const canWithdraw = age >= a.startAge && a.balance > 0;
        if (canWithdraw && shortfallBeforeBufferKRW > 0) {
          const neededUSD = (shortfallBeforeBufferKRW * 1e8) / fxRate;
          withdrawnUSD = Math.min(neededUSD, a.balance);
        }
        const withdrawnKRW = (withdrawnUSD * fxRate) / 1e8;
        bufferWithdrawnKRW = withdrawnKRW;

        const balanceAfterWithdrawal = a.balance - withdrawnUSD;
        const balanceAfterGrowth = balanceAfterWithdrawal * (1 + a.expectedReturn / 100);
        return { ...a, balance: balanceAfterGrowth };
      });

      const totalWithdrawnKRW = nonBufferWithdrawnKRW + bufferWithdrawnKRW;
      const totalBalanceUSD = accState.reduce((sum, a) => sum + a.balance, 0);
      const totalBalanceKRW = (totalBalanceUSD * fxRate) / 1e8;

      // 여전히 부족한 경우 (자동조정 계좌도 소진됐거나 아직 시작연령 전인 경우) → 부족분
      const shortfallKRW = Math.max(0, netNeedKRW - totalWithdrawnKRW);
      // 고정 인출 계좌들만으로 이미 필요액을 초과한 경우 → 잉여현금 (자동조정 계좌는 0원 인출했으므로 초과분은 재투자되지 않고 남는 현금)
      const surplusKRW = Math.max(0, nonBufferWithdrawnKRW - netNeedKRW);

      rows.push({
        age,
        livingNominal,
        ssNominalKRW,
        netNeedKRW,
        totalWithdrawnKRW,
        shortfallKRW,
        surplusKRW,
        totalBalanceKRW,
        totalBalanceUSD,
      });
    }
    return rows;
  }, [accounts, fxRate, baseMonthlyLivingKRW, expenseAdjustPct, inflationPct, ssMonthlyUSD, ssColaPct, ssStartAge]);

  const chartData = simulation.map(r => ({
    age: r.age,
    '자산잔액(억원)': Math.round(r.totalBalanceKRW * 10) / 10,
    '필요생활비(억원)': Math.round(r.netNeedKRW * 100) / 100,
    '계좌인출액(억원)': Math.round(r.totalWithdrawnKRW * 100) / 100,
  }));

  const depletionAge = simulation.find(r => r.totalBalanceUSD <= 0)?.age;
  const shortfallYears = simulation.filter(r => r.shortfallKRW > 0).length;
  const lastRow = simulation[simulation.length - 1];

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: 16, marginBottom: 20,
  };
  const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' };
  const helpTextStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 };

  return (
    <div>
      {/* ===== 생활비 설정 ===== */}
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>생활비 설정</div>
        <div style={gridStyle}>
          <div>
            <FieldLabel>초기 월 생활비 (원)</FieldLabel>
            <NumberField value={baseMonthlyLivingKRW} onChange={setBaseMonthlyLivingKRW} />
          </div>
          <div>
            <FieldLabel>환율 (원/달러)</FieldLabel>
            <NumberField value={fxRate} onChange={setFxRate} />
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
          위 슬라이더로 전체 곡선을 ±20% 범위에서 이동시켜 민감도를 확인할 수 있습니다.
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
      <section style={cardStyle}>
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
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td><NumberField value={a.balance} onChange={v => updateAccount(a.id, 'balance', v)} width={120} /></td>
                  <td><NumberField value={a.expectedReturn} onChange={v => updateAccount(a.id, 'expectedReturn', v)} step={0.1} width={80} /></td>
                  <td><NumberField value={a.withdrawalRate} onChange={v => updateAccount(a.id, 'withdrawalRate', v)} step={0.5} width={80} disabled={a.isBuffer} /></td>
                  <td><NumberField value={a.startAge} onChange={v => updateAccount(a.id, 'startAge', v)} width={80} /></td>
                  <td style={{ textAlign: 'center' }}>
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
          "자동조정" 계좌는 나머지 계좌들의 인출액 합이 필요액에 못 미치면 그 차액만큼 자동으로 추가 인출하고,
          이미 충분하면 인출하지 않습니다 (인출률 설정 무시). 정확히 한 계좌만 선택할 수 있습니다.
        </p>
      </section>

      {/* ===== 결과 요약 ===== */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <SummaryTile label={`${END_AGE}세 시점 잔액`} value={`${fmtWon(lastRow?.totalBalanceKRW || 0)}억원`} />
        <SummaryTile label="자산 소진 시점" value={depletionAge ? `${depletionAge}세` : '소진 없음'} />
        <SummaryTile label="SS 수급 시작" value={`${ssStartAge}세`} />
        <SummaryTile label="부족분 발생 연도" value={`${shortfallYears}년`} warn={shortfallYears > 0} />
      </div>

      {/* ===== 뷰 전환 ===== */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button className={`tab ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>테이블</button>
        <button className={`tab ${viewMode === 'chart' ? 'active' : ''}`} onClick={() => setViewMode('chart')}>차트</button>
      </div>

      {viewMode === 'chart' ? (
        <div style={{ width: '100%', height: 360, marginBottom: 20 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="age" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
                label={{ value: '나이', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
                label={{ value: '억원', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--muted)', marginBottom: 4, fontSize: 11 }}
                itemStyle={{ color: 'var(--text)' }}
                formatter={(v: number) => `${v}억원`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Area type="monotone" dataKey="자산잔액(억원)" stroke="#6366f1" strokeWidth={2} fill="url(#colorBalance)" dot={false} />
              <Line type="monotone" dataKey="필요생활비(억원)" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="계좌인출액(억원)" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>나이</th>
                <th>필요생활비</th>
                <th>SS수급액</th>
                <th>순인출필요액</th>
                <th>계좌인출액</th>
                <th>부족분</th>
                <th>잉여현금</th>
                <th>자산잔액</th>
              </tr>
            </thead>
            <tbody>
              {simulation.map(r => (
                <tr key={r.age}>
                  <td>{r.age}세</td>
                  <td>{fmtWon(r.livingNominal * 1e8 / 1e4)}만원</td>
                  <td>{fmtWon(r.ssNominalKRW * 1e8 / 1e4)}만원</td>
                  <td>{fmtWon(r.netNeedKRW * 1e8 / 1e4)}만원</td>
                  <td>{fmtWon(r.totalWithdrawnKRW * 1e8 / 1e4)}만원</td>
                  <td style={{ color: r.shortfallKRW > 0 ? 'var(--color-price-down)' : 'var(--muted)' }}>
                    {r.shortfallKRW > 0 ? `-${fmtWon(r.shortfallKRW * 1e8 / 1e4)}만원` : '-'}
                  </td>
                  <td style={{ color: r.surplusKRW > 0 ? 'var(--color-price-up)' : 'var(--muted)' }}>
                    {r.surplusKRW > 0 ? `+${fmtWon(r.surplusKRW * 1e8 / 1e4)}만원` : '-'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtWon(r.totalBalanceKRW)}억원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== 다음 단계 placeholder ===== */}
      <section style={{
        padding: 16, borderRadius: 10, border: '1px dashed var(--border)',
        textAlign: 'center', color: 'var(--muted)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>AI 어드바이저 (다음 단계)</div>
        <div style={{ fontSize: 12 }}>위 시뮬레이션 결과를 바탕으로 자동 조언을 제공하는 기능은 다음 개발 단계에서 추가됩니다.</div>
      </section>
    </div>
  );
}
