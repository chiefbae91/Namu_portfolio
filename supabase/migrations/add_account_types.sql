-- Run this in your Supabase SQL editor

create table if not exists account_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  unique (user_id, name)
);

alter table accounts
  add column if not exists type_id uuid references account_types(id) on delete set null;

-- Row-level security
alter table account_types enable row level security;

create policy "Users manage own account types"
  on account_types for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
