-- Analyses storage for the Python analysis API and read-only web client.
-- Safe to run in Supabase SQL Editor on a fresh or existing analyses table.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  result jsonb not null,
  created_at timestamptz not null default now(),
  is_public boolean not null default false
);

-- Bring an existing table up to date without replacing stored results.
alter table public.analyses
  alter column id set default gen_random_uuid(),
  alter column created_at set default now();

alter table public.analyses
  add column if not exists is_public boolean not null default false;

alter table public.analyses enable row level security;

-- Browser clients can read public rows only. No browser role can write rows.
drop policy if exists "Public analyses are readable" on public.analyses;
create policy "Public analyses are readable"
  on public.analyses
  for select
  to anon, authenticated
  using (is_public = true);

revoke all on table public.analyses from anon, authenticated;
grant select on table public.analyses to anon, authenticated;

-- The Python API uses SUPABASE_SECRET_KEY (server environment only).
-- Supabase service_role bypasses RLS; this grant also makes its intent explicit.
grant all on table public.analyses to service_role;

comment on column public.analyses.result is
  'Complete analysis payload JSON; arrays such as time_series, table_sessions, and table_summary are stored unchanged.';
comment on column public.analyses.is_public is
  'Only rows explicitly set true are visible to browser roles.';
