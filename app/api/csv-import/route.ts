import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import Papa from 'papaparse';
import { CsvPreviewRow, TransactionType } from '@/lib/types';

const ROBINHOOD_CODE_MAP: Record<string, TransactionType | 'skip'> = {
  'Buy': 'buy', 'BTO': 'buy', 'BTC': 'buy',
  'Sell': 'sell', 'STC': 'sell', 'STO': 'sell',
  'INT': 'dividend', 'CDIV': 'dividend', 'Div': 'dividend',
  'ACH': 'cash',
  'SLIP': 'skip', 'OASGN': 'skip', 'SPL': 'skip',
};

const NEW_TYPE_MAP: Record<string, TransactionType | 'dividend_reinvest' | 'skip'> = {
  'Buy': 'buy', 'Sell': 'sell', 'Dividend': 'dividend', 'Dividend_Reinvest': 'dividend_reinvest',
};

function parseAmount(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[$,\s"]/g, '')) || 0;
}

function parseDate(s: string): string {
  if (!s) return '';
  const parts = s.trim().split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  return s;
}

function detectFormat(headers: string[]): 'robinhood' | 'new' {
  const lower = headers.map(h => h.toLowerCase().trim());
  if (lower.some(h => h === 'costbasis' || h === 'cost basis')) return 'new';
  if (lower.some(h => h === 'trans code' || h === 'trans_code' || h === 'instrument')) return 'robinhood';
  if (lower.includes('type') && !lower.includes('trans code')) return 'new';
  return 'robinhood';
}

function dupCheck(db: ReturnType<typeof getDb>, accountId: number, date: string, ticker: string, type: string, qty: number, price: number): boolean {
  return !!(db.prepare(
    `SELECT id FROM transactions WHERE account_id=? AND date=? AND ticker=? AND type=? AND ABS(quantity-?)<0.001 AND ABS(price-?)<0.01`
  ).get(accountId, date, ticker, type, qty, price));
}

function parseRobinhoodRows(rows: Record<string, string>[], accountId: number, db: ReturnType<typeof getDb>): CsvPreviewRow[] {
  const preview: CsvPreviewRow[] = [];
  for (const row of rows) {
    const code = (row['Trans Code'] || row['trans_code'] || '').trim();
    const type = ROBINHOOD_CODE_MAP[code];
    const date = parseDate(row['Activity Date'] || row['activity_date'] || '');
    const ticker = (row['Instrument'] || row['instrument'] || '').trim();
    const qty = Math.abs(parseAmount(row['Quantity'] || row['quantity'] || '0'));
    const price = Math.abs(parseAmount(row['Price'] || row['price'] || '0'));
    const amount = parseAmount(row['Amount'] || row['amount'] || '0');
    const notes = (row['Description'] || row['description'] || '').replace(/\n/g, ' ').trim();

    if (!type || !date) continue;

    const duplicate = dupCheck(db, accountId, date, ticker, type === 'skip' ? 'skip' : type, qty, price);
    preview.push({
      date, ticker,
      type: type === 'skip' ? 'skip' : type,
      quantity: qty, price, amount, fee: 0, notes,
      skip: type === 'skip', duplicate, raw_code: code,
    });
  }
  return preview;
}

function parseNewRows(rows: Record<string, string>[], ticker: string, accountId: number, db: ReturnType<typeof getDb>): CsvPreviewRow[] {
  const preview: CsvPreviewRow[] = [];
  for (const row of rows) {
    const rawType = (row['Type'] || row['type'] || '').trim();
    const mappedType = NEW_TYPE_MAP[rawType];
    if (!mappedType) continue;

    const date = parseDate(row['Date'] || row['date'] || '');
    if (!date) continue;

    const qty = Math.abs(parseAmount(row['Quantity'] || row['quantity'] || '0'));
    const price = Math.abs(parseAmount(row['Price'] || row['price'] || '0'));
    const costBasis = Math.abs(parseAmount(row['CostBasis'] || row['Cost Basis'] || row['costbasis'] || '0'));
    const fee = Math.max(0, Math.abs(costBasis - qty * price));

    if (mappedType === 'dividend_reinvest') {
      const divAmount = costBasis || qty * price;
      preview.push({
        date, ticker, type: 'dividend',
        quantity: 0, price: divAmount, amount: divAmount, fee: 0,
        notes: 'Dividend Reinvest (배당)', skip: false,
        duplicate: dupCheck(db, accountId, date, ticker, 'dividend', 0, divAmount),
        raw_code: rawType,
      });
      preview.push({
        date, ticker, type: 'buy',
        quantity: qty, price, amount: costBasis, fee,
        notes: 'Dividend Reinvest (재투자 매수)', skip: false,
        duplicate: dupCheck(db, accountId, date, ticker, 'buy', qty, price),
        raw_code: rawType,
      });
      continue;
    }

    if (mappedType === 'skip') continue;

    const txType = mappedType as TransactionType;
    const txQty = txType === 'dividend' ? 0 : qty;
    const txPrice = txType === 'dividend' ? (costBasis || qty * price) : price;
    const txFee = txType === 'buy' ? fee : 0;

    preview.push({
      date, ticker, type: txType,
      quantity: txQty, price: txPrice, amount: costBasis || qty * price, fee: txFee,
      notes: rawType, skip: false,
      duplicate: dupCheck(db, accountId, date, ticker, txType, txQty, txPrice),
      raw_code: rawType,
    });
  }
  return preview;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const accountId = formData.get('account_id');
  const tickerInput = ((formData.get('ticker') as string) || '').trim().toUpperCase();

  if (!file || !accountId) return NextResponse.json({ error: 'file and account_id required' }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, quoteChar: '"' });
  const rows = parsed.data as Record<string, string>[];
  if (!rows.length) return NextResponse.json({ error: '데이터 없음' }, { status: 400 });

  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);
  const db = getDb();
  const accId = Number(accountId);

  if (format === 'new' && !tickerInput) {
    return NextResponse.json({ error: 'ticker_required', format }, { status: 400 });
  }

  const preview = format === 'new'
    ? parseNewRows(rows, tickerInput, accId, db)
    : parseRobinhoodRows(rows, accId, db);

  const action = formData.get('action');
  if (action === 'import') {
    const insert = db.prepare(
      `INSERT INTO transactions (account_id, date, ticker, type, quantity, price, fee, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let imported = 0;
    db.transaction(() => {
      for (const p of preview) {
        if (p.skip || p.duplicate) continue;
        insert.run(accId, p.date, p.ticker, p.type, p.quantity, p.price, p.fee, p.notes);
        imported++;
      }
    })();
    return NextResponse.json({ imported, total: preview.length });
  }

  return NextResponse.json({ preview, total: preview.length, format });
}
