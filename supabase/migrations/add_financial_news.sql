-- Enable pg_cron extension (requires superuser, run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- financial_news table
CREATE TABLE IF NOT EXISTS financial_news (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  summary     TEXT,
  source      TEXT,
  url         TEXT        UNIQUE NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  category    TEXT        DEFAULT 'us_market',
  impact_score INTEGER    DEFAULT 5 CHECK (impact_score BETWEEN 1 AND 10),
  keywords    TEXT[]      DEFAULT '{}',
  tickers     TEXT[]      DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_news_published ON financial_news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_news_tickers   ON financial_news USING gin (tickers);

-- 7-day retention via pg_cron (run in Supabase SQL editor)
SELECT cron.schedule(
  'delete-old-news',
  '0 0 * * *',
  $$DELETE FROM financial_news WHERE created_at < NOW() - INTERVAL '7 days'$$
);
