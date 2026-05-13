import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const {
    account_id, date, ticker, type, quantity, price, fee, currency, notes,
    reinvest, reinvest_qty, reinvest_price, reinvest_id,
  } = await req.json();

  const insertReinvest = db.prepare(`
    INSERT INTO transactions (account_id, date, ticker, type, quantity, price, fee, currency, notes, lot_method, subtype, dividend_id)
    VALUES (?, ?, ?, 'buy', ?, ?, 0, ?, 'Dividend reinvestment', NULL, 'DIVIDEND_REINVEST', ?)
  `);

  db.transaction(() => {
    db.prepare(`
      UPDATE transactions
      SET account_id=?, date=?, ticker=?, type=?, quantity=?, price=?, fee=?, currency=?, notes=?
      WHERE id=?
    `).run(account_id, date, ticker || '', type, quantity || 0, price || 0, fee || 0, currency || 'USD', notes || '', id);

    if (type === 'dividend') {
      if (reinvest && reinvest_qty && reinvest_price) {
        if (reinvest_id) {
          // Update existing reinvest record
          db.prepare(`
            UPDATE transactions SET date=?, ticker=?, quantity=?, price=? WHERE id=?
          `).run(date, ticker || '', reinvest_qty, reinvest_price, reinvest_id);
        } else {
          // Create new reinvest record
          insertReinvest.run(account_id, date, ticker || '', reinvest_qty, reinvest_price, currency || 'USD', id);
        }
      } else if (reinvest_id) {
        // Reinvest unchecked — delete the linked record
        db.prepare('DELETE FROM transactions WHERE id = ?').run(reinvest_id);
      }
    }
  })();

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);

  db.transaction(() => {
    // Cascade: if deleting a dividend, also delete its linked DIVIDEND_REINVEST
    db.prepare(`DELETE FROM transactions WHERE dividend_id = ? AND subtype = 'DIVIDEND_REINVEST'`).run(id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  })();

  return NextResponse.json({ ok: true });
}
