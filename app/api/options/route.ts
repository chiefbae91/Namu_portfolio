import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');

  let sql = `
    SELECT o.*, a.name as account_name,
      COALESCE((SELECT SUM(oc.quantity) FROM option_closes oc WHERE oc.option_id = o.id), 0) as closed_qty,
      COALESCE((
        SELECT SUM(
          CASE WHEN o.action='sell' THEN (oc.premium - o.premium) * oc.quantity * 100
               ELSE (o.premium - oc.premium) * oc.quantity * 100 END
        ) - SUM(oc.fee) FROM option_closes oc WHERE oc.option_id = o.id
      ), 0) as realized_pnl
    FROM options o
    JOIN accounts a ON o.account_id = a.id
    WHERE a.hidden = 0
  `;
  const args: any[] = [];
  if (accountId && accountId !== 'all') {
    sql += ' AND o.account_id = ?';
    args.push(Number(accountId));
  }
  sql += ' ORDER BY o.date DESC, o.id DESC';

  const rows = (db.prepare(sql).all(...args) as any[]).map((r) => ({
    ...r,
    open_qty: r.quantity - r.closed_qty,
  }));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!await getAuthUser()) return unauthorized();
  const db = getDb();
  const { account_id, date, ticker, option_type, action, strike, expiry, quantity, premium, fee } = await req.json();

  const result = db.prepare(`
    INSERT INTO options (account_id, date, ticker, option_type, action, strike, expiry, quantity, premium, fee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(account_id, date, ticker, option_type, action, strike, expiry, quantity, premium, fee || 0);

  const created = db.prepare('SELECT * FROM options WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
