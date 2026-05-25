import { Currency, ExchangeRates } from './types';

export type DateFormat = 'MM/DD/YY' | 'YYYY/MM/DD';

export function formatDate(ymd: string, fmt: DateFormat): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  if (fmt === 'MM/DD/YY') return `${m}/${d}/${y.slice(2)}`;
  return `${y}/${m}/${d}`;
}

const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

export function formatCurrency(usd: number, currency: Currency, rates: ExchangeRates): string {
  const v = usd * rates[currency];
  const sym = SYMBOLS[currency];
  if (currency === 'KRW') {
    return `${sym}${Math.round(v).toLocaleString('en-US')}`;
  }
  return `${sym}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format a raw number string with thousands commas while preserving decimals
export function formatPriceInput(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '');
  const dotIndex = clean.indexOf('.');
  const intPart = dotIndex >= 0 ? clean.slice(0, dotIndex) : clean;
  const decPart = dotIndex >= 0 ? clean.slice(dotIndex) : '';
  const withCommas = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
  return withCommas + decPart;
}

// Strip commas and parse to float
export function parsePriceInput(value: string): number {
  return parseFloat(value.replace(/,/g, '')) || 0;
}
