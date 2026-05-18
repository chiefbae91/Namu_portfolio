// ── Pure logic extracted from app/api/lots/route.ts ─────────────────────────

function applyFifo(lots, sells) {
  // Reset remaining to original quantity
  const state = lots.map(l => ({ ...l, remaining: l.quantity }));

  for (const sell of sells) {
    let need = sell.quantity;
    // Pass 1: same account
    for (const lot of state) {
      if (need <= 0) break;
      if (lot.account_id !== sell.account_id || lot.remaining < 0.00001) continue;
      const use = Math.min(lot.remaining, need);
      lot.remaining -= use;
      need -= use;
    }
    // Pass 2: cross-account fallback
    if (need > 0.00001) {
      for (const lot of state) {
        if (need <= 0) break;
        if (lot.remaining < 0.00001) continue;
        const use = Math.min(lot.remaining, need);
        lot.remaining -= use;
        need -= use;
      }
    }
  }
  return state.filter(l => l.remaining > 0.00001);
}

function selectLots(lots, sellQty, method) {
  if (method === 'average_cost' || method === 'specific') return [];
  const ordered = method === 'lifo' ? [...lots].reverse() : lots;
  const selected = [];
  let need = sellQty;
  for (const lot of ordered) {
    if (need <= 0) break;
    const use = Math.min(lot.remaining, need);
    selected.push({ buy_tx_id: lot.id, quantity: use, price: lot.price });
    need -= use;
  }
  return selected;
}

function calcLotStats(lots, sellQty, method) {
  const totalQty  = lots.reduce((s, l) => s + l.remaining, 0);
  const totalCost = lots.reduce((s, l) => s + l.remaining * l.price, 0);
  const avg_cost_all = totalQty > 0 ? totalCost / totalQty : 0;

  if (method === 'average_cost') {
    return { cost_per_share: avg_cost_all, total_cost: sellQty * avg_cost_all, avg_cost_all };
  }
  if (method === 'specific' || sellQty === 0) {
    return { cost_per_share: avg_cost_all, total_cost: 0, avg_cost_all };
  }
  const selected = selectLots(lots, sellQty, method);
  const selQty  = selected.reduce((s, l) => s + l.quantity, 0);
  const selCost = selected.reduce((s, l) => s + l.quantity * l.price, 0);
  return {
    cost_per_share: selQty > 0 ? selCost / selQty : avg_cost_all,
    total_cost: selCost,
    avg_cost_all,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function round2(v) { return Math.round(v * 100) / 100; }

function expect(label, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.001;
  if (ok) { console.log(`  ✓  ${label}`); passed++; }
  else {
    console.log(`  ✗  ${label}`);
    console.log(`       expected: ${expected}`);
    console.log(`       got:      ${actual}`);
    failed++;
  }
}

function expectArr(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✓  ${label}`); passed++; }
  else {
    console.log(`  ✗  ${label}`);
    console.log(`       expected: ${JSON.stringify(expected)}`);
    console.log(`       got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Test data helpers ─────────────────────────────────────────────────────────
const A = 'acct-A';
const B = 'acct-B';

function lot(id, qty, price, account_id = A) {
  return { id, quantity: qty, price, remaining: qty, account_id };
}
function sell(qty, account_id = A) {
  return { quantity: qty, account_id };
}

// ── applyFifo: lot depletion ──────────────────────────────────────────────────
console.log('\n[applyFifo] FIFO lot depletion');

{
  const result = applyFifo([lot(1, 100, 50)], []);
  expect('no sells → full lot remains', result[0].remaining, 100);
}

{
  const result = applyFifo([lot(1, 100, 50)], [sell(40)]);
  expect('partial sell → correct remaining', result[0].remaining, 60);
}

{
  const result = applyFifo([lot(1, 100, 50)], [sell(100)]);
  expect('full sell → lot consumed (no remaining)', result.length, 0);
}

{
  const result = applyFifo([lot(1, 100, 50)], [sell(101)]);
  expect('over-sell → lot consumed (remaining not negative)', result.length, 0);
}

{
  // Oldest lot depleted first
  const lots = [lot(1, 50, 100), lot(2, 50, 200)];
  const result = applyFifo(lots, [sell(50)]);
  expect('FIFO: oldest lot (id=1) fully consumed', result.length, 1);
  expect('FIFO: newest lot (id=2) untouched', result[0].id, 2);
  expect('FIFO: newest lot still has full qty', result[0].remaining, 50);
}

{
  // Sell spans two lots
  const lots = [lot(1, 30, 100), lot(2, 50, 200)];
  const result = applyFifo(lots, [sell(50)]);
  expect('sell spans two lots: older fully consumed', result.length, 1);
  expect('sell spans two lots: newer has 30 remaining', result[0].remaining, 30);
}

{
  // Two sells
  const lots = [lot(1, 100, 50), lot(2, 100, 80)];
  const result = applyFifo(lots, [sell(60), sell(60)]);
  expect('two sells: first lot gone, second has 80 remaining', result.length, 1);
  expect('two sells: second lot remaining = 80', result[0].remaining, 80);
}

{
  // Cross-account fallback: sell on B but lots only on A
  const lots = [lot(1, 100, 50, A)];
  const result = applyFifo(lots, [sell(40, B)]);
  expect('cross-account fallback: lot depleted despite different account', result[0].remaining, 60);
}

{
  // Same-account priority: prefers A lot over B lot for A sell
  const lots = [lot(1, 50, 100, A), lot(2, 50, 200, B)];
  const result = applyFifo(lots, [sell(50, A)]);
  expect('same-account priority: A lot consumed first', result[0].id, 2);
  expect('same-account priority: B lot untouched', result[0].remaining, 50);
}

// ── selectLots: method selection ─────────────────────────────────────────────
console.log('\n[selectLots] lot selection by method');

{
  const lots = [lot(1, 50, 100), lot(2, 50, 200), lot(3, 50, 150)];
  const sel = selectLots(lots, 60, 'fifo');
  expect('FIFO: selects oldest first (id=1 fully, id=2 partial)',
    sel[0].buy_tx_id, 1);
  expect('FIFO: first selection = 50 shares', sel[0].quantity, 50);
  expect('FIFO: second selection = 10 shares', sel[1].quantity, 10);
  expect('FIFO: second selection from id=2', sel[1].buy_tx_id, 2);
}

{
  const lots = [lot(1, 50, 100), lot(2, 50, 200), lot(3, 50, 150)];
  const sel = selectLots(lots, 60, 'lifo');
  expect('LIFO: selects newest first (id=3 fully, id=2 partial)',
    sel[0].buy_tx_id, 3);
  expect('LIFO: first selection = 50 shares', sel[0].quantity, 50);
  expect('LIFO: second selection = 10 shares', sel[1].quantity, 10);
  expect('LIFO: second selection from id=2', sel[1].buy_tx_id, 2);
}

{
  const lots = [lot(1, 50, 100), lot(2, 50, 200)];
  const sel = selectLots(lots, 30, 'average_cost');
  expectArr('average_cost: returns no specific lots', sel, []);
}

{
  const lots = [lot(1, 50, 100), lot(2, 50, 200)];
  const sel = selectLots(lots, 30, 'specific');
  expectArr('specific: returns no auto-selected lots', sel, []);
}

// ── calcLotStats: cost basis and P&L ─────────────────────────────────────────
console.log('\n[calcLotStats] cost basis calculations');

{
  const lots = [lot(1, 100, 50), lot(2, 100, 100)];
  const s = calcLotStats(lots, 0, 'average_cost');
  expect('average_cost: avg_cost_all = (100×50 + 100×100) / 200 = 75',
    s.avg_cost_all, 75);
}

{
  const lots = [lot(1, 100, 50), lot(2, 100, 100)];
  const s = calcLotStats(lots, 50, 'average_cost');
  expect('average_cost sell 50: cost_per_share = 75', s.cost_per_share, 75);
  expect('average_cost sell 50: total_cost = 3750', s.total_cost, 3750);
}

{
  const lots = [lot(1, 100, 50), lot(2, 100, 100)];
  const s = calcLotStats(lots, 50, 'fifo');
  expect('FIFO sell 50: cost_per_share = 50 (oldest lot)', s.cost_per_share, 50);
  expect('FIFO sell 50: total_cost = 2500', s.total_cost, 2500);
}

{
  const lots = [lot(1, 100, 50), lot(2, 100, 100)];
  const s = calcLotStats(lots, 50, 'lifo');
  expect('LIFO sell 50: cost_per_share = 100 (newest lot)', s.cost_per_share, 100);
  expect('LIFO sell 50: total_cost = 5000', s.total_cost, 5000);
}

{
  // Sell spans two lots under FIFO
  const lots = [lot(1, 50, 60), lot(2, 50, 120)];
  const s = calcLotStats(lots, 80, 'fifo');
  // Lot1: 50 × 60 = 3000, Lot2: 30 × 120 = 3600 → total = 6600, per share = 82.50
  expect('FIFO spanning two lots: total_cost = 6600', s.total_cost, 6600);
  expect('FIFO spanning two lots: cost_per_share = 82.50', s.cost_per_share, 82.50);
}

{
  // Sell spans two lots under LIFO
  const lots = [lot(1, 50, 60), lot(2, 50, 120)];
  const s = calcLotStats(lots, 80, 'lifo');
  // Lot2: 50 × 120 = 6000, Lot1: 30 × 60 = 1800 → total = 7800, per share = 97.50
  expect('LIFO spanning two lots: total_cost = 7800', s.total_cost, 7800);
  expect('LIFO spanning two lots: cost_per_share = 97.50', s.cost_per_share, 97.50);
}

{
  // P&L: FIFO vs LIFO on same sell price
  const lots = [lot(1, 100, 50), lot(2, 100, 100)];
  const sellPrice = 120;
  const sellQty   = 100;
  const fifoStats = calcLotStats(lots, sellQty, 'fifo');
  const lifoStats = calcLotStats(lots, sellQty, 'lifo');
  const fifoPnl   = round2(sellQty * sellPrice - fifoStats.total_cost);
  const lifoPnl   = round2(sellQty * sellPrice - lifoStats.total_cost);
  expect('FIFO P&L = 12000 - 5000 = 7000', fifoPnl, 7000);
  expect('LIFO P&L = 12000 - 10000 = 2000', lifoPnl, 2000);
  expect('FIFO gives higher P&L when older lots are cheaper', fifoPnl > lifoPnl, true);
}

{
  // average_cost P&L
  const lots = [lot(1, 100, 50), lot(2, 100, 100)];
  const sellPrice = 120;
  const sellQty   = 100;
  const s         = calcLotStats(lots, sellQty, 'average_cost');
  const pnl       = round2(sellQty * sellPrice - s.total_cost);
  expect('average_cost P&L = 12000 - 7500 = 4500', pnl, 4500);
}

{
  // Single lot, uneven sell: remaining and cost are consistent
  const lots = [lot(1, 100, 80)];
  const s = calcLotStats(lots, 100, 'fifo');
  expect('single lot full sell: cost_per_share = 80', s.cost_per_share, 80);
  expect('single lot full sell: total_cost = 8000', s.total_cost, 8000);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
if (failed > 0) process.exit(1);
