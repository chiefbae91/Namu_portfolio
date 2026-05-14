import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const accountIdsParam = searchParams.get('account_ids');
  const accountIds = accountIdsParam
    ? accountIdsParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
    : [];

  let sql = `
    SELECT cf.*, a.name as account_name
    FROM cash_flow cf
    JOIN accounts a ON cf.account_id = a.id
    WHERE a.hidden = 0
  `;
  const args: any[] = [];
  if (accountIds.length > 0) {
    sql += ` AND cf.account_id IN (${accountIds.map(() => '?').join(',')})`;
    args.push(...accountIds);
  }
  sql += ' ORDER BY cf.date DESC, cf.id DESC';
  return NextResponse.json(db.prepare(sql).all(...args));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { account_id, date, amount, type, description } = await req.json();

  if (!account_id || !date || !amount || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const result = db.prepare(
    'INSERT INTO cash_flow (account_id, date, amount, type, description) VALUES (?, ?, ?, ?, ?)'
  ).run(account_id, date, amount, type, description || '');

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
