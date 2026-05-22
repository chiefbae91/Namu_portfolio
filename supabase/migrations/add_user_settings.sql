create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value text,
  updated_at timestamptz default now(),
  unique(user_id, key)
);

alter table user_settings enable row level security;

create policy "users manage own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
