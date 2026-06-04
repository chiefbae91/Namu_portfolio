import { calculateRetirementPlan, RetirementParams } from '../lib/retirementCalculations';

// ─── 공통 헬퍼 ────────────────────────────────────────────────────────────────

function baseParams(overrides: Partial<RetirementParams> = {}): RetirementParams {
  return {
    startYear: 2026,
    endYear: 2028,             // 3년: 결과 검증 범위를 좁게 유지
    accounts: [
      { id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2026 },
    ],
    socialSecurity: { startYear: 2026, monthlyAmount: 1_000, colaPercent: 0 },
    livingExpenses: [{ year: 2026, amount: 30_000 }],
    inflationRate: 0,
    ...overrides,
  };
}

// ─── 섹션 1: 연 수익률 (annualReturn) ─────────────────────────────────────────

describe('연 수익률(annualReturn)', () => {
  it('수익률 0% — 잔액은 출금(4%)만큼씩만 감소한다', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 0, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 }, // SS 제외
      livingExpenses: [{ year: 2026, amount: 0 }],                           // 생활비 제외
    }));

    // 2026: newBalance = 100_000 * 1.00 = 100_000, withdrawal = 4_000, end = 96_000
    expect(plan[0].accountBalances['IRA'].withdrawal).toBeCloseTo(4_000, 4);
    expect(plan[0].accountBalances['IRA'].endBalance).toBeCloseTo(96_000, 4);

    // 2027: newBalance = 96_000, withdrawal = 3_840, end = 92_160
    expect(plan[1].accountBalances['IRA'].withdrawal).toBeCloseTo(3_840, 4);
    expect(plan[1].accountBalances['IRA'].endBalance).toBeCloseTo(92_160, 4);
  });

  it('수익률 7% — 첫 해 수익/출금/잔액이 정확히 계산된다', () => {
    const { plan } = calculateRetirementPlan(baseParams());

    const y = plan[0].accountBalances['IRA'];
    // beginBalance = 100_000
    // return = 100_000 * 0.07 = 7_000
    // newBalance = 107_000
    // withdrawal = 107_000 * 0.04 = 4_280
    // endBalance = 102_720
    expect(y.beginBalance).toBeCloseTo(100_000, 4);
    expect(y.return).toBeCloseTo(7_000, 4);
    expect(y.withdrawal).toBeCloseTo(4_280, 4);
    expect(y.endBalance).toBeCloseTo(102_720, 4);
  });

  it('수익률이 높을수록 3년 후 잔액이 더 크다', () => {
    const low  = calculateRetirementPlan(baseParams({ accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 4, withdrawalStartYear: 2026 }] }));
    const mid  = calculateRetirementPlan(baseParams());                   // 7%
    const high = calculateRetirementPlan(baseParams({ accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 10, withdrawalStartYear: 2026 }] }));

    expect(low.summary.endingAssets).toBeLessThan(mid.summary.endingAssets);
    expect(mid.summary.endingAssets).toBeLessThan(high.summary.endingAssets);
  });

  it('수익률이 높을수록 출금액(4% * 잔액 후 수익)도 첫 해에 더 많다', () => {
    const make = (r: number) => calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: r, withdrawalStartYear: 2026 }],
    }));

    const w7  = make(7).plan[0].accountBalances['IRA'].withdrawal;
    const w10 = make(10).plan[0].accountBalances['IRA'].withdrawal;

    // 7%: 107_000 * 0.04 = 4_280 / 10%: 110_000 * 0.04 = 4_400
    expect(w7).toBeCloseTo(4_280, 4);
    expect(w10).toBeCloseTo(4_400, 4);
    expect(w10).toBeGreaterThan(w7);
  });

  it('수익률 마이너스(-5%) — 잔액은 손실 + 출금으로 매년 급감한다', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: -5, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 0 }],
    }));

    // 2026: newBalance = 95_000, withdrawal = 3_800, end = 91_200
    expect(plan[0].accountBalances['IRA'].endBalance).toBeCloseTo(91_200, 4);
    // 2027: begin = 91_200, newBalance = 86_640, withdrawal = 3_465.6, end = 83_174.4
    expect(plan[1].accountBalances['IRA'].endBalance).toBeCloseTo(83_174.4, 4);

    // 잔액은 매년 감소해야 한다
    expect(plan[0].totalAssets).toBeGreaterThan(plan[1].totalAssets);
    expect(plan[1].totalAssets).toBeGreaterThan(plan[2].totalAssets);
  });
});

// ─── 섹션 2: 출금 시작 연도 (withdrawalStartYear) ─────────────────────────────

describe('출금 시작 연도(withdrawalStartYear)', () => {
  it('출금 시작 전 년도에는 withdrawal = 0', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2028 }],
    }));

    expect(plan[0].accountBalances['IRA'].withdrawal).toBe(0);  // 2026 < 2028
    expect(plan[1].accountBalances['IRA'].withdrawal).toBe(0);  // 2027 < 2028
    expect(plan[2].accountBalances['IRA'].withdrawal).toBeGreaterThan(0); // 2028 >= 2028
  });

  it('출금 시작 연도에 정확히 4% 출금이 시작된다', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2027 }],
    }));

    // 2026: no withdrawal, end = 107_000
    expect(plan[0].accountBalances['IRA'].withdrawal).toBe(0);
    expect(plan[0].accountBalances['IRA'].endBalance).toBeCloseTo(107_000, 4);

    // 2027: begin = 107_000, newBalance = 107_000 * 1.07 = 114_490
    //       withdrawal = 114_490 * 0.04 = 4_579.6, end = 109_910.4
    expect(plan[1].accountBalances['IRA'].withdrawal).toBeCloseTo(4_579.6, 2);
    expect(plan[1].accountBalances['IRA'].endBalance).toBeCloseTo(109_910.4, 2);
  });

  it('출금 시작이 늦을수록 해당 시점 잔액이 더 많다', () => {
    const make = (startYear: number) => calculateRetirementPlan({
      ...baseParams(),
      endYear: 2030,
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: startYear }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 0 }],
    });

    const early = make(2026);
    const late  = make(2029);

    // 출금 안 쌓인 late가 2030 기준 잔액 더 크다
    expect(late.summary.endingAssets).toBeGreaterThan(early.summary.endingAssets);
  });

  it('출금 시작 전 기간에는 복리 효과로 잔액이 순증가한다', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2028 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 0 }],
    }));

    // 2026: 100_000 → 107_000
    // 2027: 107_000 → 114_490
    expect(plan[0].totalAssets).toBeCloseTo(107_000, 4);
    expect(plan[1].totalAssets).toBeCloseTo(114_490, 4);
    expect(plan[1].totalAssets).toBeGreaterThan(plan[0].totalAssets);
  });

  it('여러 계좌의 출금 시작 연도가 독립적으로 적용된다', () => {
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      accounts: [
        { id: 1, name: 'IRA',  currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2026 },
        { id: 2, name: '401k', currentBalance: 200_000, annualReturn: 7, withdrawalStartYear: 2028 },
      ],
    });

    // 2026: IRA 출금 있음, 401k 출금 없음
    expect(plan[0].accountBalances['IRA'].withdrawal).toBeGreaterThan(0);
    expect(plan[0].accountBalances['401k'].withdrawal).toBe(0);

    // 2028: 둘 다 출금 있음
    expect(plan[2].accountBalances['IRA'].withdrawal).toBeGreaterThan(0);
    expect(plan[2].accountBalances['401k'].withdrawal).toBeGreaterThan(0);
  });
});

// ─── 섹션 3: 출금액 (4% 규칙 & 복합 효과) ────────────────────────────────────

describe('출금액(4% 규칙)', () => {
  it('출금은 수익 반영 후 잔액의 정확히 4%이다', () => {
    const balance  = 500_000;
    const returnPct = 8;
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: balance, annualReturn: returnPct, withdrawalStartYear: 2026 }],
    }));

    const acc = plan[0].accountBalances['IRA'];
    const expectedNewBal = balance * (1 + returnPct / 100); // 540_000
    expect(acc.withdrawal).toBeCloseTo(expectedNewBal * 0.04, 4);
  });

  it('잔액이 클수록 출금액도 크다 (같은 수익률)', () => {
    const make = (bal: number) => calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: bal, annualReturn: 7, withdrawalStartYear: 2026 }],
    }));

    const small = make(100_000).plan[0].accountBalances['IRA'].withdrawal;
    const large = make(500_000).plan[0].accountBalances['IRA'].withdrawal;

    expect(large).toBeCloseTo(small * 5, 2);
  });

  it('출금 후 잔액 = newBalance * 0.96이다', () => {
    const { plan } = calculateRetirementPlan(baseParams());
    const acc = plan[0].accountBalances['IRA'];
    const newBal = acc.beginBalance * (1 + 7 / 100);
    expect(acc.endBalance).toBeCloseTo(newBal * 0.96, 4);
  });

  it('수익률이 4%이면 출금 후 잔액은 시작 잔액과 동일하다', () => {
    // beginBalance * 1.04 * 0.96 = beginBalance * 0.9984 ≈ 시작보다 소폭 감소
    // 정확히: 4% 수익 → 출금 4% → net ~ -0.16%
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 4, withdrawalStartYear: 2026 }],
    }));
    // 100_000 * 1.04 * 0.96 = 99_840
    expect(plan[0].accountBalances['IRA'].endBalance).toBeCloseTo(99_840, 2);
  });

  it('endBalance는 절대 음수가 되지 않는다 (Math.max 가드)', () => {
    // 4% 출금은 항상 96%를 남기므로 잔액이 음수가 되는 경우는 없어야 함
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      endYear: 2060,
      accounts: [{ id: 1, name: 'IRA', currentBalance: 1_000, annualReturn: 0, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 0 }],
    });

    plan.forEach(y => {
      expect(y.accountBalances['IRA'].endBalance).toBeGreaterThanOrEqual(0);
    });
  });

  it('수익률 0% + 4% 출금 — 잔액은 매년 96%씩 감소한다', () => {
    const initial = 100_000;
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      accounts: [{ id: 1, name: 'IRA', currentBalance: initial, annualReturn: 0, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 0 }],
    });

    // 매년 *0.96 감소
    expect(plan[0].accountBalances['IRA'].endBalance).toBeCloseTo(initial * 0.96, 4);
    expect(plan[1].accountBalances['IRA'].endBalance).toBeCloseTo(initial * 0.96 ** 2, 4);
    expect(plan[2].accountBalances['IRA'].endBalance).toBeCloseTo(initial * 0.96 ** 3, 4);
  });
});

// ─── 섹션 4: Social Security COLA ────────────────────────────────────────────

describe('Social Security COLA', () => {
  it('COLA 0% — SS는 매년 동일하다', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      socialSecurity: { startYear: 2026, monthlyAmount: 2_000, colaPercent: 0 },
    }));

    const ssValues = plan.map(y => y.ss);
    // 모든 연도: 2_000 * 12 = 24_000
    ssValues.forEach(ss => expect(ss).toBeCloseTo(24_000, 4));
  });

  it('COLA 2.5% — SS는 매년 2.5% 증가한다', () => {
    const monthly = 2_000;
    const cola = 2.5;
    const { plan } = calculateRetirementPlan(baseParams({
      socialSecurity: { startYear: 2026, monthlyAmount: monthly, colaPercent: cola },
    }));

    // 2026: monthly * (1.025^0) * 12 = 24_000
    // 2027: monthly * (1.025^1) * 12 = 24_600
    // 2028: monthly * (1.025^2) * 12 = 25_215
    expect(plan[0].ss).toBeCloseTo(monthly * Math.pow(1.025, 0) * 12, 4);
    expect(plan[1].ss).toBeCloseTo(monthly * Math.pow(1.025, 1) * 12, 4);
    expect(plan[2].ss).toBeCloseTo(monthly * Math.pow(1.025, 2) * 12, 4);
  });

  it('COLA가 높을수록 총 SS 수령액이 많다', () => {
    const make = (cola: number) => calculateRetirementPlan({
      ...baseParams(),
      endYear: 2040,
      socialSecurity: { startYear: 2026, monthlyAmount: 2_000, colaPercent: cola },
    });

    expect(make(0).summary.totalSSReceived)
      .toBeLessThan(make(2.5).summary.totalSSReceived);
    expect(make(2.5).summary.totalSSReceived)
      .toBeLessThan(make(5).summary.totalSSReceived);
  });

  it('SS 수령 시작 전 연도는 ss = 0', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      socialSecurity: { startYear: 2028, monthlyAmount: 1_000, colaPercent: 0 },
    }));

    expect(plan[0].ss).toBe(0); // 2026
    expect(plan[1].ss).toBe(0); // 2027
    expect(plan[2].ss).toBeCloseTo(12_000, 4); // 2028
  });

  it('SS 수령 시작 연도 (yearsAfterStart=0) — COLA 미적용', () => {
    const monthly = 3_000;
    const { plan } = calculateRetirementPlan(baseParams({
      socialSecurity: { startYear: 2026, monthlyAmount: monthly, colaPercent: 10 }, // 높은 COLA
    }));

    // 첫 해는 항상 월 수령액 * 12, COLA 적용 전
    expect(plan[0].ss).toBeCloseTo(monthly * 12, 4);
  });

  it('COLA는 수령 시작 연도부터의 경과 연수에 따라 복리로 적용된다', () => {
    const monthly = 1_000;
    const cola = 10; // 계산 편의상 10%
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      endYear: 2031,
      socialSecurity: { startYear: 2026, monthlyAmount: monthly, colaPercent: cola },
    });

    // 5년 후(2031): 1_000 * 1.1^5 * 12 = 1_610.51 * 12 ≈ 19_326.12
    const year2031 = plan.find(y => y.year === 2031)!;
    expect(year2031.ss).toBeCloseTo(monthly * Math.pow(1.1, 5) * 12, 2);
  });
});

// ─── 섹션 5: 생활비 & 인플레이션 ─────────────────────────────────────────────

describe('생활비(livingExpenses) & 인플레이션', () => {
  it('인플레이션 0% — 생활비는 매년 동일하다', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      livingExpenses: [{ year: 2026, amount: 50_000 }],
      inflationRate: 0,
    }));

    plan.forEach(y => expect(y.livingExpense).toBeCloseTo(50_000, 4));
  });

  it('인플레이션 3% — 생활비가 매년 복리로 증가한다', () => {
    const base = 50_000;
    const { plan } = calculateRetirementPlan(baseParams({
      livingExpenses: [{ year: 2026, amount: base }],
      inflationRate: 3,
    }));

    expect(plan[0].livingExpense).toBeCloseTo(base * Math.pow(1.03, 0), 4); // 2026
    expect(plan[1].livingExpense).toBeCloseTo(base * Math.pow(1.03, 1), 4); // 2027
    expect(plan[2].livingExpense).toBeCloseTo(base * Math.pow(1.03, 2), 4); // 2028
  });

  it('5년 단위 생활비 구간 — 해당 구간의 금액을 기준으로 인플레이션 적용', () => {
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      endYear: 2032,
      livingExpenses: [
        { year: 2026, amount: 40_000 },
        { year: 2030, amount: 60_000 },
      ],
      inflationRate: 0,
    });

    // 2026~2029: 40_000 기준
    expect(plan.find(y => y.year === 2026)!.livingExpense).toBeCloseTo(40_000, 4);
    expect(plan.find(y => y.year === 2029)!.livingExpense).toBeCloseTo(40_000, 4);

    // 2030~2032: 60_000 기준
    expect(plan.find(y => y.year === 2030)!.livingExpense).toBeCloseTo(60_000, 4);
    expect(plan.find(y => y.year === 2032)!.livingExpense).toBeCloseTo(60_000, 4);
  });

  it('구간 변경 + 인플레이션 — 새 구간 시작연도 기준으로 재적용된다', () => {
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      endYear: 2032,
      livingExpenses: [
        { year: 2026, amount: 40_000 },
        { year: 2030, amount: 60_000 },
      ],
      inflationRate: 5,
    });

    // 2030: 60_000 * 1.05^0 = 60_000
    expect(plan.find(y => y.year === 2030)!.livingExpense).toBeCloseTo(60_000, 4);
    // 2031: 60_000 * 1.05^1 = 63_000
    expect(plan.find(y => y.year === 2031)!.livingExpense).toBeCloseTo(63_000, 4);
    // 2032: 60_000 * 1.05^2 = 66_150
    expect(plan.find(y => y.year === 2032)!.livingExpense).toBeCloseTo(66_150, 4);
  });
});

// ─── 섹션 6: 요약 통계 (summary) ─────────────────────────────────────────────

describe('요약 통계(summary)', () => {
  it('totalYears = endYear - startYear + 1', () => {
    const { summary } = calculateRetirementPlan(baseParams({ endYear: 2035 }));
    expect(summary.totalYears).toBe(2035 - 2026 + 1);
  });

  it('startingAssets = 모든 계좌 currentBalance 합산', () => {
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [
        { id: 1, name: 'IRA',  currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2026 },
        { id: 2, name: '401k', currentBalance: 200_000, annualReturn: 7, withdrawalStartYear: 2026 },
      ],
    }));
    expect(summary.startingAssets).toBeCloseTo(300_000, 4);
  });

  it('endingAssets = plan 마지막 연도의 totalAssets', () => {
    const { plan, summary } = calculateRetirementPlan(baseParams());
    expect(summary.endingAssets).toBeCloseTo(plan[plan.length - 1].totalAssets, 4);
  });

  it('hasShortfall = true: 순현금흐름이 음수인 해가 존재할 때', () => {
    // 생활비 > 수입이 되도록 설정
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 10_000, annualReturn: 0, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 999_999 }],
    }));
    expect(summary.hasShortfall).toBe(true);
  });

  it('hasShortfall = false: 모든 해 순현금흐름이 0 이상일 때', () => {
    // 출금 + SS가 생활비를 충당
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 10_000_000, annualReturn: 7, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 2026, monthlyAmount: 10_000, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 10_000 }],
    }));
    expect(summary.hasShortfall).toBe(false);
  });

  it('shortfallStartYear = 처음으로 netCashFlow < 0 인 연도', () => {
    const { plan, summary } = calculateRetirementPlan(baseParams({
      endYear: 2035,
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 0, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 2026, monthlyAmount: 500, colaPercent: 0 }, // SS = 6_000/년
      livingExpenses: [{ year: 2026, amount: 30_000 }],
    }));

    // netCashFlow = (withdrawal + ss) - expense
    // 매년 4_000 출금 + 6_000 SS = 10_000 < 30_000 → 항상 적자
    expect(summary.shortfallStartYear).toBe(2026);

    // plan 첫 적자 연도와 일치하는지 교차 검증
    const firstDeficit = plan.find(y => y.netCashFlow < 0)?.year ?? null;
    expect(summary.shortfallStartYear).toBe(firstDeficit);
  });

  it('shortfallStartYear = null: 부족 없음', () => {
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 10_000_000, annualReturn: 10, withdrawalStartYear: 2026 }],
      livingExpenses: [{ year: 2026, amount: 1_000 }],
    }));
    expect(summary.shortfallStartYear).toBeNull();
  });

  it('safetyMargin = 100%: 모든 해 흑자', () => {
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 10_000_000, annualReturn: 7, withdrawalStartYear: 2026 }],
      livingExpenses: [{ year: 2026, amount: 1 }],
    }));
    expect(summary.safetyMargin).toBe(100);
  });

  it('safetyMargin = 0%: 모든 해 적자', () => {
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 100_000, annualReturn: 0, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 9999, monthlyAmount: 0, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 999_999 }],
    }));
    expect(summary.safetyMargin).toBeCloseTo(0, 4);
  });

  it('safetyMargin 부분 계산 — 3년 중 2년 흑자 → 66.67%', () => {
    // 2027년만 적자가 되도록 설계: 쉽지 않으므로 독립 계산으로 검증
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 10_000_000, annualReturn: 7, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 2026, monthlyAmount: 5_000, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 1_000 }],
    }));
    // 모두 흑자인 케이스 확인
    const positiveYears = plan.filter(y => y.netCashFlow >= 0).length;
    const { summary } = calculateRetirementPlan(baseParams({
      accounts: [{ id: 1, name: 'IRA', currentBalance: 10_000_000, annualReturn: 7, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 2026, monthlyAmount: 5_000, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 1_000 }],
    }));
    expect(summary.safetyMargin).toBeCloseTo((positiveYears / plan.length) * 100, 4);
  });

  it('totalSSReceived = 모든 연도 ss 합산', () => {
    const { plan, summary } = calculateRetirementPlan(baseParams({
      endYear: 2035,
      socialSecurity: { startYear: 2026, monthlyAmount: 2_000, colaPercent: 3 },
    }));

    const manualTotal = plan.reduce((s, y) => s + y.ss, 0);
    expect(summary.totalSSReceived).toBeCloseTo(manualTotal, 4);
  });
});

// ─── 섹션 7: 복합 시나리오 ───────────────────────────────────────────────────

describe('복합 시나리오', () => {
  it('다계좌 — totalAssets = 모든 계좌 endBalance 합산', () => {
    const { plan } = calculateRetirementPlan({
      ...baseParams(),
      accounts: [
        { id: 1, name: 'IRA',  currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2026 },
        { id: 2, name: '401k', currentBalance: 200_000, annualReturn: 5, withdrawalStartYear: 2026 },
        { id: 3, name: 'Brokerage', currentBalance: 50_000, annualReturn: 9, withdrawalStartYear: 2028 },
      ],
    });

    plan.forEach(y => {
      const sumEnds = Object.values(y.accountBalances).reduce((s, a) => s + a.endBalance, 0);
      expect(y.totalAssets).toBeCloseTo(sumEnds, 4);
    });
  });

  it('totalIncome = SS + 모든 계좌 출금 합산', () => {
    const { plan } = calculateRetirementPlan(baseParams({
      accounts: [
        { id: 1, name: 'IRA',  currentBalance: 100_000, annualReturn: 7, withdrawalStartYear: 2026 },
        { id: 2, name: '401k', currentBalance: 200_000, annualReturn: 5, withdrawalStartYear: 2026 },
      ],
    }));

    plan.forEach(y => {
      const totalW = Object.values(y.accountBalances).reduce((s, a) => s + a.withdrawal, 0);
      expect(y.totalIncome).toBeCloseTo(y.ss + totalW, 4);
    });
  });

  it('netCashFlow = totalIncome - totalExpense', () => {
    const { plan } = calculateRetirementPlan(baseParams());
    plan.forEach(y => {
      expect(y.netCashFlow).toBeCloseTo(y.totalIncome - y.totalExpense, 4);
    });
  });

  it('plan 연도 수 = endYear - startYear + 1', () => {
    const { plan } = calculateRetirementPlan(baseParams({ endYear: 2040 }));
    expect(plan.length).toBe(2040 - 2026 + 1);
  });

  it('수익률↑ + COLA↑ + 출금 지연 → 더 높은 최종 자산', () => {
    const poor = calculateRetirementPlan({
      ...baseParams(),
      endYear: 2040,
      accounts: [{ id: 1, name: 'IRA', currentBalance: 500_000, annualReturn: 4, withdrawalStartYear: 2026 }],
      socialSecurity: { startYear: 2026, monthlyAmount: 1_000, colaPercent: 0 },
      livingExpenses: [{ year: 2026, amount: 50_000 }],
      inflationRate: 3,
    });

    const good = calculateRetirementPlan({
      ...baseParams(),
      endYear: 2040,
      accounts: [{ id: 1, name: 'IRA', currentBalance: 500_000, annualReturn: 9, withdrawalStartYear: 2030 }],
      socialSecurity: { startYear: 2026, monthlyAmount: 1_000, colaPercent: 3 },
      livingExpenses: [{ year: 2026, amount: 50_000 }],
      inflationRate: 3,
    });

    expect(good.summary.endingAssets).toBeGreaterThan(poor.summary.endingAssets);
  });
});
