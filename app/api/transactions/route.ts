import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  let sql = `
    SELECT t.*, a.name as account_name,
      ri.id as reinvest_id, ri.quantity as reinvest_qty, ri.price as reinvest_price
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN transactions ri ON ri.dividend_id = t.id AND ri.subtype = 'DIVIDEND_REINVEST'
    WHERE a.hidden = 0
  `;
  const args: any[] = [];

  const accountIdsParam = searchParams.get('account_ids');
  const accountIds = accountIdsParam
    ? accountIdsParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
    : [];
  if (accountIds.length > 0) {
    sql += ` AND t.account_id IN (${accountIds.map(() => '?').join(',')})`;
    args.push(...accountIds);
  }
  if (ticker) {
    sql += ' AND t.ticker = ?';
    args.push(ticker);
  }
  sql += ' ORDER BY t.date DESC, t.id DESC';

  const rows = db.prepare(sql).all(...args);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { account_id, date, ticker, type, quantity, price, fee, currency, notes,
          reinvest, reinvest_qty, reinvest_price,
          lot_method, lot_assignments } = body;

  if (!account_id || !date || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const insertTx = db.prepare(`
    INSERT INTO transactions (account_id, date, ticker, type, quantity, price, fee, currency, notes, lot_method, subtype, dividend_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLotAssignment = db.prepare(`
    INSERT INTO lot_assignments (sell_tx_id, buy_tx_id, quantity) VALUES (?, ?, ?)
  `);

  const created: any[] = [];

  db.transaction(() => {
    const result = insertTx.run(
      account_id, date, ticker || '', type,
      quantity || 0, price || 0, fee || 0,
      currency || 'USD', notes || '',
      type === 'sell' ? (lot_method || 'average_cost') : null,
      null, null
    );
    const newId = result.lastInsertRowid;
    created.push(db.prepare('SELECT * FROM transactions WHERE id = ?').get(newId));

    // Save specific lot assignments for sell transactions
    if (type === 'sell' && lot_method === 'specific' && Array.isArray(lot_assignments)) {
      for (const la of lot_assignments) {
        if (la.quantity > 0) {
          insertLotAssignment.run(newId, la.buy_tx_id, la.quantity);
        }
      }
    }

    // Auto-create DIVIDEND_REINVEST buy record
    if (type === 'dividend' && reinvest && reinvest_qty && reinvest_price) {
      const r2 = insertTx.run(
        account_id, date, ticker || '', 'buy',
        reinvest_qty, reinvest_price, 0, currency || 'USD',
        'Dividend reinvestment', null,
        'DIVIDEND_REINVEST', newId
      );
      created.push(db.prepare('SELECT * FROM transactions WHERE id = ?').get(r2.lastInsertRowid));
    }
  })();

  return NextResponse.json(created, { status: 201 });
}
