require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Supabase UUIDs for accounts (from the accounts table)
const ACCOUNT_UUID_MAP = {
  1: 'cfd94866-7b42-48e0-9198-caa6a48192dc', // Robinhood
  2: '9aac849c-b7c7-4b61-bcc9-34c386db7566', // Chase
  3: '5d1acc8c-6bab-4df8-b3aa-235265437d88', // Roth IRA
};

const USER_ID = 'e1514f15-3de8-4738-965a-41852e7a0273';

async function run() {
  const transactions = JSON.parse(fs.readFileSync('transactions.json', 'utf8'));
  const cashFlow = JSON.parse(fs.readFileSync('cash_flow.json', 'utf8'));

  console.log(`Transactions to import: ${transactions.length}`);
  console.log(`Cash flow records to import: ${cashFlow.length}`);

  // 1. Delete existing transactions
  console.log('\nDeleting existing transactions...');
  const { error: delTxErr } = await supabase.from('transactions').delete().not('id', 'is', null);
  if (delTxErr) { console.error('Delete tx error:', delTxErr); return; }
  console.log('✅ Transactions deleted');

  // 2. Delete existing cash_flow
  console.log('Deleting existing cash_flow...');
  const { error: delCfErr } = await supabase.from('cash_flow').delete().not('id', 'is', null);
  if (delCfErr) { console.error('Delete cf error:', delCfErr); return; }
  console.log('✅ Cash flow deleted');

  // 3. Re-insert transactions with correct account_ids
  console.log('\nInserting transactions...');
  const txRows = transactions.map(tx => ({
    id: randomUUID(),
    account_id: ACCOUNT_UUID_MAP[tx.account_id] || ACCOUNT_UUID_MAP[1],
    user_id: USER_ID,
    transaction_date: tx.date,
    ticker: tx.ticker != null ? String(tx.ticker) : '',
    type: tx.type ? tx.type.toUpperCase() : 'BUY',
    quantity: tx.quantity || 0,
    price: tx.price || 0,
    fee: tx.fee || 0,
    note: tx.notes || null,
  }));

  // Insert in batches of 100
  for (let i = 0; i < txRows.length; i += 100) {
    const batch = txRows.slice(i, i + 100);
    const { error } = await supabase.from('transactions').insert(batch);
    if (error) { console.error(`Batch ${i}-${i+100} error:`, error); return; }
    console.log(`  Inserted ${Math.min(i + 100, txRows.length)} / ${txRows.length}`);
  }
  console.log('✅ Transactions inserted');

  // 4. Re-insert cash_flow with correct account_ids
  console.log('\nInserting cash_flow...');
  const cfRows = cashFlow.map(cf => ({
    id: randomUUID(),
    account_id: ACCOUNT_UUID_MAP[cf.account_id] || ACCOUNT_UUID_MAP[1],
    user_id: USER_ID,
    flow_date: cf.date,
    amount: cf.amount || 0,
    type: cf.type || 'DEPOSIT',
  }));

  const { error: cfError } = await supabase.from('cash_flow').insert(cfRows);
  if (cfError) { console.error('Cash flow insert error:', cfError); return; }
  console.log('✅ Cash flow inserted');

  // Verify
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: cfCount } = await supabase.from('cash_flow').select('*', { count: 'exact', head: true });
  console.log(`\nVerification: ${txCount} transactions, ${cfCount} cash_flow records`);

  // Check account distribution
  const { data: sample } = await supabase.from('transactions').select('account_id').limit(5);
  console.log('Sample account_ids:', sample.map(r => r.account_id));
}

run().catch(console.error);
