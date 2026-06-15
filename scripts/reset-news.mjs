// One-off script: delete all financial_news and re-fetch from providers
// Usage: node -r dotenv/config scripts/reset-news.mjs
//    or: SUPABASE_URL=... SERVICE_KEY=... node scripts/reset-news.mjs

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;
const FINNHUB_KEY   = process.env.FINNHUB_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !MARKETAUX_KEY || !FINNHUB_KEY) {
  console.error('❌ .env.local 환경변수가 필요합니다. dotenv/config 로 실행하세요:');
  console.error('   node -r dotenv/config scripts/reset-news.mjs');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

// ── ticker extractor ──────────────────────────────────────────────────────────
const BLOCKLIST = new Set([
  'A','I','AI','AM','AN','AS','AT','BE','BY','CEO','CFO','CTO','DO','ETF',
  'FED','FOR','GDP','IF','IN','IPO','IRS','IS','IT','LLC','LP','LTD','MY',
  'NO','OF','ON','OR','PC','PLC','PR','QE','SA','SEC','SO','TO','UK','UN',
  'US','VP','VS','WTO','OK','GO','TV','PM','AM','ET','ST',
]);

function extractTickers(title, summary) {
  const text = `${title} ${summary}`;
  const found = new Set();
  for (const m of text.matchAll(/\b(?:NASDAQ|NYSE|AMEX)[\s:]+([A-Z]{1,5})\b/g)) found.add(m[1]);
  for (const m of text.matchAll(/\$([A-Z]{1,5})\b/g)) found.add(m[1]);
  for (const m of text.matchAll(/\(([A-Z]{2,5})\)/g)) {
    if (m[1].length >= 2 && !BLOCKLIST.has(m[1])) found.add(m[1]);
  }
  return [...found].slice(0, 5);
}

// ── MarketAux ─────────────────────────────────────────────────────────────────
async function fetchMarketaux(limit = 20) {
  const params = new URLSearchParams({ api_token: MARKETAUX_KEY, language: 'en', filter_entities: 'true', limit: String(limit) });
  const res = await fetch(`https://api.marketaux.com/v1/news/all?${params}`);
  if (!res.ok) throw new Error(`Marketaux ${res.status}`);
  const json = await res.json();
  const isUrl = (s) => !!s && /^https?:\/\/\S+$/.test(s.trim());

  return (json.data ?? [])
    .filter((a) => {
      const summary = a.description ?? a.snippet ?? '';
      return a.title && !isUrl(summary) && summary.length > 20;
    })
    .map((a) => {
      const entities = a.entities ?? [];
      const tickers  = entities.map((e) => e.symbol).filter((s) => s && s.length <= 6);
      const keywords = entities.map((e) => e.name).filter(Boolean).slice(0, 5);
      const scores   = entities.map((e) => Math.abs(e.sentiment_score ?? 0)).filter((s) => s > 0);
      const max      = scores.length ? Math.max(...scores) : 0;
      const impact   = entities.length === 0 ? 5 : max >= 0.7 ? 9 : max >= 0.5 ? 7 : max >= 0.3 ? 5 : 3;
      const summary  = a.description ?? a.snippet ?? '';
      return {
        title: a.title, summary, source: a.source,
        published_at: a.published_at, url: a.url,
        category: 'us_market', impact_score: impact, keywords,
        tickers: tickers.length ? tickers : extractTickers(a.title, summary),
      };
    });
}

// ── Finnhub ───────────────────────────────────────────────────────────────────
const HIGH_KW = [
  'fed','federal reserve','rate hike','rate cut','interest rate',
  'fomc','powell','ecb','bank of england','bank of japan','boj',
  'pboc','rba','boc','snb','central bank','monetary policy',
  'basis point','quantitative','tightening','easing',
  'inflation','recession','gdp','cpi','ppi','unemployment',
  'crash','collapse','surge','plunge',
  'dollar','exchange rate','currency','devaluation','depreciation',
  'yuan','yen','euro','forex','fx ',
  'bankruptcy','chapter 11','default','insolvency','liquidat',
  'merger','acquisition','takeover','buyout','ipo','spinoff',
  'earnings beat','earnings miss','layoff','restructur',
  'war','attack','strike','sanction','tariff','iran','israel','china',
  'russia','ukraine','missile','oil','opec','conflict','invasion',
  'hormuz','strait','nuclear','ceasefire','peace deal','peace agreement',
  'escalat','troops','pentagon','nato','coup','embargo',
];

async function fetchFinnhub(limit = 20) {
  const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  const articles = await res.json();
  const isUrl = (s) => !!s && /^https?:\/\/\S+$/.test(s.trim());
  const norm  = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  return articles
    .filter((a) => {
      if (!a.headline || !a.url) return false;
      const s = (a.summary ?? '').replace(/\s+/g, ' ').trim();
      if (isUrl(s) || s.length < 30) return false;
      if (norm(s).startsWith(norm(a.headline).slice(0, 30))) return false;
      return true;
    })
    .slice(0, limit)
    .map((a) => {
      const text   = `${a.headline} ${a.summary}`.toLowerCase();
      const hits   = HIGH_KW.filter((kw) => text.includes(kw)).length;
      const impact = hits >= 3 ? 9 : hits >= 2 ? 7 : hits >= 1 ? 5 : 3;
      const tickers = a.related ? a.related.split(',').map((t) => t.trim()).filter((t) => t.length <= 6) : [];
      return {
        title: a.headline, summary: a.summary, source: a.source,
        published_at: new Date(a.datetime * 1000).toISOString(), url: a.url,
        category: 'us_market', impact_score: impact, keywords: [],
        tickers: tickers.length ? tickers : extractTickers(a.headline, a.summary),
      };
    });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. 전체 삭제
  console.log('🗑️  기존 뉴스 전체 삭제 중...');
  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/financial_news?id=neq.00000000-0000-0000-0000-000000000000`,
    { method: 'DELETE', headers }
  );
  if (!del.ok) throw new Error(`삭제 실패: ${del.status} ${await del.text()}`);
  console.log('✅ 삭제 완료');

  // 2. 수집
  console.log('\n📰 뉴스 수집 중...');
  const [marketaux, finnhub] = await Promise.allSettled([
    fetchMarketaux(20),
    fetchFinnhub(20),
  ]);

  const articles = [
    ...(marketaux.status === 'fulfilled' ? marketaux.value : (console.error('MarketAux 실패:', marketaux.reason), [])),
    ...(finnhub.status  === 'fulfilled' ? finnhub.value  : (console.error('Finnhub 실패:',  finnhub.reason),  [])),
  ].filter((a) => a.impact_score >= 5);

  // URL 중복 제거
  const seen = new Set();
  const unique = articles.filter((a) => { if (seen.has(a.url)) return false; seen.add(a.url); return true; });
  console.log(`✅ 수집: ${articles.length}개 → 중복 제거 후 ${unique.length}개 (impact ≥ 5)`);

  // 3. 저장
  if (unique.length === 0) { console.log('저장할 뉴스 없음'); return; }

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/financial_news`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(unique),
  });
  if (!ins.ok) throw new Error(`저장 실패: ${ins.status} ${await ins.text()}`);
  console.log(`✅ ${unique.length}개 저장 완료`);

  // 4. 현재 DB 상태 확인
  const count = await fetch(
    `${SUPABASE_URL}/rest/v1/financial_news?select=id`,
    { headers: { ...headers, Prefer: 'count=exact' } }
  );
  const total = count.headers.get('content-range')?.split('/')[1] ?? '?';
  console.log(`\n📊 DB 총 뉴스: ${total}개`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
