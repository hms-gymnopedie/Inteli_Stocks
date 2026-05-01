-- Migration 001: portfolios table — B5-CR
-- Apply in Supabase SQL editor or via `supabase db push` (CLI).
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

create table if not exists portfolios (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only read/write their own row.
-- The server-side admin client bypasses RLS via the service-role key,
-- so this policy is an extra safety net for any direct client access.
alter table portfolios enable row level security;

create policy "users access their own portfolio"
  on portfolios
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
