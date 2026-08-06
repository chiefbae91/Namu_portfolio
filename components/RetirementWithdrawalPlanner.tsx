'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { List, Settings } from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import RetirementSettingsModal from '@/components/modals/RetirementSettingsModal';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WithdrawalRule {
  fromAge: number; // 이 연령부터 적용
  rate: number;    // %/년
}

export interface AccountConfig {
  id: string;
  name: string;
  balance: number;                    // USD — 연결된 실제 계좌가 있으면 그 잔액으로 자동 동기화됨
  expectedReturn: number;             // %/년
  withdrawalSchedule: WithdrawalRule[]; // 연령 구간별 인출률
  startAge: number;                   // 인출 연령
  taxable: boolean;
  isBuffer: boolean;                  // 자동조정 계좌 — 정확히 하나만 true
  linkedAccountId: string | null;     // 실제 포트폴리오 계좌 ID
}

export interface RealAccount {
  id: string;
  name: string;
  balanceUSD: number;
}

// 주어진 나이 시점에 적용되는 인출률: fromAge <= age인 규칙 중 가장 늦게 시작하는 규칙
function effectiveWithdrawalRate(schedule: WithdrawalRule[], age: number): number {
  const applicable = schedule.filter(r => r.fromAge <= age);
  if (applicable.length === 0) return 0;
  return applicable.reduce((latest, r) => (r.fromAge > latest.fromAge ? r : latest)).rate;
}

interface AccountWithdrawal {
  id: string;
  name: string;
  withdrawnKRW: number; // 억원
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
  accountWithdrawals: AccountWithdrawal[]; // 계좌별 출금 상세
}

const DEFAULT_ACCOUNTS: AccountConfig[] = [
  { id: 'chase',     name: 'Chase (과세)',     balance: 1_400_127, expectedReturn: 8.4, withdrawalSchedule: [{ fromAge: 54, rate: 2.0 }], startAge: 54, taxable: true,  isBuffer: true,  linkedAccountId: null },
  { id: 'robinhood', name: 'Robinhood (과세)', balance: 510_000,   expectedReturn: 8.4, withdrawalSchedule: [{ fromAge: 54, rate: 2.0 }], startAge: 54, taxable: true,  isBuffer: false, linkedAccountId: null },
  { id: 'trad_ira',  name: 'Traditional IRA',  balance: 193_000,   expectedReturn: 7.5, withdrawalSchedule: [{ fromAge: 73, rate: 0.0 }], startAge: 73, taxable: true,  isBuffer: false, linkedAccountId: null },
  { id: 'roth_ira',  name: 'Roth IRA',         balance: 100_000,   expectedReturn: 7.5, withdrawalSchedule: [{ fromAge: 85, rate: 0.0 }], startAge: 85, taxable: false, isBuffer: false, linkedAccountId: null },
];

// 구버전 저장 데이터를 최신 스키마로 이전 (withdrawalRate -> schedule, linkedAccountId 기본값)
function normalizeAccount(a: any): AccountConfig {
  let account = a;
  if (!Array.isArray(a.withdrawalSchedule) || a.withdrawalSchedule.length === 0) {
    const rate = typeof a.withdrawalRate === 'number' ? a.withdrawalRate : 0;
    account = { ...account, withdrawalSchedule: [{ fromAge: a.startAge ?? CURRENT_AGE, rate }] };
  }
  if (account.linkedAccountId === undefined) account = { ...account, linkedAccountId: null };
  return account as AccountConfig;
}

const CURRENT_AGE = 53;
const END_AGE = 98;

const SETTINGS_KEY = 'retirement_planner';

interface SavedSettings {
  accounts: AccountConfig[];
  fxRate: number;
  fxAdjustKRW: number;
  baseMonthlyLivingKRW: number;
  expenseAdjustPct: number;
  inflationPct: number;
  ssMonthlyUSD: number;
  ssColaPct: number;
  ssStartAge: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtWon(v: number) {
  return Math.round(v).toLocaleString('ko-KR');
}

function fmtUSD(v: number) {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

// 은퇴 지출 스마일 곡선: 65세까지 유지 → 84세 -26% 저점 → 98세 90%까지 회복
function spendingMultiplier(age: number) {
  if (age <= 65) return 1.0;
  if (age <= 84) return 1.0 - ((age - 65) / (84 - 65)) * 0.26;
  return 0.74 + ((age - 84) / (98 - 84)) * (0.90 - 0.74);
}

// ── Small building blocks ─────────────────────────────────────────────────────

function WithdrawalDetailButton({ items }: { items: AccountWithdrawal[] }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => btnRef.current && setAnchor(btnRef.current.getBoundingClientRect());
  const hide = () => setAnchor(null);
  const toggle = () => (anchor ? hide() : show());

  const withdrawn = items.filter(it => it.withdrawnKRW > 0.00001);
  const tipLeft = anchor ? Math.min(anchor.left, window.innerWidth - 220) : 0;
  const tipTop = anchor ? anchor.bottom + 6 : 0;

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={toggle}
        title="계좌별 출금액 보기"
        style={{ background: 'none', padding: 4, color: 'var(--muted)', display: 'inline-flex' }}
      >
        <List size={14} />
      </button>
      {anchor && createPortal(
        <div style={{
          position: 'fixed', top: tipTop, left: Math.max(8, tipLeft), zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '10px 12px', minWidth: 180, fontSize: 12, color: 'var(--text)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {withdrawn.length === 0
            ? <div style={{ color: 'var(--muted)' }}>인출 없음</div>
            : withdrawn.map(it => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 4 }}>
                <span style={{ color: 'var(--muted)' }}>{it.name}</span>
                <span style={{ fontWeight: 600 }}>{fmtWon(it.withdrawnKRW * 1e8 / 1e4)}만원</span>
              </div>
            ))}
        </div>,
        document.body
      )}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
      padding: '4px 10px', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function SettingsSummary({
  baseMonthlyLivingKRW, fxRate, fxAdjustKRW, inflationPct, expenseAdjustPct,
  ssMonthlyUSD, ssColaPct, ssStartAge, accounts,
}: {
  baseMonthlyLivingKRW: number; fxRate: number; fxAdjustKRW: number;
  inflationPct: number; expenseAdjustPct: number;
  ssMonthlyUSD: number; ssColaPct: number; ssStartAge: number;
  accounts: AccountConfig[];
}) {
  const effectiveFx = fxRate + fxAdjustKRW;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: 14, marginBottom: 20,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>현재 설정</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <Chip>월 생활비 {(baseMonthlyLivingKRW / 10_000).toLocaleString('ko-KR')}만원{expenseAdjustPct !== 0 ? ` (${expenseAdjustPct > 0 ? '+' : ''}${expenseAdjustPct}%)` : ''}</Chip>
        <Chip>인플레이션 {inflationPct}%/년</Chip>
        <Chip>환율 {effectiveFx.toLocaleString('ko-KR')}원</Chip>
        <Chip>SS ${ssMonthlyUSD.toLocaleString('en-US')}/월 · {ssStartAge}세부터 · COLA {ssColaPct}%</Chip>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {accounts.map(a => (
          <Chip key={a.id}>
            {a.isBuffer && '⭐ '}{a.name} · {fmtUSD(a.balance)} · {a.startAge}세부터
          </Chip>
        ))}
      </div>
    </div>
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
  const [fxAdjustKRW, setFxAdjustKRW] = useState(0); // -200 ~ +200원
  const [baseMonthlyLivingKRW, setBaseMonthlyLivingKRW] = useState(13_000_000); // 월 1,300만원
  const [expenseAdjustPct, setExpenseAdjustPct] = useState(0); // -20 ~ +20
  const [inflationPct, setInflationPct] = useState(3.0);

  const [ssMonthlyUSD, setSsMonthlyUSD] = useState(1800);
  const [ssColaPct, setSsColaPct] = useState(2.5);
  const [ssStartAge, setSsStartAge] = useState(62);

  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [realAccounts, setRealAccounts] = useState<RealAccount[]>([]);

  // ===== 설정 불러오기 / 저장 =====
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 실제 포트폴리오 계좌 잔액 불러오기 (잔액은 여기서 자동으로 채워지며 직접 수정 불가)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portfolio');
        if (!res.ok) return;
        const data = await res.json();
        const list: RealAccount[] = (data.account_breakdown || []).map((a: any) => ({
          id: String(a.account_id),
          name: a.account_name,
          balanceUSD: (a.cash || 0) + (a.stock_value || 0),
        }));
        setRealAccounts(list);
      } catch { /* 실패 시 마지막으로 저장된 잔액 유지 */ }
    })();
  }, []);

  // 계좌 연결이 아직 없으면 이름으로 자동 매칭하고, 연결된 계좌는 실제 잔액으로 동기화
  useEffect(() => {
    if (!loaded || realAccounts.length === 0) return;
    setAccounts(prev => prev.map(a => {
      let linkedAccountId = a.linkedAccountId;
      if (!linkedAccountId) {
        const stripped = a.name.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
        const match = realAccounts.find(r => r.name.trim().toLowerCase() === stripped);
        if (match) linkedAccountId = match.id;
      }
      const real = realAccounts.find(r => r.id === linkedAccountId);
      if (!real) return linkedAccountId === a.linkedAccountId ? a : { ...a, linkedAccountId };
      return { ...a, linkedAccountId, balance: real.balanceUSD };
    }));
  }, [realAccounts, loaded]);

  useEffect(() => {
    (async () => {
      let hasSavedFxRate = false;
      try {
        const res = await fetch(`/api/settings?key=${SETTINGS_KEY}`);
        if (res.ok) {
          const { value } = await res.json();
          if (value) {
            const saved: Partial<SavedSettings> = JSON.parse(value);
            if (saved.accounts) setAccounts(saved.accounts.map(normalizeAccount));
            if (saved.fxRate != null) { setFxRate(saved.fxRate); hasSavedFxRate = true; }
            if (saved.fxAdjustKRW != null) setFxAdjustKRW(saved.fxAdjustKRW);
            if (saved.baseMonthlyLivingKRW != null) setBaseMonthlyLivingKRW(saved.baseMonthlyLivingKRW);
            if (saved.expenseAdjustPct != null) setExpenseAdjustPct(saved.expenseAdjustPct);
            if (saved.inflationPct != null) setInflationPct(saved.inflationPct);
            if (saved.ssMonthlyUSD != null) setSsMonthlyUSD(saved.ssMonthlyUSD);
            if (saved.ssColaPct != null) setSsColaPct(saved.ssColaPct);
            if (saved.ssStartAge != null) setSsStartAge(saved.ssStartAge);
          }
        }
      } finally {
        setLoaded(true);
      }
      // 저장된 환율이 없으면(첫 방문) 현재 시세를 기본값으로 사용
      if (!hasSavedFxRate) {
        try {
          const res = await fetch('/api/exchange-rates');
          if (res.ok) {
            const { KRW } = await res.json();
            if (typeof KRW === 'number' && KRW > 0) setFxRate(KRW);
          }
        } catch { /* 실패 시 기본값(1450) 유지 */ }
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return; // 불러오기 완료 전에는 저장하지 않음 (기본값으로 덮어쓰기 방지)
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const value: SavedSettings = {
        accounts, fxRate, fxAdjustKRW, baseMonthlyLivingKRW, expenseAdjustPct, inflationPct,
        ssMonthlyUSD, ssColaPct, ssStartAge,
      };
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTINGS_KEY, value: JSON.stringify(value) }),
      });
    }, 500);
  }, [accounts, fxRate, fxAdjustKRW, baseMonthlyLivingKRW, expenseAdjustPct, inflationPct, ssMonthlyUSD, ssColaPct, ssStartAge, loaded]);

  const updateAccount = (id: string, field: keyof AccountConfig, value: number) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const linkAccount = (id: string, realAccountId: string) => {
    const real = realAccounts.find(r => r.id === realAccountId);
    setAccounts(prev => prev.map(a => a.id === id
      ? { ...a, linkedAccountId: realAccountId || null, balance: real ? real.balanceUSD : a.balance }
      : a));
  };

  const setBufferAccount = (id: string) => {
    setAccounts(prev => prev.map(a => ({ ...a, isBuffer: a.id === id })));
  };

  const addScheduleRule = (accountId: string) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== accountId) return a;
      const lastRule = [...a.withdrawalSchedule].sort((x, y) => x.fromAge - y.fromAge).pop();
      const nextFromAge = Math.min(END_AGE, (lastRule?.fromAge ?? a.startAge) + 5);
      return { ...a, withdrawalSchedule: [...a.withdrawalSchedule, { fromAge: nextFromAge, rate: lastRule?.rate ?? 0 }] };
    }));
  };

  const updateScheduleRule = (accountId: string, ruleIndex: number, field: keyof WithdrawalRule, value: number) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== accountId) return a;
      const withdrawalSchedule = a.withdrawalSchedule.map((r, i) => i === ruleIndex ? { ...r, [field]: value } : r);
      return { ...a, withdrawalSchedule };
    }));
  };

  const removeScheduleRule = (accountId: string, ruleIndex: number) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== accountId || a.withdrawalSchedule.length <= 1) return a;
      return { ...a, withdrawalSchedule: a.withdrawalSchedule.filter((_, i) => i !== ruleIndex) };
    }));
  };

  // ===== 핵심 시뮬레이션 =====
  const simulation = useMemo<SimulationRow[]>(() => {
    const rows: SimulationRow[] = [];
    let accState = accounts.map(a => ({ ...a }));
    const expenseMult = 1 + expenseAdjustPct / 100;
    const effectiveFxRate = fxRate + fxAdjustKRW;

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
        ssNominalKRW = (ssMonthlyGrown * 12 * effectiveFxRate) / 1e8; // 억원
      }

      // 3) SS가 생활비를 먼저 커버 → 계좌에서 인출해야 할 순생활비
      const netNeedKRW = Math.max(0, livingNominal - ssNominalKRW);

      // 4) 계좌별 인출
      //    Step A: 자동조정 계좌가 아닌 계좌들은 각자 설정된 인출률대로 고정 인출
      //    Step B: 자동조정 계좌는 (필요액 - A에서 나온 금액)만큼만 추가 인출.
      //            이미 충분하면 0원 인출, 부족하면 그 차액을 인출.
      let nonBufferWithdrawnKRW = 0;
      const accountWithdrawals: AccountWithdrawal[] = [];

      accState = accState.map(a => {
        if (a.isBuffer) return a; // 자동조정 계좌는 Step B에서 처리
        let withdrawnUSD = 0;
        if (age >= a.startAge && a.balance > 0) {
          const rate = effectiveWithdrawalRate(a.withdrawalSchedule, age);
          withdrawnUSD = Math.min(a.balance * (rate / 100), a.balance);
        }
        const withdrawnKRW = (withdrawnUSD * effectiveFxRate) / 1e8;
        nonBufferWithdrawnKRW += withdrawnKRW;
        accountWithdrawals.push({ id: a.id, name: a.name, withdrawnKRW });

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
        if (canWithdraw) {
          const rate = effectiveWithdrawalRate(a.withdrawalSchedule, age);
          const minWithdrawUSD = a.balance * (rate / 100);
          const shortfallUSD = (shortfallBeforeBufferKRW * 1e8) / effectiveFxRate;
          // 최소 인출률만큼은 기본으로 인출하고, 부족분이 그보다 크면 부족분만큼 인출
          withdrawnUSD = Math.min(Math.max(minWithdrawUSD, shortfallUSD), a.balance);
        }
        const withdrawnKRW = (withdrawnUSD * effectiveFxRate) / 1e8;
        bufferWithdrawnKRW = withdrawnKRW;
        accountWithdrawals.push({ id: a.id, name: a.name, withdrawnKRW });

        const balanceAfterWithdrawal = a.balance - withdrawnUSD;
        const balanceAfterGrowth = balanceAfterWithdrawal * (1 + a.expectedReturn / 100);
        return { ...a, balance: balanceAfterGrowth };
      });

      const totalWithdrawnKRW = nonBufferWithdrawnKRW + bufferWithdrawnKRW;
      const totalBalanceUSD = accState.reduce((sum, a) => sum + a.balance, 0);
      const totalBalanceKRW = (totalBalanceUSD * effectiveFxRate) / 1e8;

      // 여전히 부족한 경우 (자동조정 계좌 최소인출+부족분 충당으로도 못 채운 경우) → 부족분
      const shortfallKRW = Math.max(0, netNeedKRW - totalWithdrawnKRW);
      // 전체 인출액이 필요액을 초과한 경우 → 잉여현금 (자동조정 계좌 최소인출률로 인한 초과 포함)
      const surplusKRW = Math.max(0, totalWithdrawnKRW - netNeedKRW);

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
        accountWithdrawals,
      });
    }
    return rows;
  }, [accounts, fxRate, fxAdjustKRW, baseMonthlyLivingKRW, expenseAdjustPct, inflationPct, ssMonthlyUSD, ssColaPct, ssStartAge]);

  const chartData = simulation.map(r => ({
    age: r.age,
    '자산잔액(억원)': Math.round(r.totalBalanceKRW * 10) / 10,
    '필요생활비(억원)': Math.round(r.netNeedKRW * 100) / 100,
    '계좌인출액(억원)': Math.round(r.totalWithdrawnKRW * 100) / 100,
  }));

  const depletionAge = simulation.find(r => r.totalBalanceUSD <= 0)?.age;
  const shortfallYears = simulation.filter(r => r.shortfallKRW > 0).length;
  const lastRow = simulation[simulation.length - 1];

  return (
    <div>
      {/* ===== 설정 버튼 ===== */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Settings size={13} /> 설정
        </button>
      </div>

      {settingsOpen && (
        <RetirementSettingsModal
          onClose={() => setSettingsOpen(false)}
          baseMonthlyLivingKRW={baseMonthlyLivingKRW} setBaseMonthlyLivingKRW={setBaseMonthlyLivingKRW}
          expenseAdjustPct={expenseAdjustPct} setExpenseAdjustPct={setExpenseAdjustPct}
          inflationPct={inflationPct} setInflationPct={setInflationPct}
          fxRate={fxRate}
          fxAdjustKRW={fxAdjustKRW} setFxAdjustKRW={setFxAdjustKRW}
          ssMonthlyUSD={ssMonthlyUSD} setSsMonthlyUSD={setSsMonthlyUSD}
          ssColaPct={ssColaPct} setSsColaPct={setSsColaPct}
          ssStartAge={ssStartAge} setSsStartAge={setSsStartAge}
          accounts={accounts}
          updateAccount={updateAccount}
          setBufferAccount={setBufferAccount}
          addScheduleRule={addScheduleRule}
          updateScheduleRule={updateScheduleRule}
          removeScheduleRule={removeScheduleRule}
          realAccounts={realAccounts}
          linkAccount={linkAccount}
        />
      )}

      {/* ===== 현재 설정 요약 ===== */}
      <SettingsSummary
        baseMonthlyLivingKRW={baseMonthlyLivingKRW}
        fxRate={fxRate} fxAdjustKRW={fxAdjustKRW}
        inflationPct={inflationPct} expenseAdjustPct={expenseAdjustPct}
        ssMonthlyUSD={ssMonthlyUSD} ssColaPct={ssColaPct} ssStartAge={ssStartAge}
        accounts={accounts}
      />

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
                <th>출금상세</th>
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
                  <td><WithdrawalDetailButton items={r.accountWithdrawals} /></td>
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
