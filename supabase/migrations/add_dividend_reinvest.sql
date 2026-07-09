-- Run this in your Supabase SQL editor
-- Restores dividend-reinvestment linkage lost in the SQLite -> Supabase migration.

alter table transactions add column if not exists subtype text;
alter table transactions add column if not exists dividend_id uuid references transactions(id) on delete set null;
