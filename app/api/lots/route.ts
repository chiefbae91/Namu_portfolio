import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { LotInfo, LotSelection, TaxLotMethod } from '@/lib/types';
import { getAuthUser, unauthorized } from '@/lib/auth';

interface RawLot {
  id: string;
  date: string;
  ticker: string;
  account_id: string;
  account_name: string;
  quantity: number;
  price: number;
  fee: number;
  remaining: number;
}

async function computeRemainingLots(ticker: string, accountId: string | null, userId: string): Promise<RawLot[]> {
  const supabase = getAdminClient();

  const { data: accounts } = await supabase.from('accounts').select('id, name, hidden').eq('user_id', userId);
  const visibleAccounts = (accounts || []).filter((a: any) => !a.hidden);
  const nameMap: Record<string, string> = Object.fromEntries(visibleAccounts.map((a: any) => [a.id, a.name]));

  let buyQuery = supabase
    .from('transactions')
    .select('id, transaction_date, ticker, account_id, quantity, price, fee')
    .eq('user_id', userId)
    .ilike('type', 'buy').eq('ticker', ticker)
    .order('transaction_date').order('id');
  if (accountId) buyQuery = buyQuery.eq('account_id', accountId);

  let sellQuery = supabase
    .from('transactions')
    .select('id, quantity, account_id')
    .eq('user_id', userId)
    .ilike('type', 'sell').eq('ticker', ticker)
    .order('transaction_date').order('id');
  if (accountId) sellQuery = sellQuery.eq('account_id', accountId);

  const [{ data: buyData }, { data: sellData }] = await Promise.all([buyQuery, sellQuery]);

  const lots: RawLot[] = (buyData || []).map((r: any) => ({
    id: r.id,
    date: r.transaction_date,
    ticker: r.ticker,
    account_id: r.account_id,
    account_name: nameMap[r.account_id] || '',
    quantity: r.quantity,
    price: r.price,
    fee: r.fee,
    remaining: r.quantity,
  }));

  // FIFO — same account first, cross-account fallback for mismatched UUIDs
  for (const sell of sellData || []) {
    let need = sell.quantity;
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.account_id !== sell.account_id || lot.remaining < 0.00001) continue;
      const use = Math.min(lot.remaining, need);
      lot.remaining -= use;
      need -= use;
    }
    if (need > 0.00001) {
      for (const lot of lots) {
        if (need <= 0) break;
        if (lot.remaining < 0.00001) continue;
        const use = Math.min(lot.remaining, need);
        lot.remaining -= use;
        need -= use;
      }
    }
  }

  return lots.filter(l => l.remaining > 0.00001);
}

function selectLots(lots: RawLot[], sellQty: number, method: TaxLotMethod): LotSelection[] {
  const selected: LotSelection[] = [];
  let need = sellQty;
  const ordered = method === 'lifo' ? [...lots].reverse() : lots;
  for (const lot of ordered) {
    if (need <= 0) break;
    const use = Math.min(lot.remaining, need);
    selected.push({ buy_tx_id: lot.id, quantity: use, price: lot.price });
    need -= use;
  }
  return selected;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const accountId = searchParams.get('account_id');
  const sellQty = parseFloat(searchParams.get('sell_qty') || '0');
  const method = (searchParams.get('method') as TaxLotMethod) || 'fifo';

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const lots = await computeRemainingLots(ticker, accountId || null, user.id);

  const totalQty = lots.reduce((s, l) => s + l.remaining, 0);
  const totalCostAll = lots.reduce((s, l) => s + l.remaining * l.price, 0);
  const avg_cost_all = totalQty > 0 ? totalCostAll / totalQty : 0;

  let selected: LotSelection[] = [];
  let cost_per_share = avg_cost_all;
  let total_cost = 0;

  if (sellQty > 0 && method !== 'average_cost' && method !== 'specific') {
    selected = selectLots(lots, sellQty, method);
    const selQty = selected.reduce((s, l) => s + l.quantity, 0);
    const selCost = selected.reduce((s, l) => s + l.quantity * l.price, 0);
    cost_per_share = selQty > 0 ? selCost / selQty : avg_cost_all;
    total_cost = selCost;
  } else if (method === 'average_cost') {
    cost_per_share = avg_cost_all;
    total_cost = sellQty * avg_cost_all;
  }

  return NextResponse.json({ lots, selected, cost_per_share, total_cost, avg_cost_all });
}

void (null as unknown as LotInfo);
