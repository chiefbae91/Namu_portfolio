// Extracts ticker symbols from article text
// Patterns: (NASDAQ: AAPL), (NYSE: TSLA), $AAPL, Apple (AAPL)
const EXCHANGE_PATTERN = /\b(?:NASDAQ|NYSE|AMEX|NYSE\s?ARCA)[\s:]+([A-Z]{1,5})\b/g;
const CASHTAG_PATTERN  = /\$([A-Z]{1,5})\b/g;
const PAREN_PATTERN    = /\(([A-Z]{2,5})\)/g;

// Common words that look like tickers but aren't
const BLOCKLIST = new Set([
  'A', 'I', 'AI', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'CEO', 'CFO',
  'CTO', 'DO', 'ETF', 'FED', 'FOR', 'GDP', 'IF', 'IN', 'IPO', 'IRS',
  'IS', 'IT', 'LLC', 'LP', 'LTD', 'MY', 'NO', 'OF', 'ON', 'OR', 'PC',
  'PLC', 'PR', 'QE', 'SA', 'SEC', 'SO', 'TO', 'UK', 'UN', 'US', 'VP',
  'VS', 'WTO', 'OK', 'GO', 'TV', 'PM', 'AM', 'ET', 'ST',
]);

export function extractTickers(title: string, summary: string): string[] {
  const text = `${title} ${summary}`;
  const found = new Set<string>();

  for (const match of text.matchAll(EXCHANGE_PATTERN)) {
    found.add(match[1]);
  }
  for (const match of text.matchAll(CASHTAG_PATTERN)) {
    found.add(match[1]);
  }
  for (const match of text.matchAll(PAREN_PATTERN)) {
    const t = match[1];
    if (t.length >= 2 && !BLOCKLIST.has(t)) found.add(t);
  }

  return [...found].slice(0, 5);
}
