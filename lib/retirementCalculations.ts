export interface RetirementAccount {
  id: string | number;
  name: string;
  currentBalance: number;
  annualReturn: number;
  withdrawalStartYear: number;
}

export interface SocialSecurity {
  startYear: number;
  monthlyAmount: number;
  colaPercent: number;
}

export interface LivingExpense {
  year: number;
  amount: number;
}

export interface RetirementParams {
  startYear: number;
  endYear: number;
  accounts: RetirementAccount[];
  socialSecurity: SocialSecurity;
  livingExpenses: LivingExpense[];
  inflationRate: number;
}

export interface AccountYearData {
  beginBalance: number;
  return: number;
  withdrawal: number;
  endBalance: number;
}

export interface YearData {
  year: number;
  accountBalances: Record<string, AccountYearData>;
  ss: number;
  livingExpense: number;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  totalAssets: number;
}

export interface RetirementSummary {
  totalYears: number;
  startingAssets: number;
  endingAssets: number;
  hasShortfall: boolean;
  shortfallStartYear: number | null;
  totalSSReceived: number;
  safetyMargin: number;
}

export interface RetirementResult {
  plan: YearData[];
  summary: RetirementSummary;
}

function getLivingExpenseForYear(
  year: number,
  livingExpenses: LivingExpense[],
  inflationRate: number
): number {
  const sorted = [...livingExpenses].sort((a, b) => a.year - b.year);
  let current = sorted[0];
  for (const expense of sorted) {
    if (expense.year <= year) current = expense;
    else break;
  }
  const yearsDiff = year - current.year;
  return current.amount * Math.pow(1 + inflationRate / 100, yearsDiff);
}

function calculateSafetyMargin(plan: YearData[]): number {
  const positiveYears = plan.filter(y => y.netCashFlow >= 0).length;
  return (positiveYears / plan.length) * 100;
}

export function calculateRetirementPlan(params: RetirementParams): RetirementResult {
  const { startYear, endYear, accounts, socialSecurity, livingExpenses, inflationRate } = params;

  const balances = accounts.map(a => ({ ...a }));
  const plan: YearData[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearData: YearData = {
      year,
      accountBalances: {},
      ss: 0,
      livingExpense: 0,
      totalIncome: 0,
      totalExpense: 0,
      netCashFlow: 0,
      totalAssets: 0,
    };

    let totalAssets = 0;
    balances.forEach((acc, idx) => {
      if (acc.currentBalance <= 0) {
        yearData.accountBalances[acc.name] = { beginBalance: 0, return: 0, withdrawal: 0, endBalance: 0 };
        return;
      }
      const beginBalance = acc.currentBalance;
      const ret = beginBalance * (acc.annualReturn / 100);
      let newBalance = beginBalance + ret;

      let withdrawal = 0;
      if (year >= acc.withdrawalStartYear) {
        withdrawal = newBalance * 0.04;
        newBalance -= withdrawal;
      }
      newBalance = Math.max(0, newBalance);
      balances[idx].currentBalance = newBalance;

      yearData.accountBalances[acc.name] = { beginBalance, return: ret, withdrawal, endBalance: newBalance };
      totalAssets += newBalance;
    });

    yearData.totalAssets = totalAssets;

    if (year >= socialSecurity.startYear) {
      const yearsAfterStart = year - socialSecurity.startYear;
      const monthly = socialSecurity.monthlyAmount * Math.pow(1 + socialSecurity.colaPercent / 100, yearsAfterStart);
      yearData.ss = monthly * 12;
    }

    yearData.livingExpense = getLivingExpenseForYear(year, livingExpenses, inflationRate);
    yearData.totalExpense = yearData.livingExpense;

    const totalWithdrawals = Object.values(yearData.accountBalances).reduce((s, a) => s + a.withdrawal, 0);
    yearData.totalIncome = yearData.ss + totalWithdrawals;
    yearData.netCashFlow = yearData.totalIncome - yearData.totalExpense;

    plan.push(yearData);
  }

  const summary: RetirementSummary = {
    totalYears: endYear - startYear + 1,
    startingAssets: accounts.reduce((s, a) => s + a.currentBalance, 0),
    endingAssets: plan[plan.length - 1]?.totalAssets ?? 0,
    hasShortfall: plan.some(y => y.netCashFlow < 0),
    shortfallStartYear: plan.find(y => y.netCashFlow < 0)?.year ?? null,
    totalSSReceived: plan.reduce((s, y) => s + y.ss, 0),
    safetyMargin: calculateSafetyMargin(plan),
  };

  return { plan, summary };
}
