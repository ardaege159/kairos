-- Small, concentrated managers ranked by 13F-implied performance against the S&P 500 (SPY, same method).
-- Computed offline from SEC's quarterly 13F bulk data sets by scripts/ingest/small-funds.ts; their latest
-- holdings go into investor_filings/investor_holdings like the famous investors'.
create table public.small_funds (
  cik bigint primary key,
  name text not null,
  rank integer not null,
  latest_period date not null,
  total_value numeric not null,
  positions integer not null,
  top_weight numeric,
  annual numeric,                 -- annualized 13F-implied return
  bench_annual numeric,           -- SPY, same method and quarters
  excess numeric,
  vol numeric,
  max_drawdown numeric,
  beat integer,                   -- quarters ahead of SPY
  quarters integer,
  series jsonb not null default '[]', -- [{period, r, bench}]
  updated_at timestamptz not null default now()
);
alter table public.small_funds enable row level security;
create policy "owner reads small funds" on public.small_funds for select to authenticated using ((select private.is_owner()));

-- Average share of each quarter-end portfolio in positions that were not held a quarter earlier.
alter table public.small_funds add column turnover numeric;
