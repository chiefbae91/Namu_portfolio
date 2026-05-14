const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('data/portfolio.db');  // ← 이 부분 수정!

try {
  // 각 테이블을 JSON으로 내보내기
  const accounts = db.prepare('SELECT * FROM accounts').all();
  const transactions = db.prepare('SELECT * FROM transactions').all();
  const cashFlow = db.prepare('SELECT * FROM cash_flow').all();
  const tradingHints = db.prepare('SELECT * FROM trading_hints').all();

  fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
  fs.writeFileSync('transactions.json', JSON.stringify(transactions, null, 2));
  fs.writeFileSync('cash_flow.json', JSON.stringify(cashFlow, null, 2));
  fs.writeFileSync('trading_hints.json', JSON.stringify(tradingHints, null, 2));

  console.log('✅ Export complete!');
  console.log('생성된 파일:');
  console.log('- accounts.json');
  console.log('- transactions.json');
  console.log('- cash_flow.json');
  console.log('- trading_hints.json');
} catch (error) {
  console.error('❌ Export failed:', error);
} finally {
  db.close();
}