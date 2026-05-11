import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import Papa from 'papaparse';
import { CsvPreviewRow, TransactionType } from '@/lib/types';

const CODE_MAP: Record<string, TransactionType | 'skip'> = {
  'Buy': 'buy',
  'BTO': 'buy',
  'Sell': 'sell',
  'STC': 'sell',
  'BTC': 'buy',
  'STO': 'sell',
  'INT': 'dividend',
  'CDIV': 'dividend',
  'Div': 'dividend',
  'ACH': 'cash',
  'SLIP': 'skip',
  'OASGN': 'skip',
  'SPL': 'skip',
};

function parseAmount(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[$,\s"]/g, '')) || 0;
}

function parseDate(s: string): string {
  // Input: MM/DD/YYYY → YYYY-MM-DD
  if (!s) return '';
  const parts = s.trim().split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  return s;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const accountId = formData.get('account_id');

  if (!file || !accountId) return NextResponse.json({ error: 'file and account_id required' }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, quoteChar: '"' });
  const rows = parsed.data as Record<string, string>[];

  const db = getDb();
  const preview: CsvPreviewRow[] = [];

  for (const row of rows) {
    const code = (row['Trans Code'] || row['trans_code'] || '').trim();
    const type = CODE_MAP[code];
    const date = parseDate(row['Activity Date'] || row['activity_date'] || '');
    const ticker = (row['Instrument'] || row['instrument'] || '').trim();
    const qty = Math.abs(parseAmount(row['Quantity'] || row['quantity'] || '0'));
    const price = Math.abs(parseAmount(row['Price'] || row['price'] || '0'));
    const amount = parseAmount(row['Amount'] || row['amount'] || '0');
    const notes = (row['Description'] || row['description'] || '').replace(/\n/g, ' ').trim();

    if (!type || !date) continue;

    // Duplicate check
    const duplicate = !!(db.prepare(`
      SELECT id FROM transactions
      WHERE account_id=? AND date=? AND ticker=? AND type=? AND ABS(quantity-?)< 0.001 AND ABS(price-?)<0.01
    `).get(Number(accountId), date, ticker, type === 'skip' ? 'skip' : type, qty, price));

    preview.push({
      date, ticker,
      type: type === 'skip' ? 'skip' : type,
      quantity: qty,
      price,
      amount,
      fee: 0,
      notes,
      skip: type === 'skip',
      duplicate,
      raw_code: code,
    });
  }

  // If action=import, actually save
  const action = formData.get('action');
  if (action === 'import') {
    const insert = db.prepare(`
      INSERT INTO transactions (account_id, date, ticker, type, quantity, price, fee, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let imported = 0;
    db.transaction(() => {
      for (const p of preview) {
        if (p.skip || p.duplicate) continue;
        insert.run(Number(accountId), p.date, p.ticker, p.type, p.quantity, p.price, p.fee, p.notes);
        imported++;
      }
    })();
    return NextResponse.json({ imported, total: preview.length });
  }

  return NextResponse.json({ preview, total: preview.length });
}
