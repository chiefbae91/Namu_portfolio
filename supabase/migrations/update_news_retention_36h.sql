-- Update pg_cron job: 7 days → 36 hours, created_at → published_at
SELECT cron.unschedule('delete-old-news');

SELECT cron.schedule(
  'delete-old-news',
  '0 * * * *',
  $$DELETE FROM financial_news WHERE published_at < NOW() - INTERVAL '36 hours'$$
);
