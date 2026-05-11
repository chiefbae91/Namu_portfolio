import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { LotInfo, LotSelection, TaxLotMethod } from '@/lib/types';

interface RawLot {
  id: number;
  date: string;
  ticker: string;
  account_id: number;
  account_name: string;
  quantity: number;
  price: number;
  fee: number;
  remaining: number;
}

function computeRemainingLots(ticker: string, accountId: number | null): RawLot[] {
  const db = getDb();

  // All buy lots for this ticker (oldest first)
  let buySql = `
    SELECT t.id, t.date, t.ticker, t.account_id, a.name as account_name,
           t.quantity, t.price, t.fee, t.quantity as remaining
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.type = 'buy' AND t.ticker = ? AND a.hidden = 0
  `;
  const buyArgs: any[] = [ticker];
  if (accountId) { buySql += ' AND t.account_id = ?'; buyArgs.push(accountId); }
  buySql += ' ORDER BY t.date ASC, t.id ASC';
  const lots: RawLot[] = (db.prepare(buySql).all(...buyArgs) as any[]).map(r => ({ ...r }));

  // All sell transactions for this ticker (chronological)
  let sellSql = `
    SELECT t.id, t.quantity, t.lot_method
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.type = 'sell' AND t.ticker = ? AND a.hidden = 0
  `;
  const sellArgs: any[] = [ticker];
  if (accountId) { sellSql += ' AND t.account_id = ?'; sellArgs.push(accountId); }
  sellSql += ' ORDER BY t.date ASC, t.id ASC';
  const sells = db.prepare(sellSql).all(...sellArgs) as any[];

  // Lot assignments indexed by sell tx id
  const assignRows = db.prepare(`
    SELECT la.sell_tx_id, la.buy_tx_id, la.quantity
    FROM lot_assignments la
    JOIN transactions sell_tx ON la.sell_tx_id = sell_tx.id
    WHERE sell_tx.ticker = ?
    ${accountId ? 'AND sell_tx.account_id = ?' : ''}
  `).all(ticker, ...(accountId ? [accountId] : [])) as any[];

  const assignsByS: Record<number, { buy_tx_id: number; quantity: number }[]> = {};
  for (const a of assignRows) {
    if (!assignsByS[a.sell_tx_id]) assignsByS[a.sell_tx_id] = [];
    assignsByS[a.sell_tx_id].push({ buy_tx_id: a.buy_tx_id, quantity: a.quantity });
  }

  // Apply sells to reduce lot remainders
  for (const sell of sells) {
    const assignments = assignsByS[sell.id];
    if (assignments?.length) {
      // Specific lot assignments
      for (const a of assignments) {
        const lot = lots.find(l => l.id === a.buy_tx_id);
        if (lot) lot.remaining = Math.max(0, lot.remaining - a.quantity);
      }
    } else {
      // FIFO for all unassigned sells (covers average_cost / fifo / lifo historical)
      const method: TaxLotMethod = (sell.lot_method as TaxLotMethod) || 'fifo';
      const available = lots.filter(l => l.remaining > 0);
      const ordered = method === 'lifo' ? [...available].reverse() : available;
      let need = sell.quantity;
      for (const lot of ordered) {
        if (need <= 0) break;
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
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const accountId = searchParams.get('account_id');
  const sellQty = parseFloat(searchParams.get('sell_qty') || '0');
  const method = (searchParams.get('method') as TaxLotMethod) || 'fifo';

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const lots = computeRemainingLots(ticker, accountId ? Number(accountId) : null);

  // Overall avg cost for reference
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

  return NextResponse.json({
    lots,
    selected,
    cost_per_share,
    total_cost,
    avg_cost_all,
  });
}
