-- Broad universe: every exchange-listed US stock and ETF (no OTC, no mutual funds).
-- "core" tickers (S&P 500 + owner extras) keep full daily bars in prices_daily; the rest keep only
-- the computed snapshot in stock_metrics and load their chart on demand.

create extension if not exists pg_trgm with schema extensions;

alter table public.companies alter column cik drop not null;
alter table public.companies alter column sector drop not null;
alter table public.companies add column asset_type text not null default 'stock' check (asset_type in ('stock', 'etf'));
alter table public.companies add column exchange text;
alter table public.companies add column sic integer;
alter table public.companies add column core boolean not null default false;
update public.companies set core = true;
create index companies_core_idx on public.companies (core) where core;
create index companies_name_trgm_idx on public.companies using gin (lower(name) extensions.gin_trgm_ops);

-- One row per issuer and calendar quarter; values is metric -> number (replaces the per-metric table).
create table public.fundamentals_q (
  cik integer not null,
  period text not null,
  period_end date not null,
  values jsonb not null,
  sources jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  primary key (cik, period)
);
alter table public.fundamentals_q enable row level security;
create policy "owner reads fundamentals_q" on public.fundamentals_q
  for select to authenticated using ((select private.is_owner()));

-- Sortable copies of the most used metrics (the list page sorts server-side).
alter table public.stock_metrics add column market_cap numeric;
alter table public.stock_metrics add column pe numeric;
alter table public.stock_metrics add column pb numeric;
alter table public.stock_metrics add column return_1y numeric;
create index stock_metrics_market_cap_idx on public.stock_metrics (market_cap desc nulls last);
create index stock_metrics_score_idx on public.stock_metrics (score desc nulls last);
