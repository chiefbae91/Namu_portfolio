// Cash calculation logic — mirrors app/api/portfolio/route.ts
function txDelta(tx) {
  const t = tx.type.toLowerCase();
  if (t === 'sell')     return tx.quantity * tx.price - tx.fee;
  if (t === 'buy')      return -(tx.quantity * tx.price + tx.fee);
  if (t === 'dividend') return tx.quantity > 0 ? tx.quantity * tx.price : tx.price;
  if (t === 'cash')     return tx.price;
  return 0;
}

function cfDelta(cf) {
  return cf.type === 'DEPOSIT' ? cf.amount : -cf.amount;
}

function calcCash(transactions, cashFlows) {
  let cash = 0;
  for (const tx of transactions) cash += txDelta(tx);
  for (const cf of cashFlows)    cash += cfDelta(cf);
  return Math.round(cash * 100) / 100;
}

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.001;
  if (ok) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.log(`  ✗  ${label}`);
    console.log(`       expected: ${expected}`);
    console.log(`       got:      ${actual}`);
    failed++;
  }
}

// ── Transaction delta cases ──────────────────────────────────────────────────
console.log('\n[txDelta] individual transaction types');

expect('buy lowercase reduces cash',
  txDelta({ type: 'buy', quantity: 10, price: 100, fee: 0 }), -1000);

expect('buy uppercase reduces cash',
  txDelta({ type: 'BUY', quantity: 10, price: 100, fee: 0 }), -1000);

expect('buy with fee reduces cash more',
  txDelta({ type: 'buy', quantity: 10, price: 100, fee: 5 }), -1005);

expect('sell lowercase adds cash',
  txDelta({ type: 'sell', quantity: 10, price: 150, fee: 0 }), 1500);

expect('sell uppercase adds cash',
  txDelta({ type: 'SELL', quantity: 10, price: 150, fee: 0 }), 1500);

expect('sell with fee reduces proceeds',
  txDelta({ type: 'sell', quantity: 10, price: 150, fee: 2 }), 1498);

expect('dividend adds cash (quantity=0, price=amount)',
  txDelta({ type: 'dividend', quantity: 0, price: 45.50, fee: 0 }), 45.50);

expect('dividend with quantity adds cash',
  txDelta({ type: 'dividend', quantity: 5, price: 1.20, fee: 0 }), 6.00);

expect('cash type uses price directly',
  txDelta({ type: 'cash', quantity: 0, price: 500, fee: 0 }), 500);

expect('unknown type returns 0',
  txDelta({ type: 'transfer_deposit', quantity: 0, price: 500, fee: 0 }), 0);

expect('zero quantity buy = zero delta',
  txDelta({ type: 'buy', quantity: 0, price: 100, fee: 0 }), 0);

expect('zero price sell = zero delta (minus fee)',
  txDelta({ type: 'sell', quantity: 10, price: 0, fee: 1 }), -1);

// ── Cash flow delta cases ────────────────────────────────────────────────────
console.log('\n[cfDelta] cash_flow types');

expect('DEPOSIT adds cash',
  cfDelta({ type: 'DEPOSIT', amount: 10000 }), 10000);

expect('WITHDRAW reduces cash',
  cfDelta({ type: 'WITHDRAW', amount: 3000 }), -3000);

// ── Combined calcCash scenarios ──────────────────────────────────────────────
console.log('\n[calcCash] combined scenarios');

expect('deposit then buy',
  calcCash(
    [{ type: 'buy', quantity: 10, price: 100, fee: 0 }],
    [{ type: 'DEPOSIT', amount: 5000 }]
  ), 4000);

expect('deposit then sell',
  calcCash(
    [{ type: 'sell', quantity: 10, price: 150, fee: 0 }],
    [{ type: 'DEPOSIT', amount: 5000 }]
  ), 6500);

expect('buy then sell at profit',
  calcCash([
    { type: 'buy',  quantity: 100, price: 50, fee: 0 },
    { type: 'sell', quantity: 100, price: 75, fee: 0 },
  ], []), 2500);

expect('buy then sell at loss',
  calcCash([
    { type: 'buy',  quantity: 100, price: 50, fee: 0 },
    { type: 'sell', quantity: 50,  price: 30, fee: 0 },
  ], []), -3500);

expect('multiple buys and sells',
  calcCash([
    { type: 'buy',  quantity: 50,  price: 261,   fee: 0 },
    { type: 'buy',  quantity: 30,  price: 262,   fee: 0 },
    { type: 'buy',  quantity: 20,  price: 263,   fee: 0 },
    { type: 'sell', quantity: 200, price: 266.2, fee: 1.15 },
  ], []), 53238.85 - (50*261 + 30*262 + 20*263));

expect('real AMZN scenario from 5/14 (200@266.20, fee 1.15)',
  txDelta({ type: 'sell', quantity: 200, price: 266.2, fee: 1.15 }), 53238.85);

expect('deposit + withdraw nets correctly',
  calcCash([], [
    { type: 'DEPOSIT',  amount: 10000 },
    { type: 'WITHDRAW', amount: 3000  },
  ]), 7000);

expect('dividend adds to cash',
  calcCash([
    { type: 'dividend', quantity: 0, price: 100, fee: 0 },
  ], [{ type: 'DEPOSIT', amount: 500 }]), 600);

expect('dividend reinvest: qty=0 dividend + buy nets to zero cash impact',
  calcCash([
    { type: 'dividend', quantity: 0,  price: 100, fee: 0 },
    { type: 'buy',      quantity: 10, price: 10,  fee: 0 },
  ], []), 0);

expect('no transactions = zero',
  calcCash([], []), 0);

expect('buy exceeds deposit → negative cash',
  calcCash(
    [{ type: 'buy', quantity: 100, price: 200, fee: 0 }],
    [{ type: 'DEPOSIT', amount: 5000 }]
  ), -15000);

expect('type case mixing (BUY + sell + SELL)',
  calcCash([
    { type: 'BUY',  quantity: 10, price: 100, fee: 0 },
    { type: 'sell', quantity: 5,  price: 120, fee: 0 },
    { type: 'SELL', quantity: 5,  price: 130, fee: 0 },
  ], []), -1000 + 600 + 650);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
if (failed > 0) process.exit(1);
