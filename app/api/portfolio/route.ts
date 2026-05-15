import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

function detectLeverage(shortName: string): string {
  const n = shortName.toUpperCase();
  const isInverse = n.includes('ULTRASHORT') || n.includes('BEAR') || n.includes('INVERSE') ||
    n.includes('-1X') || n.includes('-2X') || n.includes('-3X') ||
    (n.includes('SHORT') && !n.includes('ULTRAPRO SHORT') && n.includes('ULTRA'));
  const is3x = n.includes('3X') || n.includes('TRIPLE') || (n.includes('ULTRAPRO') && !isInverse);
  const is2x = n.includes('2X') || n.includes('DOUBLE') ||
    (n.includes('ULTRA') && !n.includes('ULTRASHORT') && !n.includes('ULTRAPRO'));
  if (is3x && isInverse) return '-3x';
  if (is2x && isInverse) return '-2x';
  if (isInverse) return 'inv';
  if (is3x) return '3x';
  if (is2x) return '2x';
  return '';
}

async function fetchPriceData(ticker: string): Promise<{ price: number; prevClose: number; quoteType: string; leverage: string }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } });
    if (!res.ok) return { price: 0, prevClose: 0, quoteType: '', leverage: '' };
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const quoteType: string = meta?.instrumentType ?? meta?.quoteType ?? '';
    const nameForLeverage = `${meta?.longName ?? ''} ${meta?.shortName ?? ''}`;
    const leverage = quoteType === 'ETF' ? detectLeverage(nameForLeverage) : '';
    return { price: meta?.regularMarketPrice ?? 0, prevClose: meta?.chartPreviousClose ?? 0, quoteType, leverage };
  } catch { return { price: 0, prevClose: 0, quoteType: '', leverage: '' }; }
}

export async function GET(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  const { searchParams } = new URL(req.url);
  const accountIdsParam = searchParams.get('account_ids');
  const filterIds = accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : null;

  const { data: allAccounts } = await supabase.from('accounts').select('id, name, hidden').order('name');
  const visibleAccounts = (allAccounts || []).filter((a: any) => !a.hidden);

  // Fetch all transactions (types stored as uppercase in Supabase)
  const [
    { data: buyRows },
    { data: sellRows },
    { data: allTxRows },
    { data: cashFlowRows },
  ] = await Promise.all([
    supabase.from('transactions').select('id, transaction_date, ticker, account_id, quantity, price, fee')
      .ilike('type', 'buy').order('transaction_date').order('id'),
    supabase.from('transactions').select('id, ticker, quantity, account_id')
      .ilike('type', 'sell').order('transaction_date').order('id'),
    supabase.from('transactions').select('account_id, type, quantity, price, fee'),
    supabase.from('cash_flow').select('account_id, amount, type'),
  ]);

  interface Lot { id: string; ticker: string; account_id: string; quantity: number; price: number; fee: number; remaining: number; }
  const lots: Lot[] = (buyRows || []).map((r: any) => ({ ...r, remaining: r.quantity }));

  // Apply sells FIFO — same account first, then cross-account fallback for mismatched UUIDs
  for (const sell of sellRows || []) {
    let need = sell.quantity;
    // Pass 1: same account_id
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.ticker !== sell.ticker || lot.account_id !== sell.account_id || lot.remaining < 0.00001) continue;
      const use = Math.min(lot.remaining, need);
      lot.remaining -= use;
      need -= use;
    }
    // Pass 2: any account (handles old imported data where buy/sell have different UUIDs)
    if (need > 0.00001) {
      for (const lot of lots) {
        if (need <= 0) break;
        if (lot.ticker !== sell.ticker || lot.remaining < 0.00001) continue;
        const use = Math.min(lot.remaining, need);
        lot.remaining -= use;
        need -= use;
      }
    }
  }

  const posMap: Record<string, { qty: number; cost: number }> = {};
  for (const lot of lots) {
    if (lot.remaining < 0.00001) continue;
    if (!posMap[lot.ticker]) posMap[lot.ticker] = { qty: 0, cost: 0 };
    const feePerShare = lot.quantity > 0 ? lot.fee / lot.quantity : 0;
    posMap[lot.ticker].qty += lot.remaining;
    posMap[lot.ticker].cost += lot.remaining * (lot.price + feePerShare);
  }

  const activeTickers = Object.keys(posMap);
  const priceDataArr = await Promise.all(activeTickers.map(fetchPriceData));
  const priceMap: Record<string, number> = {};
  const prevCloseMap: Record<string, number> = {};
  const quoteTypeMap: Record<string, string> = {};
  const leverageMap: Record<string, string> = {};
  activeTickers.forEach((t, i) => {
    priceMap[t] = priceDataArr[i].price;
    prevCloseMap[t] = priceDataArr[i].prevClose;
    quoteTypeMap[t] = priceDataArr[i].quoteType;
    leverageMap[t] = priceDataArr[i].leverage;
  });

  // Cash from all transactions (uppercase type comparison)
  const accCashMap: Record<string, number> = {};
  for (const tx of allTxRows || []) {
    const t = (tx.type as string).toLowerCase();
    const delta = t === 'sell' ? tx.quantity * tx.price - tx.fee
      : t === 'buy' ? -(tx.quantity * tx.price + tx.fee)
      : t === 'dividend' ? tx.quantity * tx.price
      : t === 'cash' ? tx.price : 0;
    accCashMap[tx.account_id] = (accCashMap[tx.account_id] || 0) + delta;
  }
  for (const cf of cashFlowRows || []) {
    const delta = cf.type === 'DEPOSIT' ? cf.amount : -cf.amount;
    accCashMap[cf.account_id] = (accCashMap[cf.account_id] || 0) + delta;
  }

  const accStockMap: Record<string, number> = {};
  for (const lot of lots) {
    if (lot.remaining < 0.00001) continue;
    accStockMap[lot.account_id] = (accStockMap[lot.account_id] || 0) + lot.remaining * (priceMap[lot.ticker] || 0);
  }

  const account_breakdown = visibleAccounts.map((acc: any) => ({
    account_id: acc.id,
    account_name: acc.name,
    cash: accCashMap[acc.id] || 0,
    stock_value: accStockMap[acc.id] || 0,
  }));

  // Apply account filter to totals and positions
  const activeIds: Set<string> = filterIds
    ? new Set(filterIds)
    : new Set(visibleAccounts.map((a: any) => a.id));

  const totalCash = [...activeIds].reduce((s, id) => s + (accCashMap[id] || 0), 0);

  // Filtered positions: only lots belonging to active accounts
  const filtPosMap: Record<string, { qty: number; cost: number }> = {};
  for (const lot of lots) {
    if (lot.remaining < 0.00001 || !activeIds.has(lot.account_id)) continue;
    if (!filtPosMap[lot.ticker]) filtPosMap[lot.ticker] = { qty: 0, cost: 0 };
    const feePerShare = lot.quantity > 0 ? lot.fee / lot.quantity : 0;
    filtPosMap[lot.ticker].qty += lot.remaining;
    filtPosMap[lot.ticker].cost += lot.remaining * (lot.price + feePerShare);
  }

  const filteredPositions = Object.keys(filtPosMap).map(ticker => {
    const pos = filtPosMap[ticker];
    const avg_cost = pos.qty > 0 ? pos.cost / pos.qty : 0;
    const current_price = priceMap[ticker] || 0;
    const prev_close = prevCloseMap[ticker] || 0;
    const value = pos.qty * current_price;
    const return_amount = value - pos.cost;
    const return_pct = pos.cost > 0 ? (return_amount / pos.cost) * 100 : 0;
    return { ticker, quantity: pos.qty, avg_cost, current_price, prev_close, value, cost: pos.cost, return_pct, return_amount, quote_type: quoteTypeMap[ticker] ?? '', leverage: leverageMap[ticker] ?? '' };
  });

  return NextResponse.json({
    positions: filteredPositions,
    cash: totalCash,
    stock_value: filteredPositions.reduce((s, p) => s + p.value, 0),
    account_breakdown,
  });
}
