-- Daily prices (Alpaca SIP, split-adjusted), computed per-stock metrics and sector distributions.

create table public.prices_daily (
  ticker text not null references public.companies (ticker) on delete cascade,
  date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null,
  primary key (ticker, date)
);

-- One row per ticker, rebuilt by scripts/ingest/compute-metrics.ts after each price/fundamental load.
create table public.stock_metrics (
  ticker text primary key references public.companies (ticker) on delete cascade,
  as_of date not null,                 -- last price date used
  latest_period text,                  -- latest fundamentals period used, e.g. CY2026Q2
  price numeric,
  change_1d numeric,                   -- fraction, 0.012 = +1.2%
  metrics jsonb not null default '{}', -- metric key -> value (ratios as fractions)
  sector_pct jsonb not null default '{}', -- metric key -> 0..1 percentile within sector ("higher is better" already applied)
  score numeric,                       -- Kairos Skoru 0..100
  score_parts jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.sector_stats (
  sector text not null,
  metric text not null,
  median numeric,
  p25 numeric,
  p75 numeric,
  n integer not null,
  updated_at timestamptz not null default now(),
  primary key (sector, metric)
);

alter table public.prices_daily enable row level security;
alter table public.stock_metrics enable row level security;
alter table public.sector_stats enable row level security;

create policy "owner reads prices" on public.prices_daily
  for select to authenticated using ((select private.is_owner()));
create policy "owner reads stock metrics" on public.stock_metrics
  for select to authenticated using ((select private.is_owner()));
create policy "owner reads sector stats" on public.sector_stats
  for select to authenticated using ((select private.is_owner()));
