-- Kairos core schema: owner gate, S&P 500 companies, quarterly fundamentals, ingest log.
-- Reads: only the owner (RLS). Writes: ingestion jobs with the secret key (bypasses RLS).

create table public.app_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_owner enable row level security;
-- No policies: clients can never read or write this table.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_owner where user_id = (select auth.uid()));
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create table public.companies (
  ticker text primary key,
  cik integer not null,          -- not unique: GOOGL/GOOG etc. share one issuer
  name text not null,
  sector text not null,
  sub_industry text,
  added_to_index date,
  updated_at timestamptz not null default now()
);
create index companies_sector_idx on public.companies (sector);
create index companies_cik_idx on public.companies (cik);

create table public.fundamentals_quarterly (
  cik integer not null,              -- issuer; join to companies on cik
  period text not null,              -- SEC frame, e.g. CY2026Q2 (flows) / CY2026Q2I (balances stored without the I)
  metric text not null,              -- normalized metric key, e.g. revenue, net_income, eps_diluted
  value numeric not null,
  unit text not null,                -- USD, USD/shares, shares
  period_start date,
  period_end date not null,
  source_tag text not null,          -- the us-gaap / dei tag the value came from
  accn text,
  fetched_at timestamptz not null default now(),
  primary key (cik, period, metric)
);
create index fundamentals_metric_period_idx on public.fundamentals_quarterly (metric, period);

create table public.ingest_runs (
  id bigint generated always as identity primary key,
  source text not null,              -- sec_frames, alpaca_bars, marketaux, ...
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  detail jsonb
);
create index ingest_runs_source_idx on public.ingest_runs (source, started_at desc);

alter table public.companies enable row level security;
alter table public.fundamentals_quarterly enable row level security;
alter table public.ingest_runs enable row level security;

create policy "owner reads companies" on public.companies
  for select to authenticated using ((select public.is_owner()));
create policy "owner reads fundamentals" on public.fundamentals_quarterly
  for select to authenticated using ((select public.is_owner()));
create policy "owner reads ingest runs" on public.ingest_runs
  for select to authenticated using ((select public.is_owner()));
