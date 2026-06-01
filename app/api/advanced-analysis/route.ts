import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

interface TxRow {
  date: string;
  ticker: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  account_id: string;
}

interface ClosedTrade {
  ticker: string;
  buyDate: Date;
  buyPrice: number;
  sellDate: Date;
  sellPrice: number;
  quantity: number;
  holdDays: number;
  realizedPnl: number;
  realizedPnlPct: number;
  isLongTerm: boolean;
}

function matchTrades(txs: TxRow[]): ClosedTrade[] {
  const groups = new Map<string, TxRow[]>();
  for (const tx of txs) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;
    const key = `${tx.account_id}:${tx.ticker}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const trades: ClosedTrade[] = [];

  for (const [, tickerTxs] of groups) {
    tickerTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const buyQueue: Array<{ date: Date; price: number; qty: number; ticker: string }> = [];

    for (const tx of tickerTxs) {
      if (tx.type === 'buy') {
        buyQueue.push({ date: new Date(tx.date), price: tx.price, qty: tx.quantity, ticker: tx.ticker });
      } else if (tx.type === 'sell') {
        let remaining = tx.quantity;
        const sellDate = new Date(tx.date);
        while (remaining > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0];
          const qty = Math.min(buy.qty, remaining);
          const holdDays = Math.floor((sellDate.getTime() - buy.date.getTime()) / 86400000);
          trades.push({
            ticker: tx.ticker,
            buyDate: buy.date,
            buyPrice: buy.price,
            sellDate,
            sellPrice: tx.price,
            quantity: qty,
            holdDays: Math.max(0, holdDays),
            realizedPnl: (tx.price - buy.price) * qty,
            realizedPnlPct: ((tx.price - buy.price) / buy.price) * 100,
            isLongTerm: holdDays >= 365,
          });
          buy.qty -= qty;
          remaining -= qty;
          if (buy.qty <= 0) buyQueue.shift();
        }
      }
    }
  }

  return trades;
}

function calcFomoScore(txs: TxRow[]): { score: number; detail: string; recommendation: string | null } {
  const byTicker = new Map<string, number[]>();
  const buysByTicker = new Map<string, Array<{ price: number; qty: number }>>() ;

  for (const tx of txs) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;
    if (!byTicker.has(tx.ticker)) byTicker.set(tx.ticker, []);
    byTicker.get(tx.ticker)!.push(tx.price);
    if (tx.type === 'buy') {
      if (!buysByTicker.has(tx.ticker)) buysByTicker.set(tx.ticker, []);
      buysByTicker.get(tx.ticker)!.push({ price: tx.price, qty: tx.quantity });
    }
  }

  let totalWeighted = 0, totalWeight = 0;

  for (const [ticker, buys] of buysByTicker) {
    const prices = byTicker.get(ticker) || [];
    if (prices.length < 2) continue;
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    if (maxP === minP) continue;
    for (const buy of buys) {
      const ratio = (buy.price - minP) / (maxP - minP);
      const w = buy.qty * buy.price;
      totalWeighted += ratio * w;
      totalWeight += w;
    }
  }

  if (totalWeight === 0) return { score: 50, detail: '거래 데이터가 부족합니다.', recommendation: null };

  const score = Math.round((totalWeighted / totalWeight) * 100);
  const level = score >= 70 ? '높음' : score >= 40 ? '중간' : '낮음';

  return {
    score,
    detail: `FOMO 점수: ${score}/100 (${level})`,
    recommendation: score >= 65
      ? '저점 근처에서 매수하는 훈련이 필요합니다. 가격이 급등한 후 매수하는 경향이 있습니다.'
      : score <= 35
      ? '저점 근처에서 매수하는 훌륭한 습관이 있습니다. 계속 유지하세요.'
      : null,
  };
}

function calcStopLossScore(trades: ClosedTrade[]): {
  score: number; avgLossPct: number; avgLossDays: number; detail: string; recommendation: string | null;
} {
  const losing = trades.filter(t => t.realizedPnlPct < 0);
  if (losing.length === 0) {
    return { score: 90, avgLossPct: 0, avgLossDays: 0, detail: '손절 능력: 90/100 (우수)', recommendation: null };
  }

  const avgLossPct = losing.reduce((s, t) => s + Math.abs(t.realizedPnlPct), 0) / losing.length;
  const avgLossDays = losing.reduce((s, t) => s + t.holdDays, 0) / losing.length;

  const lossPenalty = Math.min(avgLossPct / 25 * 50, 50);
  const daysPenalty = Math.min(avgLossDays / 150 * 50, 50);
  const score = Math.max(0, Math.min(100, Math.round(100 - lossPenalty - daysPenalty)));

  const level = score >= 75 ? '우수' : score >= 50 ? '보통' : '개선 필요';
  const recommendation = score < 50
    ? `평균 손실률이 ${avgLossPct.toFixed(1)}%이고 평균 ${Math.round(avgLossDays)}일 후 손절합니다. 더 빠른 손절이 필요합니다.`
    : score >= 75
    ? '손절 능력이 우수합니다. 현재 방식을 유지하세요.'
    : null;

  return {
    score,
    avgLossPct,
    avgLossDays,
    detail: `손절 능력: ${score}/100 (${level}) — 평균 손실률: ${avgLossPct.toFixed(1)}%, 평균 손절 기간: ${Math.round(avgLossDays)}일`,
    recommendation,
  };
}

function calcConcentration(txs: TxRow[]): {
  score: number;
  topHoldings: { ticker: string; pct: number }[];
  detail: string;
  recommendation: string | null;
} {
  const volByTicker = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== 'buy') continue;
    volByTicker.set(tx.ticker, (volByTicker.get(tx.ticker) || 0) + tx.quantity * tx.price);
  }

  const total = [...volByTicker.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return { score: 0, topHoldings: [], detail: '데이터 부족', recommendation: null };

  const sorted = [...volByTicker.entries()]
    .map(([ticker, vol]) => ({ ticker, pct: (vol / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const hhi = sorted.reduce((s, h) => s + (h.pct / 100) ** 2, 0);
  const score = Math.round(hhi * 100);

  const top3pct = sorted.slice(0, 3).reduce((s, h) => s + h.pct, 0);
  const level = score >= 60 ? '위험' : score >= 30 ? '적절' : '우수 (분산)';

  const recommendation = score >= 50 && sorted.length > 0
    ? `${sorted.slice(0, 2).map(h => h.ticker).join(', ')}에 집중되어 있습니다. 분산 투자를 권장합니다.`
    : null;

  return {
    score,
    topHoldings: sorted.slice(0, 5),
    detail: `집중도: ${top3pct.toFixed(0)}% (Top 3 기준) — ${level}`,
    recommendation,
  };
}

function calcTradingStyle(trades: ClosedTrade[], txs: TxRow[]): {
  type: string;
  similarity: Record<string, number>;
  description: string;
  avgHoldDays: number;
  tradesPerMonth: number;
  winRate: number;
} {
  if (trades.length === 0) {
    return { type: '데이터 부족', similarity: {}, description: '충분한 거래 데이터가 없습니다.', avgHoldDays: 0, tradesPerMonth: 0, winRate: 0 };
  }

  const avgHoldDays = trades.reduce((s, t) => s + t.holdDays, 0) / trades.length;
  const buyTxs = txs.filter(t => t.type === 'buy');
  const dates = buyTxs.map(t => new Date(t.date).getTime());
  const monthsDiff = dates.length > 1
    ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30))
    : 1;
  const tradesPerMonth = buyTxs.length / monthsDiff;
  const winRate = (trades.filter(t => t.realizedPnlPct >= 0).length / trades.length) * 100;

  const buffettScore = Math.round(
    (avgHoldDays > 365 ? 40 : avgHoldDays > 180 ? 28 : avgHoldDays > 90 ? 14 : 0) +
    (tradesPerMonth < 2 ? 35 : tradesPerMonth < 5 ? 20 : tradesPerMonth < 8 ? 8 : 0) +
    (winRate > 60 ? 25 : winRate > 50 ? 15 : 5)
  );

  const lynchScore = Math.round(
    (avgHoldDays >= 60 && avgHoldDays <= 365 ? 40 : avgHoldDays >= 30 ? 20 : avgHoldDays > 365 ? 15 : 0) +
    (tradesPerMonth >= 2 && tradesPerMonth <= 12 ? 35 : tradesPerMonth < 2 ? 15 : 10) +
    (winRate >= 50 ? 25 : 10)
  );

  const momentumScore = Math.round(
    (avgHoldDays < 14 ? 40 : avgHoldDays < 30 ? 28 : avgHoldDays < 60 ? 14 : 0) +
    (tradesPerMonth > 15 ? 35 : tradesPerMonth > 8 ? 22 : tradesPerMonth > 4 ? 10 : 0) +
    20
  );

  const similarity: Record<string, number> = {
    '워런 버핏형 (가치투자)': Math.min(100, buffettScore),
    '피터 린치형 (성장투자)': Math.min(100, lynchScore),
    '모멘텀형 (단기매매)': Math.min(100, momentumScore),
  };

  const topType = Object.entries(similarity).sort((a, b) => b[1] - a[1])[0][0];

  const descriptions: Record<string, string> = {
    '워런 버핏형 (가치투자)': '장기 보유와 가치 중심의 투자 성향입니다. 기업의 펀더멘털을 중시합니다.',
    '피터 린치형 (성장투자)': '성장 가능성이 높은 종목을 중기 보유하는 성향입니다. 실적과 성장성을 중시합니다.',
    '모멘텀형 (단기매매)': '단기 추세를 활용한 활발한 거래 성향입니다. 빠른 진입·이탈로 수익을 추구합니다.',
  };

  return { type: topType, similarity, description: descriptions[topType], avgHoldDays, tradesPerMonth, winRate };
}

function calcTaxEfficiency(trades: ClosedTrade[]): {
  score: number;
  longTermPct: number;
  shortTermPct: number;
  longTermCount: number;
  shortTermCount: number;
  detail: string;
  recommendation: string | null;
} {
  if (trades.length === 0) {
    return { score: 50, longTermPct: 0, shortTermPct: 0, longTermCount: 0, shortTermCount: 0, detail: '데이터 부족', recommendation: null };
  }

  const longTermCount = trades.filter(t => t.isLongTerm).length;
  const shortTermCount = trades.length - longTermCount;
  const longTermPct = (longTermCount / trades.length) * 100;
  const score = Math.round(longTermPct);

  const level = score >= 70 ? '좋음' : score >= 40 ? '보통' : '개선 필요';
  const recommendation = score < 40
    ? `단기 거래 비중이 ${(100 - score).toFixed(0)}%입니다. 장기 보유를 늘리면 세금을 절감할 수 있습니다.`
    : null;

  return {
    score,
    longTermPct,
    shortTermPct: 100 - longTermPct,
    longTermCount,
    shortTermCount,
    detail: `세금 효율성: ${score}/100 (${level}) — 장기: ${longTermCount}건, 단기: ${shortTermCount}건`,
    recommendation,
  };
}

function calcReturnPrediction(trades: ClosedTrade[], txs: TxRow[]): {
  currentPnlPct: number;
  currentPnl: number;
  monthlyExpected: number;
  yearlyExpected: number;
  fiveYearExpected: number;
  confidence: number;
  winRate: number;
  avgGainPct: number;
  avgLossPct: number;
} {
  const empty = { currentPnlPct: 0, currentPnl: 0, monthlyExpected: 0, yearlyExpected: 0, fiveYearExpected: 0, confidence: 0, winRate: 0, avgGainPct: 0, avgLossPct: 0 };
  if (trades.length < 3) return empty;

  const winning = trades.filter(t => t.realizedPnlPct > 0);
  const losing  = trades.filter(t => t.realizedPnlPct <= 0);

  const winRate    = winning.length / trades.length;
  const avgGainPct = winning.length > 0 ? winning.reduce((s, t) => s + t.realizedPnlPct, 0) / winning.length : 0;
  const avgLossPct = losing.length > 0  ? Math.abs(losing.reduce((s, t) => s + t.realizedPnlPct, 0) / losing.length) : 0;

  const expectedPerTrade = winRate * avgGainPct - (1 - winRate) * avgLossPct;
  const avgHoldDays = trades.reduce((s, t) => s + t.holdDays, 0) / trades.length || 30;

  const buyTxs = txs.filter(t => t.type === 'buy');
  const dates  = buyTxs.map(t => new Date(t.date).getTime());
  const monthsDiff = dates.length > 1
    ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30))
    : 1;
  const tradesPerMonth = buyTxs.length / monthsDiff;

  const turnsPerMonth  = tradesPerMonth * Math.min(avgHoldDays, 30) / 30;
  const monthlyExpected = expectedPerTrade * Math.max(0.1, turnsPerMonth);

  const yearlyExpected   = ((1 + monthlyExpected / 100) ** 12 - 1) * 100;
  const fiveYearExpected = ((1 + monthlyExpected / 100) ** 60 - 1) * 100;

  const totalPnl  = trades.reduce((s, t) => s + t.realizedPnl, 0);
  const totalCost = trades.reduce((s, t) => s + t.buyPrice * t.quantity, 0);
  const currentPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const confidence = Math.min(85, 15 + trades.length * 3);

  return {
    currentPnl: totalPnl,
    currentPnlPct,
    monthlyExpected,
    yearlyExpected,
    fiveYearExpected,
    confidence,
    winRate: winRate * 100,
    avgGainPct,
    avgLossPct,
  };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const supabase = getAdminClient();
  const body = await req.json().catch(() => ({}));
  const { accountIds } = body as { accountIds?: string[] };

  let query = supabase
    .from('transactions')
    .select('account_id, ticker, type, quantity, price, fee, transaction_date')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: true })
    .limit(10000);

  if (accountIds && accountIds.length > 0) {
    query = query.in('account_id', accountIds);
  }

  const { data: raw, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalise type to lowercase to handle 'Buy'/'buy'/'BUY' variants
  const VALID_TYPES = new Set(['buy', 'sell', 'dividend']);
  const txs: TxRow[] = (raw || [])
    .map((r: Record<string, unknown>) => ({
      date:       r.transaction_date as string,
      ticker:     r.ticker as string,
      type:       String(r.type).toLowerCase(),
      quantity:   Number(r.quantity),
      price:      Number(r.price),
      fee:        Number(r.fee),
      account_id: r.account_id as string,
    }))
    .filter(t => t.ticker && t.quantity > 0 && t.price > 0 && VALID_TYPES.has(t.type));

  if (txs.length === 0) {
    return NextResponse.json({ empty: true });
  }

  const trades = matchTrades(txs);

  const fomo        = calcFomoScore(txs);
  const stopLoss    = calcStopLossScore(trades);
  const conc        = calcConcentration(txs);
  const style       = calcTradingStyle(trades, txs);
  const tax         = calcTaxEfficiency(trades);
  const prediction  = calcReturnPrediction(trades, txs);

  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.realizedPnlPct > 0).length;
  const losingTrades  = trades.filter(t => t.realizedPnlPct < 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnl   = trades.reduce((s, t) => s + t.realizedPnl, 0);
  const totalCost  = trades.reduce((s, t) => s + t.buyPrice * t.quantity, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalTxCount = txs.length;

  const recommendations: string[] = [];
  if (fomo.recommendation)    recommendations.push(fomo.recommendation);
  if (stopLoss.recommendation) recommendations.push(stopLoss.recommendation);
  if (conc.recommendation)     recommendations.push(conc.recommendation);
  if (tax.recommendation)      recommendations.push(tax.recommendation);
  if (winRate >= 60)           recommendations.push(`승률 ${winRate.toFixed(0)}%로 우수한 성과를 보이고 있습니다. 계속 유지하세요.`);

  return NextResponse.json({
    summary: { totalTxCount, totalTrades, winningTrades, losingTrades, winRate, totalPnl, totalPnlPct },
    fomoScore:      fomo,
    stopLossScore:  stopLoss,
    concentration:  conc,
    tradingStyle:   style,
    taxEfficiency:  tax,
    returnPrediction: prediction,
    recommendations,
  });
}
