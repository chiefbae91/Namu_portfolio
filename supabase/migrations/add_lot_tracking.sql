-- Run this in your Supabase SQL editor

alter table transactions add column if not exists lot_method text;

create table if not exists lot_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sell_tx_id uuid not null references transactions(id) on delete cascade,
  buy_tx_id uuid not null references transactions(id),
  quantity numeric not null,
  created_at timestamptz not null default now()
);

alter table lot_assignments enable row level security;

create policy "Users manage own lot assignments"
  on lot_assignments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
