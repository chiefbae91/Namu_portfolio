-- Run this in your Supabase SQL editor

create table if not exists price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hint_id text not null,
  ticker text not null,
  hint_type text not null,
  hint_prices text not null default '',
  active boolean not null default true,
  triggered boolean not null default false,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, hint_id)
);

alter table price_alerts enable row level security;

create policy "Users manage own price alerts"
  on price_alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists hint_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  hint_type text not null,
  hint_price numeric not null,
  current_price numeric not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table hint_notifications enable row level security;

create policy "Users manage own hint notifications"
  on hint_notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
