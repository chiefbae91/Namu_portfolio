export type Currency = 'USD' | 'KRW' | 'EUR';
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'cash' | 'option';
export type TaxLotMethod = 'average_cost' | 'fifo' | 'lifo' | 'specific';

export interface LotInfo {
  id: number;
  date: string;
  ticker: string;
  account_id: number;
  account_name: string;
  quantity: number;
  remaining: number;
  price: number;
  fee: number;
}

export interface LotSelection {
  buy_tx_id: number;
  quantity: number;
  price: number;
}

export interface LotsResponse {
  lots: LotInfo[];
  selected: LotSelection[];
  cost_per_share: number;
  total_cost: number;
  avg_cost_all: number;
}

export interface Account {
  id: number;
  name: string;
  currency: string;
  hidden: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  account_name?: string;
  date: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  notes?: string;
}

export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  value: number;
  cost: number;
  return_pct: number;
  return_amount: number;
}

export interface OptionPosition {
  id: number;
  account_id: number;
  account_name?: string;
  date: string;
  ticker: string;
  option_type: 'call' | 'put';
  action: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  premium: number;
  fee: number;
  open_qty: number;
  realized_pnl: number;
}

export interface ExchangeRates {
  USD: number;
  KRW: number;
  EUR: number;
}

export interface SummaryData {
  cash: number;
  stock: number;
  options_pnl: number;
  total: number;
}

export interface CsvPreviewRow {
  date: string;
  ticker: string;
  type: TransactionType | 'unknown' | 'skip';
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  notes: string;
  skip: boolean;
  duplicate: boolean;
  raw_code: string;
}
