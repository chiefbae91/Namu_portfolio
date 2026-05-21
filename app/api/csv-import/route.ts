import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import Papa from 'papaparse';
import { CsvPreviewRow, TransactionType } from '@/lib/types';
import { getAuthUser, unauthorized } from '@/lib/auth';

// ─── Robinhood ────────────────────────────────────────────────────
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

// ─── Shared helpers ───────────────────────────────────────────────
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

function dupCheckSync(existing: any[], date: string, ticker: string, type: string, qty: number, price: number): boolean {
  return existing.some(tx =>
    tx.transaction_date === date && tx.ticker === ticker && tx.type === type &&
    Math.abs(tx.quantity - qty) < 0.001 && Math.abs(tx.price - price) < 0.01
  );
}

// ─── Format detection ─────────────────────────────────────────────
function detectFormat(headers: string[]): 'robinhood' | 'new' | 'webull' | 'ib' {
  const lower = headers.map(h => h.toLowerCase().trim());

  // IB Activity Statement: first col = section name, second col = "Header" or "Data"
  const ibSections = ['statement', 'trades', 'dividends', 'positions', 'deposits & withdrawals', 'cash transactions'];
  if (ibSections.includes(lower[0]) && (lower[1] === 'header' || lower[1] === 'data')) return 'ib';

  // IB Flex Query flat export: characteristic column names
  if (lower.some(h => h === 'ibcommission' || h === 'ib commission') ||
      (lower.some(h => h === 'buysell' || h === 'buy/sell') &&
       lower.some(h => h === 'tradedate' || h === 'trade date' || h === 'tradeprice' || h === 'trade price'))) return 'ib';

  // Webull
  if (lower.some(h => h === 'side') && lower.some(h => h === 'filled time' || h === 'placed time')) return 'webull';
  if (lower.some(h => h === 'side') && lower.some(h => h.includes('filled qty') || h === 'qty')) return 'webull';

  // Generic new format
  if (lower.some(h => h === 'costbasis' || h === 'cost basis')) return 'new';
  if (lower.some(h => h === 'trans code' || h === 'trans_code' || h === 'instrument')) return 'robinhood';
  if (lower.includes('type') && !lower.includes('trans code')) return 'new';
  return 'robinhood';
}

// ─── IB helpers ───────────────────────────────────────────────────
function parseIBDate(s: string): string {
  if (!s) return '';
  const clean = s.trim();
  // Activity Statement: "2024-01-15, 09:30:00"
  let m = clean.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // Flex Query compact: "20240115" or "20240115;093000" or "20240115,093000"
  m = clean.replace(/[;,\s].*$/, '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

function parseIBNum(s: string): number {
  if (!s || s.trim() === '--' || s.trim() === '') return 0;
  return parseFloat(s.replace(/[,$\s"]/g, '')) || 0;
}

// Column value getter: tries multiple alternative names case-insensitively
function ibGet(obj: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined) return v.trim();
    // Case-insensitive fallback
    const kl = k.toLowerCase();
    const found = Object.keys(obj).find(ok => ok.toLowerCase().trim() === kl);
    if (found && obj[found] !== undefined) return obj[found].trim();
  }
  return '';
}

// ─── IB Activity Statement parser (multi-section CSV) ────────────
function parseIBActivityStatement(allRows: string[][], existing: any[]): CsvPreviewRow[] {
  const preview: CsvPreviewRow[] = [];
  const sectionHeaders: Record<string, string[]> = {};

  for (const row of allRows) {
    if (row.length < 3) continue;
    const section = row[0]?.trim();
    const rowType = row[1]?.trim();

    if (rowType === 'Header') {
      sectionHeaders[section] = row.map(h => h.trim());
      continue;
    }
    if (rowType !== 'Data') continue;

    const hdrs = sectionHeaders[section];
    if (!hdrs) continue;

    const obj: Record<string, string> = {};
    hdrs.forEach((h, i) => { obj[h] = row[i]?.trim() ?? ''; });

    // ── Trades ──────────────────────────────────────────────────
    if (section === 'Trades') {
      const discriminator = obj['DataDiscriminator'] || '';
      // Skip subtotals, summaries, and cancelled trades
      if (discriminator && discriminator !== 'Order') continue;

      const assetCat = (obj['Asset Category'] || '').toLowerCase();
      // Only import equity/stocks; skip options, forex, futures
      if (assetCat && !assetCat.includes('stock') && !assetCat.includes('equit')) continue;

      const symbol = (obj['Symbol'] || '').toUpperCase().replace(/\s+/g, '');
      if (!symbol) continue;

      const dateStr = parseIBDate(obj['Date/Time'] || '');
      if (!dateStr) continue;

      const rawQty = parseIBNum(obj['Quantity']);
      const qty = Math.abs(rawQty);
      const price = Math.abs(parseIBNum(obj['T. Price']));
      const fee = Math.abs(parseIBNum(obj['Comm/Fee']));

      if (qty === 0 || price === 0) continue;

      const type: TransactionType = rawQty >= 0 ? 'buy' : 'sell';
      preview.push({
        date: dateStr, ticker: symbol, type, quantity: qty, price,
        amount: qty * price, fee, notes: '',
        skip: false,
        duplicate: dupCheckSync(existing, dateStr, symbol, type, qty, price),
        raw_code: type.toUpperCase(),
      });
    }

    // ── Dividends ────────────────────────────────────────────────
    else if (section === 'Dividends') {
      const dateStr = (obj['Date'] || '').substring(0, 10);
      if (!dateStr) continue;

      const description = obj['Description'] || '';
      const amount = parseIBNum(obj['Amount']);
      if (amount <= 0) continue; // negative = withholding tax adjustment

      // Extract ticker: "AAPL(US0378331005) Cash Dividend..." or "AAPL Cash Dividend..."
      const tickerMatch = description.match(/^([A-Z][A-Z0-9./]{0,9})\s*(?:\(|[\s])/);
      const symbol = tickerMatch ? tickerMatch[1] : '';
      if (!symbol) continue;

      preview.push({
        date: dateStr, ticker: symbol, type: 'dividend', quantity: 0, price: amount,
        amount, fee: 0,
        notes: description.length > 120 ? description.substring(0, 120) : description,
        skip: false,
        duplicate: dupCheckSync(existing, dateStr, symbol, 'dividend', 0, amount),
        raw_code: 'DIV',
      });
    }

    // ── Deposits & Withdrawals ────────────────────────────────────
    else if (section === 'Deposits & Withdrawals') {
      const dateStr = (obj['Settle Date'] || obj['Date'] || '').substring(0, 10);
      if (!dateStr) continue;

      const description = (obj['Description'] || '').trim();
      const amount = parseIBNum(obj['Amount']);
      if (amount === 0) continue;
      // Skip withholding tax adjustments
      if (description.toLowerCase().includes('withholding') || description.toLowerCase().includes('tax')) continue;

      const type: TransactionType = amount > 0 ? 'transfer_deposit' : 'transfer_withdraw';
      preview.push({
        date: dateStr, ticker: '', type, quantity: 0, price: Math.abs(amount),
        amount: Math.abs(amount), fee: 0, notes: description,
        skip: false, duplicate: false,
        raw_code: amount > 0 ? 'DEP' : 'WIT',
      });
    }
  }

  return preview;
}

// ─── IB Flex Query parser (flat CSV) ─────────────────────────────
function parseIBFlexQuery(rows: Record<string, string>[], existing: any[]): CsvPreviewRow[] {
  const preview: CsvPreviewRow[] = [];

  for (const row of rows) {
    const assetClass = ibGet(row, 'AssetClass', 'Asset Class', 'AssetCategory', 'Asset Category', 'Instrument Type');
    if (assetClass && !assetClass.toLowerCase().includes('stk') &&
        !assetClass.toLowerCase().includes('stock') && !assetClass.toLowerCase().includes('equit')) continue;

    const symbol = (ibGet(row, 'Symbol', 'Ticker', 'Instrument') || '').toUpperCase().replace(/\s+/g, '');
    if (!symbol) continue;

    const buySell = ibGet(row, 'Buy/Sell', 'BuySell', 'Side', 'Action').toUpperCase();
    if (buySell !== 'BUY' && buySell !== 'SELL') continue;

    const rawDate = ibGet(row, 'TradeDate', 'Trade Date', 'DateTime', 'Date/Time', 'Date');
    const dateStr = parseIBDate(rawDate);
    if (!dateStr) continue;

    const qty = Math.abs(parseIBNum(ibGet(row, 'Quantity', 'Qty', 'FilledQty', 'Filled Qty')));
    const price = Math.abs(parseIBNum(ibGet(row, 'TradePrice', 'Trade Price', 'T. Price', 'Price')));
    const fee = Math.abs(parseIBNum(ibGet(row, 'IBCommission', 'IB Commission', 'Comm/Fee', 'Commission', 'Fee')));

    if (qty === 0 || price === 0) continue;

    const type: TransactionType = buySell === 'BUY' ? 'buy' : 'sell';
    preview.push({
      date: dateStr, ticker: symbol, type, quantity: qty, price,
      amount: qty * price, fee, notes: '',
      skip: false,
      duplicate: dupCheckSync(existing, dateStr, symbol, type, qty, price),
      raw_code: buySell,
    });
  }

  return preview;
}

// ─── IB entry point ───────────────────────────────────────────────
function parseIBRows(text: string, existing: any[]): CsvPreviewRow[] {
  // Parse without headers to inspect structure
  const rawParsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true, quoteChar: '"' });
  const allRows = rawParsed.data;

  // Activity Statement: has rows where col[1] === 'Header' or 'Data'
  const isActivityStatement = allRows.some(r => r[1]?.trim() === 'Header' || r[1]?.trim() === 'Data');

  if (isActivityStatement) {
    return parseIBActivityStatement(allRows, existing);
  }

  // Flex Query flat format
  const flatParsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, quoteChar: '"' });
  return parseIBFlexQuery(flatParsed.data, existing);
}

// ─── Webull parser ────────────────────────────────────────────────
function parseWebullDate(s: string): string {
  if (!s) return '';
  const parts = s.trim().split(' ');
  const datePart = parts[0];
  if (datePart.includes('/')) {
    const [m, d, y] = datePart.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return datePart.slice(0, 10);
}

function parseWebullRows(rows: Record<string, string>[], accountId: string, existing: any[]): CsvPreviewRow[] {
  const preview: CsvPreviewRow[] = [];
  for (const row of rows) {
    const status = (row['Status'] || row['status'] || '').trim().toLowerCase();
    if (status && status !== 'filled') continue;
    const side = (row['Side'] || row['side'] || '').trim().toLowerCase();
    if (side !== 'buy' && side !== 'sell') continue;
    const type: TransactionType = side === 'buy' ? 'buy' : 'sell';
    const rawDate = row['Filled Time'] || row['filled time'] || row['Trade Time'] || row['Order Time'] || row['trade time'] || row['order time'] || '';
    const date = parseWebullDate(rawDate);
    if (!date) continue;
    const ticker = (row['Symbol'] || row['symbol'] || row['Instrument'] || '').trim().toUpperCase();
    if (!ticker) continue;
    const qty = Math.abs(parseAmount(row['Filled'] || row['filled'] || row['Filled Qty'] || row['filled qty'] || row['Qty'] || row['qty'] || '0'));
    const price = Math.abs(parseAmount(row['Avg Price'] || row['avg price'] || (row['Price'] || '').replace('@', '') || '0'));
    const fee = Math.abs(parseAmount(row['Commission'] || row['commission'] || row['Fee'] || row['fee'] || '0'));
    const name = (row['Name'] || row['name'] || '').trim();
    preview.push({ date, ticker, type, quantity: qty, price, amount: qty * price, fee, notes: name || 'Webull', skip: false, duplicate: dupCheckSync(existing, date, ticker, type, qty, price), raw_code: side });
  }
  return preview;
}

// ─── Robinhood parser ─────────────────────────────────────────────
function parseRobinhoodRows(rows: Record<string, string>[], accountId: string, existing: any[]): CsvPreviewRow[] {
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
    preview.push({ date, ticker, type: type === 'skip' ? 'skip' : type, quantity: qty, price, amount, fee: 0, notes, skip: type === 'skip', duplicate: dupCheckSync(existing, date, ticker, type === 'skip' ? 'skip' : type, qty, price), raw_code: code });
  }
  return preview;
}

// ─── Generic "new" format parser ──────────────────────────────────
function parseNewRows(rows: Record<string, string>[], ticker: string, accountId: string, existing: any[]): CsvPreviewRow[] {
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
      preview.push({ date, ticker, type: 'dividend', quantity: 0, price: divAmount, amount: divAmount, fee: 0, notes: 'Dividend Reinvest (배당)', skip: false, duplicate: dupCheckSync(existing, date, ticker, 'dividend', 0, divAmount), raw_code: rawType });
      preview.push({ date, ticker, type: 'buy', quantity: qty, price, amount: costBasis, fee, notes: 'Dividend Reinvest (재투자 매수)', skip: false, duplicate: dupCheckSync(existing, date, ticker, 'buy', qty, price), raw_code: rawType });
      continue;
    }
    if (mappedType === 'skip') continue;
    const txType = mappedType as TransactionType;
    const txQty = txType === 'dividend' ? 0 : qty;
    const txPrice = txType === 'dividend' ? (costBasis || qty * price) : price;
    const txFee = txType === 'buy' ? fee : 0;
    preview.push({ date, ticker, type: txType, quantity: txQty, price: txPrice, amount: costBasis || qty * price, fee: txFee, notes: rawType, skip: false, duplicate: dupCheckSync(existing, date, ticker, txType, txQty, txPrice), raw_code: rawType });
  }
  return preview;
}

// ─── POST handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const accountId = formData.get('account_id');
  const tickerInput = ((formData.get('ticker') as string) || '').trim().toUpperCase();

  if (!file || !accountId) return NextResponse.json({ error: 'file and account_id required' }, { status: 400 });

  const accId = String(accountId);
  const { data: ownedAccount } = await supabase.from('accounts').select('id').eq('id', accId).eq('user_id', user.id).single();
  if (!ownedAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, quoteChar: '"' });
  const rows = parsed.data;
  if (!rows.length) return NextResponse.json({ error: '데이터 없음' }, { status: 400 });

  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);

  if (format === 'new' && !tickerInput) return NextResponse.json({ error: 'ticker_required', format }, { status: 400 });

  const { data: existingTxs } = await supabase.from('transactions').select('transaction_date, ticker, type, quantity, price').eq('account_id', accId);
  const existing = existingTxs || [];

  const preview =
    format === 'ib'      ? parseIBRows(text, existing)
    : format === 'webull' ? parseWebullRows(rows, accId, existing)
    : format === 'new'    ? parseNewRows(rows, tickerInput, accId, existing)
    :                       parseRobinhoodRows(rows, accId, existing);

  const action = formData.get('action');
  if (action === 'import') {
    // Transfer-type rows go to cash_flow table; everything else to transactions
    const transferRows = preview.filter(p => !p.skip && !p.duplicate && (p.type === 'transfer_deposit' || p.type === 'transfer_withdraw'));
    const txRows = preview.filter(p => !p.skip && !p.duplicate && p.type !== 'transfer_deposit' && p.type !== 'transfer_withdraw');

    let importedCount = 0;

    if (txRows.length) {
      const toInsert = txRows.map(p => ({
        account_id: accId, transaction_date: p.date, ticker: p.ticker, type: p.type,
        quantity: p.quantity, price: p.price, fee: p.fee, note: p.notes, user_id: user.id,
      }));
      const { error } = await supabase.from('transactions').insert(toInsert);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      importedCount += toInsert.length;
    }

    if (transferRows.length) {
      const cfInsert = transferRows.map(p => ({
        account_id: accId, amount: p.price,
        type: p.type === 'transfer_deposit' ? 'DEPOSIT' : 'WITHDRAWAL',
        date: p.date, note: p.notes, user_id: user.id,
      }));
      const { error } = await supabase.from('cash_flow').insert(cfInsert);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      importedCount += cfInsert.length;
    }

    return NextResponse.json({ imported: importedCount, total: preview.length });
  }

  return NextResponse.json({ preview, total: preview.length, format });
}
