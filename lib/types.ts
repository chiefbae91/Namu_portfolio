export type Currency = 'USD' | 'KRW' | 'EUR';
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'cash' | 'option' | 'transfer_deposit' | 'transfer_withdraw' | 'split' | 'consolidation';
export type TaxLotMethod = 'average_cost' | 'fifo' | 'lifo' | 'specific';

export interface LotInfo {
  id: string | number;
  date: string;
  ticker: string;
  account_id: string | number;
  account_name: string;
  quantity: number;
  remaining: number;
  price: number;
  fee: number;
}

export interface LotSelection {
  buy_tx_id: string | number;
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

export interface AccountType {
  id: string | number;
  name: string;
  color: string;
}

export interface Account {
  id: string | number;
  name: string;
  currency: string;
  hidden: number | boolean;
  type_id?: string | number | null;
}

export interface Transaction {
  id: string | number;
  account_id: string | number;
  account_name?: string;
  date: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  notes?: string;
  lot_method?: TaxLotMethod | null;
  lot_assignments?: { buy_tx_id: string; quantity: number }[] | null;
  subtype?: string | null;
  dividend_id?: number | null;
  // populated only on dividend rows that have a linked reinvest
  reinvest_id?: number | null;
  reinvest_qty?: number | null;
  reinvest_price?: number | null;
}

export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  prev_close: number;
  value: number;
  cost: number;
  return_pct: number;
  return_amount: number;
  quote_type?: string;
  leverage?: string;
}

export interface OptionPosition {
  id: string | number;
  account_id: string | number;
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
  KRW_PREV: number;
  EUR: number;
  DXY: number;
  DXY_PREV: number;
  WTI: number;
  WTI_PREV: number;
  GOLD: number;
  GOLD_PREV: number;
  ES: number;
  ES_PREV: number;
  ES_MARKET_STATE: string;
  ES_EXT_PRICE: number | null;
  ES_EXT_CHG_PCT: number | null;
  T5Y: number;
  T5Y_PREV: number;
  T10Y: number;
  T10Y_PREV: number;
  T30Y: number;
  T30Y_PREV: number;
}


export interface SummaryData {
  cash: number;
  stock: number;
  options_pnl: number;
  total: number;
}

export interface AccountBreakdown {
  account_id: string | number;
  account_name: string;
  cash: number;
  stock_value: number;
}

export interface TradingHint {
  id: string | number;
  ticker: string;
  hint_date: string;
  type: string;
  price: string | number | number[] | null;
  current_price: number | null;
  note: string | null;
  created_at: string;
}

export interface HintAlert {
  id: string;
  hint_id: string;
  ticker: string;
  hint_type: string;
  hint_prices: string;
  active: boolean;
  triggered: boolean;
  triggered_at: string | null;
  created_at: string;
}

export interface HintNotification {
  id: string;
  ticker: string;
  hint_type: string;
  hint_price: number;
  current_price: number;
  message: string;
  read: boolean;
  created_at: string;
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
