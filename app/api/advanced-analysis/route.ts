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

interface FomoTicker {
  ticker: string;
  buyCount: number;
  avgFomoRatio: number;
  observedHigh: number;
  avgBuyPrice: number;
  avgPnlPct: number | null;
}

function calcFomoScore(txs: TxRow[], trades: ClosedTrade[]): {
  score: number;
  detail: string;
  recommendation: string | null;
  level: string;
  levelNum: number;
  totalBuys: number;
  fomoTickers: FomoTicker[];
  expectedImprovement: { targetScore: number; winRateGain: number; avgGainBoost: number };
} {
  const byTicker = new Map<string, number[]>();
  const buysByTicker = new Map<string, Array<{ price: number; qty: number }>>();

  for (const tx of txs) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;
    if (!byTicker.has(tx.ticker)) byTicker.set(tx.ticker, []);
    byTicker.get(tx.ticker)!.push(tx.price);
    if (tx.type === 'buy') {
      if (!buysByTicker.has(tx.ticker)) buysByTicker.set(tx.ticker, []);
      buysByTicker.get(tx.ticker)!.push({ price: tx.price, qty: tx.quantity });
    }
  }

  // Build realized P&L map per ticker
  const pnlByTicker = new Map<string, number[]>();
  for (const t of trades) {
    if (!pnlByTicker.has(t.ticker)) pnlByTicker.set(t.ticker, []);
    pnlByTicker.get(t.ticker)!.push(t.realizedPnlPct);
  }

  let totalWeighted = 0, totalWeight = 0;
  const fomoTickers: FomoTicker[] = [];

  for (const [ticker, buys] of buysByTicker) {
    const prices = byTicker.get(ticker) || [];
    if (prices.length < 2) continue;
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    if (maxP === minP) continue;

    let tickerWeighted = 0, tickerWeight = 0;
    let totalBuyPrice = 0;
    for (const buy of buys) {
      const ratio = (buy.price - minP) / (maxP - minP);
      const w = buy.qty * buy.price;
      tickerWeighted += ratio * w;
      tickerWeight += w;
      totalWeighted += ratio * w;
      totalWeight += w;
      totalBuyPrice += buy.price;
    }

    const pnls = pnlByTicker.get(ticker);
    const avgPnlPct = pnls && pnls.length > 0
      ? pnls.reduce((a, b) => a + b, 0) / pnls.length
      : null;

    fomoTickers.push({
      ticker,
      buyCount: buys.length,
      avgFomoRatio: tickerWeight > 0 ? Math.round((tickerWeighted / tickerWeight) * 100) : 50,
      observedHigh: maxP,
      avgBuyPrice: totalBuyPrice / buys.length,
      avgPnlPct,
    });
  }

  const totalBuys = txs.filter(t => t.type === 'buy').length;

  if (totalWeight === 0) {
    return {
      score: 50, detail: '거래 데이터가 부족합니다.', recommendation: null,
      level: '중간', levelNum: 2, totalBuys,
      fomoTickers: [],
      expectedImprovement: { targetScore: 35, winRateGain: 0, avgGainBoost: 0 },
    };
  }

  const score = Math.round((totalWeighted / totalWeight) * 100);

  let levelNum: number, level: string, recommendation: string | null;
  if (score >= 76) {
    levelNum = 4; level = '매우 높음 (위험!)';
    recommendation = '거의 모든 거래가 고점 근처 매수입니다. 매수 전 반드시 저점 확인이 필요합니다.';
  } else if (score >= 51) {
    levelNum = 3; level = '높은 수준 (주의)';
    recommendation = '저점 근처에서 매수하는 훈련이 필요합니다. 고점 이후 조정을 기다리세요.';
  } else if (score >= 21) {
    levelNum = 2; level = '적절한 수준';
    recommendation = null;
  } else {
    levelNum = 1; level = '신중한 투자자';
    recommendation = '저점 근처에서 매수하는 훌륭한 습관이 있습니다. 계속 유지하세요.';
  }

  // Expected improvement: if user reduces FOMO score by 30 points
  const targetScore = Math.max(20, score - 30);
  const winRateGain = Math.round((score - targetScore) * 0.12 * 10) / 10; // ~0.12% per point
  const avgGainBoost = Math.round((score - targetScore) * 0.05 * 10) / 10; // ~0.05% per point

  fomoTickers.sort((a, b) => b.avgFomoRatio - a.avgFomoRatio);

  return {
    score,
    detail: `FOMO 점수: ${score}/100 (${level})`,
    recommendation,
    level,
    levelNum,
    totalBuys,
    fomoTickers: fomoTickers.slice(0, 10),
    expectedImprovement: { targetScore, winRateGain, avgGainBoost },
  };
}

interface StopLossTradeDetail {
  ticker: string;
  buyPrice: number;
  sellPrice: number;
  lossPct: number;
  holdDays: number;
}

function calcStopLossScore(trades: ClosedTrade[]): {
  score: number;
  avgLossPct: number;
  avgLossDays: number;
  maxLossPct: number;
  maxLossTicker: string;
  totalLossCount: number;
  totalTradeCount: number;
  cutoff: { within1d: number; within3d: number; within7d: number; over7d: number };
  worstTrades: StopLossTradeDetail[];
  levelNum: number;
  level: string;
  detail: string;
  recommendation: string | null;
  expectedImprovement: { targetScore: number; lossReduction: number };
} {
  const empty = (score: number) => ({
    score, avgLossPct: 0, avgLossDays: 0, maxLossPct: 0, maxLossTicker: '',
    totalLossCount: 0, totalTradeCount: trades.length,
    cutoff: { within1d: 0, within3d: 0, within7d: 0, over7d: 0 },
    worstTrades: [], levelNum: 4, level: '우수',
    detail: '손절 능력: 90/100 (우수) — 손실 거래 없음',
    recommendation: null,
    expectedImprovement: { targetScore: score, lossReduction: 0 },
  });

  const losing = trades.filter(t => t.realizedPnlPct < 0);
  if (losing.length === 0) return empty(90);

  const avgLossPct = losing.reduce((s, t) => s + Math.abs(t.realizedPnlPct), 0) / losing.length;
  const avgLossDays = losing.reduce((s, t) => s + t.holdDays, 0) / losing.length;

  const worst = [...losing].sort((a, b) => a.realizedPnlPct - b.realizedPnlPct);
  const maxLoss = worst[0];

  const lossPenalty = Math.min(avgLossPct / 25 * 50, 50);
  const daysPenalty = Math.min(avgLossDays / 150 * 50, 50);
  const score = Math.max(0, Math.min(100, Math.round(100 - lossPenalty - daysPenalty)));

  let levelNum: number, level: string;
  if (score >= 76) { levelNum = 4; level = '우수 수준 (모범!)'; }
  else if (score >= 51) { levelNum = 3; level = '좋은 수준'; }
  else if (score >= 21) { levelNum = 2; level = '보통 수준'; }
  else { levelNum = 1; level = '손절 능력 부족'; }

  const recommendation = score < 50
    ? `평균 손실률 ${avgLossPct.toFixed(2)}%, 평균 ${Math.round(avgLossDays)}일 후 손절합니다. 더 빠른 손절이 필요합니다.`
    : score >= 76
    ? '손절 능력이 우수합니다. 현재 방식을 유지하세요.'
    : null;

  const cutoff = {
    within1d: losing.filter(t => t.holdDays <= 1).length,
    within3d: losing.filter(t => t.holdDays <= 3).length,
    within7d: losing.filter(t => t.holdDays <= 7).length,
    over7d:   losing.filter(t => t.holdDays > 7).length,
  };

  const worstTrades: StopLossTradeDetail[] = worst.slice(0, 10).map(t => ({
    ticker: t.ticker,
    buyPrice: t.buyPrice,
    sellPrice: t.sellPrice,
    lossPct: t.realizedPnlPct,
    holdDays: t.holdDays,
  }));

  const targetScore = Math.min(100, score + 7);
  const lossReduction = Math.round((avgLossPct - avgLossPct * (score / targetScore)) * 100) / 100;

  return {
    score,
    avgLossPct,
    avgLossDays,
    maxLossPct: Math.abs(maxLoss.realizedPnlPct),
    maxLossTicker: maxLoss.ticker,
    totalLossCount: losing.length,
    totalTradeCount: trades.length,
    cutoff,
    worstTrades,
    levelNum,
    level,
    detail: `손절 능력: ${score}/100 (${level}) — 평균 손실 ${avgLossPct.toFixed(2)}%, ${Math.round(avgLossDays)}일`,
    recommendation,
    expectedImprovement: { targetScore, lossReduction },
  };
}

// Fetch live prices for a list of tickers in parallel.
// Returns a map of ticker → current price; silently skips failures.
async function fetchCurrentPrices(tickers: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (tickers.length === 0) return map;

  await Promise.all(
    tickers.map(async ticker => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const data = await res.json();
        const price: number | undefined = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === 'number' && price > 0) map.set(ticker, price);
      } catch { /* ignore per-ticker failures */ }
    })
  );

  return map;
}

async function calcConcentration(txs: TxRow[]): Promise<{
  score: number;
  topHoldings: { ticker: string; pct: number }[];
  top3pct: number;
  top5pct: number;
  top10pct: number;
  totalTickers: number;
  hhi: number;
  levelNum: number;
  level: string;
  scenario: { top1impact: number; top3impact: number };
  detail: string;
  recommendation: string | null;
  expectedImprovement: { targetPct: number };
}> {
  // Step 1: compute net positions from transaction history
  const netShares = new Map<string, number>();
  const buyTotal  = new Map<string, number>();
  const buyQtySum = new Map<string, number>();

  for (const tx of txs) {
    if (tx.type === 'buy') {
      netShares.set(tx.ticker, (netShares.get(tx.ticker) ?? 0) + tx.quantity);
      buyTotal.set(tx.ticker,  (buyTotal.get(tx.ticker)  ?? 0) + tx.quantity * tx.price);
      buyQtySum.set(tx.ticker, (buyQtySum.get(tx.ticker) ?? 0) + tx.quantity);
    } else if (tx.type === 'sell') {
      netShares.set(tx.ticker, (netShares.get(tx.ticker) ?? 0) - tx.quantity);
    }
  }

  // Step 2: keep tickers with positive net shares, compute cost basis
  const held: Array<{ ticker: string; netShares: number; avgCost: number }> = [];
  for (const [ticker, net] of netShares) {
    if (net < 0.001) continue;
    const avgCost = (buyTotal.get(ticker) ?? 0) / (buyQtySum.get(ticker) ?? 1);
    held.push({ ticker, netShares: net, avgCost });
  }

  // Step 3: fetch live prices for all held tickers (portfolio-accurate market values)
  const livePrices = await fetchCurrentPrices(held.map(h => h.ticker));

  // Step 4: compute market value — prefer live price, fall back to avg cost
  const positions: Array<{ ticker: string; value: number }> = held.map(h => {
    const price = livePrices.get(h.ticker) ?? h.avgCost;
    return { ticker: h.ticker, value: h.netShares * price };
  });

  const total = positions.reduce((s, p) => s + p.value, 0);
  if (total === 0) {
    return {
      score: 0, topHoldings: [], top3pct: 0, top5pct: 0, top10pct: 0,
      totalTickers: 0, hhi: 0, levelNum: 2, level: '데이터 부족',
      scenario: { top1impact: 0, top3impact: 0 },
      detail: '현재 보유 포지션 없음', recommendation: null,
      expectedImprovement: { targetPct: 30 },
    };
  }

  const sorted = positions
    .map(p => ({ ticker: p.ticker, pct: (p.value / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const hhi = sorted.reduce((s, h) => s + (h.pct / 100) ** 2, 0);
  const score = Math.round(hhi * 100);

  const top3pct  = sorted.slice(0, 3).reduce((s, h)  => s + h.pct, 0);
  const top5pct  = sorted.slice(0, 5).reduce((s, h)  => s + h.pct, 0);
  const top10pct = sorted.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const totalTickers = sorted.length;

  // Level based on top3pct
  let levelNum: number, level: string;
  if (top3pct >= 81)      { levelNum = 5; level = '극도 집중 (위험!)'; }
  else if (top3pct >= 61) { levelNum = 4; level = '고집중도 (주의!)'; }
  else if (top3pct >= 41) { levelNum = 3; level = '중집중도 (중간)'; }
  else if (top3pct >= 21) { levelNum = 2; level = '저집중도 (적절) ✅'; }
  else                    { levelNum = 1; level = '과분산 (관리 어려움)'; }

  // Scenario: what happens if top holdings drop -20%
  const top1impact = sorted.length > 0 ? -(sorted[0].pct / 100 * 20) : 0;
  const top3impact = -(top3pct / 100 * 20);

  const recommendation = top3pct >= 60
    ? `${sorted.slice(0, 2).map(h => h.ticker).join(', ')}에 집중되어 있습니다. 분산 투자를 권장합니다.`
    : top3pct <= 20 && totalTickers > 30
    ? '종목이 너무 많습니다. 우량주 10~15개로 관리하면 효율성이 높아집니다.'
    : null;

  return {
    score,
    topHoldings: sorted.slice(0, 10),
    top3pct,
    top5pct,
    top10pct,
    totalTickers,
    hhi,
    levelNum,
    level,
    scenario: {
      top1impact: Math.round(top1impact * 100) / 100,
      top3impact: Math.round(top3impact * 100) / 100,
    },
    detail: `집중도: Top 3 = ${top3pct.toFixed(2)}% (현재 보유 기준) — ${level}`,
    recommendation,
    expectedImprovement: { targetPct: Math.max(20, top3pct - 10) },
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

interface WashSaleEntry {
  ticker: string;
  sellDate: string;
  loss: number;
  buysInWindow: { date: string; quantity: number; price: number; daysFromSell: number }[];
}

function detectWashSales(trades: ClosedTrade[], txs: TxRow[]): WashSaleEntry[] {
  const result: WashSaleEntry[] = [];
  const losingSells = trades.filter(t => t.realizedPnl < 0);
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

  for (const sell of losingSells) {
    const sellMs = sell.sellDate.getTime();
    const buysInWindow = txs.filter(tx => {
      if (tx.type !== 'buy' || tx.ticker !== sell.ticker) return false;
      const delta = Math.abs(new Date(tx.date).getTime() - sellMs);
      return delta <= WINDOW_MS;
    });

    if (buysInWindow.length > 0) {
      result.push({
        ticker: sell.ticker,
        sellDate: sell.sellDate.toISOString().slice(0, 10),
        loss: Math.abs(sell.realizedPnl),
        buysInWindow: buysInWindow.map(buy => ({
          date: buy.date.slice(0, 10),
          quantity: buy.quantity,
          price: buy.price,
          daysFromSell: Math.round((new Date(buy.date).getTime() - sellMs) / 86400000),
        })),
      });
    }
  }

  return result;
}

function calcTaxEfficiency(trades: ClosedTrade[], txs: TxRow[]): {
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
} {
  const empty = {
    score: 50, longTermPct: 0, shortTermPct: 0, longTermCount: 0, shortTermCount: 0,
    longTermGains: 0, longTermLosses: 0, shortTermGains: 0, shortTermLosses: 0,
    estimatedTax: 0, potentialSavings: 0, deductibleLoss: 0,
    washSales: [], detail: '데이터 부족', recommendation: null,
  };
  if (trades.length === 0) return empty;

  const lt = trades.filter(t => t.isLongTerm);
  const st = trades.filter(t => !t.isLongTerm);

  const ltGains  = lt.filter(t => t.realizedPnl > 0).reduce((s, t) => s + t.realizedPnl, 0);
  const ltLosses = lt.filter(t => t.realizedPnl < 0).reduce((s, t) => s + Math.abs(t.realizedPnl), 0);
  const stGains  = st.filter(t => t.realizedPnl > 0).reduce((s, t) => s + t.realizedPnl, 0);
  const stLosses = st.filter(t => t.realizedPnl < 0).reduce((s, t) => s + Math.abs(t.realizedPnl), 0);

  const totalGains = ltGains + stGains;
  const longTermPct = totalGains > 0
    ? (ltGains / totalGains) * 100
    : lt.length > 0 ? 100 : 0;

  // Tax estimate: LT 15%, ST 32%
  const ltTax = ltGains * 0.15;
  const stTax = stGains * 0.32;

  // Net loss deduction: capped $3,000/year
  const netLoss = (ltLosses + stLosses) - (ltGains + stGains);
  const deductibleLoss = netLoss > 0 ? Math.min(netLoss, 3000) : 0;

  const estimatedTax = Math.max(0, ltTax + stTax - deductibleLoss * 0.32);
  const taxIfAllLT = totalGains * 0.15;
  const potentialSavings = Math.max(0, estimatedTax - taxIfAllLT);

  // Wash sale detection
  const washSales = detectWashSales(trades, txs);

  // Score: % of gains that are long-term, minus wash sale penalty
  const baseScore = Math.round(longTermPct);
  const washPenalty = Math.min(washSales.length * 5, 15);
  const score = Math.max(0, Math.min(100, baseScore - washPenalty));

  const level = score >= 70 ? '좋음' : score >= 40 ? '보통' : '개선 필요';
  const recommendation = washSales.length > 0
    ? `Wash Sale ${washSales.length}건이 감지되었습니다. 손실 공제가 제한될 수 있습니다.`
    : score < 40
    ? `단기 거래 비중이 ${(100 - longTermPct).toFixed(0)}%입니다. 장기 보유를 늘리면 세금을 절감할 수 있습니다.`
    : null;

  return {
    score,
    longTermPct,
    shortTermPct: 100 - longTermPct,
    longTermCount: lt.length,
    shortTermCount: st.length,
    longTermGains: Math.round(ltGains * 100) / 100,
    longTermLosses: Math.round(ltLosses * 100) / 100,
    shortTermGains: Math.round(stGains * 100) / 100,
    shortTermLosses: Math.round(stLosses * 100) / 100,
    estimatedTax: Math.round(estimatedTax * 100) / 100,
    potentialSavings: Math.round(potentialSavings * 100) / 100,
    deductibleLoss: Math.round(deductibleLoss * 100) / 100,
    washSales,
    detail: `세금 효율성: ${score}/100 (${level})`,
    recommendation,
  };
}

interface ReturnScenario {
  label: string;
  monthlyRate: number;
  yearlyPct: number;
  fiveYearPct: number;
  tenYearPct: number;
  riskLevel: string;
}

interface MonthlyProjectionRow {
  months: number;
  label: string;
  cumulativePct: number;
  multiplier: number;
}

// Safe compound: monthlyPct is already in % (e.g. 1.23 means 1.23%)
// Caps input at ±15 %/month to prevent astronomical results from outlier trades
function safeCompound(monthlyPct: number, periods: number): number {
  const capped = Math.min(15, Math.max(-30, monthlyPct)); // realistic monthly ceiling
  const monthly = capped / 100;
  const result  = (Math.pow(1 + monthly, periods) - 1) * 100;
  if (!isFinite(result) || isNaN(result)) return 0;
  return Math.round(result * 100) / 100;
}

function makeProjections(monthlyRate: number): MonthlyProjectionRow[] {
  const periods = [1, 3, 6, 9, 12, 24, 36, 48, 60, 120];
  const labels  = ['1개월','3개월','6개월','9개월','12개월','24개월','36개월','48개월','60개월','120개월'];
  return periods.map((m, i) => {
    const pct  = safeCompound(monthlyRate, m);
    const mult = 1 + pct / 100;
    return { months: m, label: labels[i], cumulativePct: pct, multiplier: mult };
  });
}

function calcReturnPrediction(trades: ClosedTrade[], txs: TxRow[]): {
  currentPnlPct: number;
  currentPnl: number;
  monthlyExpected: number;
  yearlyExpected: number;
  fiveYearExpected: number;
  tenYearExpected: number;
  confidence: number;
  winRate: number;
  avgGainPct: number;
  avgLossPct: number;
  tradesPerMonth: number;
  dataStartDate: string;
  dataEndDate: string;
  dataMonths: number;
  netMonthlyWin: number;
  netMonthlyLoss: number;
  scenarios: ReturnScenario[];
  projections: MonthlyProjectionRow[];
} {
  const empty = {
    currentPnlPct: 0, currentPnl: 0, monthlyExpected: 0,
    yearlyExpected: 0, fiveYearExpected: 0, tenYearExpected: 0,
    confidence: 0, winRate: 0, avgGainPct: 0, avgLossPct: 0,
    tradesPerMonth: 0, dataStartDate: '', dataEndDate: '', dataMonths: 0,
    netMonthlyWin: 0, netMonthlyLoss: 0, scenarios: [], projections: [],
  };
  if (trades.length < 3) return empty;

  const winning = trades.filter(t => t.realizedPnlPct > 0);
  const losing  = trades.filter(t => t.realizedPnlPct <= 0);

  const winRate = winning.length / trades.length;

  // Cap individual trade gains/losses at 100% to avoid single-outlier distortion
  // (e.g. a 300% meme-stock win skewing the whole model)
  const cappedGainPct = winning.length > 0
    ? winning.reduce((s, t) => s + Math.min(t.realizedPnlPct, 100), 0) / winning.length
    : 0;
  const cappedLossPct = losing.length > 0
    ? Math.abs(losing.reduce((s, t) => s + Math.max(t.realizedPnlPct, -100), 0)) / losing.length
    : 0;

  // Raw (uncapped) averages for display only
  const avgGainPct = winning.length > 0 ? winning.reduce((s, t) => s + t.realizedPnlPct, 0) / winning.length : 0;
  const avgLossPct = losing.length > 0  ? Math.abs(losing.reduce((s, t) => s + t.realizedPnlPct, 0) / losing.length) : 0;

  const expectedPerTrade = winRate * cappedGainPct - (1 - winRate) * cappedLossPct;
  const avgHoldDays = trades.reduce((s, t) => s + t.holdDays, 0) / trades.length || 30;

  const buyTxs = txs.filter(t => t.type === 'buy');
  const allDates = buyTxs.map(t => new Date(t.date).getTime());
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const dataMonths = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const tradesPerMonth = buyTxs.length / dataMonths;

  // turnsPerMonth: clamp to [0.1, 4] — prevents unrealistic multiplication
  const rawTurns = tradesPerMonth * Math.min(avgHoldDays, 30) / 30;
  const turnsPerMonth = Math.min(4, Math.max(0.1, rawTurns));

  // monthlyExpected: cap at ±15% — even the best month-traders rarely exceed this consistently
  const rawMonthly = expectedPerTrade * turnsPerMonth;
  const monthlyExpected = Math.min(15, Math.max(-30, rawMonthly));

  const yearlyExpected   = safeCompound(monthlyExpected, 12);
  const fiveYearExpected = safeCompound(monthlyExpected, 60);
  const tenYearExpected  = safeCompound(monthlyExpected, 120);

  const totalPnl  = trades.reduce((s, t) => s + t.realizedPnl, 0);
  const totalCost = trades.reduce((s, t) => s + t.buyPrice * t.quantity, 0);
  const currentPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const confidence = Math.min(85, 15 + Math.min(trades.length, 20) * 3);

  // Net monthly win/loss: use capped values so display stays in sane range
  const netMonthlyWin  = winRate * cappedGainPct * turnsPerMonth;
  const netMonthlyLoss = (1 - winRate) * cappedLossPct * turnsPerMonth;

  // Scenario analysis — all use safeCompound to avoid overflow
  const consRate = monthlyExpected * 0.69;
  const aggrRate = monthlyExpected * 1.34;
  const scenarios: ReturnScenario[] = [
    {
      label: '보수적',
      monthlyRate: Math.round(consRate * 100) / 100,
      yearlyPct:    safeCompound(consRate, 12),
      fiveYearPct:  safeCompound(consRate, 60),
      tenYearPct:   safeCompound(consRate, 120),
      riskLevel: '낮음',
    },
    {
      label: '중립',
      monthlyRate: monthlyExpected,
      yearlyPct:   yearlyExpected,
      fiveYearPct: fiveYearExpected,
      tenYearPct:  tenYearExpected,
      riskLevel: '중간',
    },
    {
      label: '공격적',
      monthlyRate: Math.round(aggrRate * 100) / 100,
      yearlyPct:    safeCompound(aggrRate, 12),
      fiveYearPct:  safeCompound(aggrRate, 60),
      tenYearPct:   safeCompound(aggrRate, 120),
      riskLevel: '높음',
    },
  ];

  return {
    currentPnl: totalPnl,
    currentPnlPct,
    monthlyExpected,
    yearlyExpected,
    fiveYearExpected,
    tenYearExpected,
    confidence,
    winRate: winRate * 100,
    avgGainPct,
    avgLossPct,
    tradesPerMonth,
    dataStartDate: minDate.toISOString().slice(0, 7),
    dataEndDate:   maxDate.toISOString().slice(0, 7),
    dataMonths: Math.round(dataMonths),
    netMonthlyWin,
    netMonthlyLoss,
    scenarios,
    projections: makeProjections(monthlyExpected),
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
      ticker:     String(r.ticker ?? '').toUpperCase(),
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

  const fomo        = calcFomoScore(txs, trades);
  const stopLoss    = calcStopLossScore(trades);
  const [conc, prediction] = await Promise.all([
    calcConcentration(txs),
    Promise.resolve(calcReturnPrediction(trades, txs)),
  ]);
  const style       = calcTradingStyle(trades, txs);
  const tax         = calcTaxEfficiency(trades, txs);

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
