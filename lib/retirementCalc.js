export function runSimulation(params) {
  const {
    currentAge,
    retireAge,
    endAge,
    currentYear,
    portfolioBalance,
    annualReturn,
    withdrawalRate,
    ssStartAge,
    ssMonthly,
    ssCola,
    livingExpenses,
    inflation
  } = params;

  const rows = [];
  let balance = portfolioBalance;

  const totalYears = endAge - currentAge;

  for (let i = 0; i <= totalYears; i++) {
    const age = currentAge + i;
    const year = currentYear + i;

    const annualGain = balance * (annualReturn / 100);

    let withdrawal = 0;
    if (age >= retireAge) {
      withdrawal = balance * (withdrawalRate / 100);
    }

    let ssAnnual = 0;
    if (age >= ssStartAge) {
      const yearsAfterSS = age - ssStartAge;
      const ssMonthlyAmt = ssMonthly * Math.pow(1 + ssCola / 100, yearsAfterSS);
      ssAnnual = ssMonthlyAmt * 12;
    }

    const expenseBlock = [...livingExpenses]
      .sort((a, b) => a.fromAge - b.fromAge)
      .reverse()
      .find(e => age >= e.fromAge);

    const baseExpense = expenseBlock ? expenseBlock.monthly * 12 : 0;
    const yearsFromStart = age - currentAge;
    const inflatedExpense = baseExpense * Math.pow(1 + inflation / 100, yearsFromStart);

    balance = Math.max(0, balance + annualGain - withdrawal);

    const income = withdrawal + ssAnnual;
    const netCashFlow = income - inflatedExpense;

    rows.push({
      age,
      year,
      annualGain: Math.round(annualGain),
      withdrawal: Math.round(withdrawal),
      ssAnnual: Math.round(ssAnnual),
      livingExpense: Math.round(inflatedExpense),
      netCashFlow: Math.round(netCashFlow),
      balance: Math.round(balance)
    });
  }

  const shortfallRow = rows.find(r => r.netCashFlow < 0);
  const finalBalance = rows[rows.length - 1]?.balance || 0;
  const totalSS = rows.reduce((sum, r) => sum + r.ssAnnual, 0);
  const safeYears = rows.filter(r => r.netCashFlow >= 0).length;

  return {
    rows,
    summary: {
      finalBalance,
      shortfallAge: shortfallRow?.age || null,
      totalSS: Math.round(totalSS),
      safetyRate: Math.round((safeYears / rows.length) * 100)
    }
  };
}
