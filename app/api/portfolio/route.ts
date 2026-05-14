import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { TaxLotMethod } from '@/lib/types';

interface Lot {
  id: number;
  date: string;
  ticker: string;
  account_id: number;
  quantity: number;
  price: number;
  fee: number;
  remaining: number;
}

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
    return {
      price: meta?.regularMarketPrice ?? 0,
      prevClose: meta?.chartPreviousClose ?? 0,
      quoteType,
      leverage,
    };
  } catch { return { price: 0, prevClose: 0, quoteType: '', leverage: '' }; }
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const accFilter = accountId && accountId !== 'all' ? Number(accountId) : null;

  const accWhere = accFilter ? 'AND t.account_id = ?' : '';
  const accArgs = accFilter ? [accFilter] : [];

  // All buy lots
  const buyRows = db.prepare(`
    SELECT t.id, t.date, t.ticker, t.account_id, t.quantity, t.price, t.fee
    FROM transactions t JOIN accounts a ON t.account_id = a.id
    WHERE t.type = 'buy' AND a.hidden = 0 ${accWhere}
    ORDER BY t.date ASC, t.id ASC
  `).all(...accArgs) as any[];

  const lots: Lot[] = buyRows.map(r => ({ ...r, remaining: r.quantity }));

  // All sell transactions
  const sellRows = db.prepare(`
    SELECT t.id, t.ticker, t.quantity, t.price, t.fee, t.lot_method, t.account_id
    FROM transactions t JOIN accounts a ON t.account_id = a.id
    WHERE t.type = 'sell' AND a.hidden = 0 ${accWhere}
    ORDER BY t.date ASC, t.id ASC
  `).all(...accArgs) as any[];

  // Lot assignments
  const assignRows = db.prepare(`
    SELECT la.sell_tx_id, la.buy_tx_id, la.quantity FROM lot_assignments la
    JOIN transactions s ON la.sell_tx_id = s.id
    JOIN accounts a ON s.account_id = a.id
    WHERE a.hidden = 0 ${accFilter ? 'AND s.account_id = ?' : ''}
  `).all(...(accFilter ? [accFilter] : [])) as any[];

  const assignsBySell: Record<number, { buy_tx_id: number; quantity: number }[]> = {};
  for (const a of assignRows) {
    if (!assignsBySell[a.sell_tx_id]) assignsBySell[a.sell_tx_id] = [];
    assignsBySell[a.sell_tx_id].push(a);
  }

  // Apply sells to reduce lot remainders
  for (const sell of sellRows) {
    const assignments = assignsBySell[sell.id];
    if (assignments?.length) {
      for (const a of assignments) {
        const lot = lots.find(l => l.id === a.buy_tx_id);
        if (lot) lot.remaining = Math.max(0, lot.remaining - a.quantity);
      }
    } else {
      const method: TaxLotMethod = (sell.lot_method as TaxLotMethod) || 'fifo';
      const tickerLots = lots.filter(
        l => l.ticker === sell.ticker && l.account_id === sell.account_id && l.remaining > 0
      );
      const ordered = method === 'lifo' ? [...tickerLots].reverse() : tickerLots;
      let need = sell.quantity;
      for (const lot of ordered) {
        if (need <= 0) break;
        const use = Math.min(lot.remaining, need);
        lot.remaining -= use;
        need -= use;
      }
    }
  }

  // Build positions from remaining lots
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

  const positions = activeTickers.map(ticker => {
    const pos = posMap[ticker];
    const avg_cost = pos.qty > 0 ? pos.cost / pos.qty : 0;
    const current_price = priceMap[ticker] || 0;
    const prev_close = prevCloseMap[ticker] || 0;
    const value = pos.qty * current_price;
    const return_amount = value - pos.cost;
    const return_pct = pos.cost > 0 ? (return_amount / pos.cost) * 100 : 0;
    return {
      ticker,
      quantity: pos.qty,
      avg_cost,
      current_price,
      prev_close,
      value,
      cost: pos.cost,
      return_pct,
      return_amount,
      quote_type: quoteTypeMap[ticker] ?? '',
      leverage: leverageMap[ticker] ?? '',
    };
  });

  // Cash balance from transactions
  const allTx = db.prepare(`
    SELECT t.type, t.quantity, t.price, t.fee FROM transactions t
    JOIN accounts a ON t.account_id = a.id WHERE a.hidden = 0 ${accWhere}
  `).all(...accArgs) as any[];

  let cash = 0;
  for (const tx of allTx) {
    if (tx.type === 'cash') cash += tx.price; // legacy
    else if (tx.type === 'sell') cash += tx.quantity * tx.price - tx.fee;
    else if (tx.type === 'buy') cash -= tx.quantity * tx.price + tx.fee;
    else if (tx.type === 'dividend') cash += tx.quantity * tx.price;
  }

  // Cash balance from cash_flow (Transfer deposits/withdrawals)
  const cfWhere = accFilter ? 'AND cf.account_id = ?' : '';
  const cashFlowRows = db.prepare(`
    SELECT cf.amount, cf.type FROM cash_flow cf
    JOIN accounts a ON cf.account_id = a.id WHERE a.hidden = 0 ${cfWhere}
  `).all(...accArgs) as any[];

  for (const cf of cashFlowRows) {
    if (cf.type === 'DEPOSIT') cash += cf.amount;
    else if (cf.type === 'WITHDRAW') cash -= cf.amount;
  }

  // ── Per-account breakdown ─────────────────────────────────────────
  const visAccounts = db.prepare(
    `SELECT id, name FROM accounts WHERE hidden = 0${accFilter ? ' AND id = ?' : ''} ORDER BY name`
  ).all(...(accFilter ? [accFilter] : [])) as any[];

  // Per-account tx cash
  const accTxRows = db.prepare(`
    SELECT t.account_id,
      SUM(CASE
        WHEN t.type = 'sell'     THEN t.quantity * t.price - t.fee
        WHEN t.type = 'buy'      THEN -(t.quantity * t.price + t.fee)
        WHEN t.type = 'dividend' THEN t.quantity * t.price
        WHEN t.type = 'cash'     THEN t.price
        ELSE 0 END) AS tx_cash
    FROM transactions t JOIN accounts a ON t.account_id = a.id
    WHERE a.hidden = 0 ${accWhere}
    GROUP BY t.account_id
  `).all(...accArgs) as any[];

  const accCfRows = db.prepare(`
    SELECT cf.account_id,
      SUM(CASE WHEN cf.type = 'DEPOSIT' THEN cf.amount ELSE -cf.amount END) AS flow
    FROM cash_flow cf JOIN accounts a ON cf.account_id = a.id
    WHERE a.hidden = 0 ${cfWhere}
    GROUP BY cf.account_id
  `).all(...accArgs) as any[];

  // Per-account stock value from remaining lots × current prices
  const accStockMap: Record<number, number> = {};
  for (const lot of lots) {
    if (lot.remaining < 0.00001) continue;
    if (!accStockMap[lot.account_id]) accStockMap[lot.account_id] = 0;
    accStockMap[lot.account_id] += lot.remaining * (priceMap[lot.ticker] || 0);
  }

  const accCashMap: Record<number, number> = {};
  for (const row of accTxRows) accCashMap[row.account_id] = row.tx_cash || 0;
  for (const row of accCfRows) accCashMap[row.account_id] = (accCashMap[row.account_id] || 0) + (row.flow || 0);

  const account_breakdown = visAccounts.map((acc: any) => ({
    account_id: acc.id,
    account_name: acc.name,
    cash: accCashMap[acc.id] || 0,
    stock_value: accStockMap[acc.id] || 0,
  }));

  return NextResponse.json({
    positions,
    cash,
    stock_value: positions.reduce((s, p) => s + p.value, 0),
    account_breakdown,
  });
}
