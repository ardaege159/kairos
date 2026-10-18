-- Reported vs estimated EPS per quarter (Alpha Vantage EARNINGS, both on the analysts' adjusted basis).
create table public.earnings_history (
  ticker text not null references public.companies (ticker) on delete cascade,
  fiscal_date_ending date not null,
  reported_date date,
  reported_eps numeric,
  estimated_eps numeric,
  surprise_pct numeric,
  report_time text,
  primary key (ticker, fiscal_date_ending)
);
-- When each ticker was last fetched (25 requests/day: tickers are refreshed only after a new report).
create table public.earnings_fetch (
  ticker text primary key references public.companies (ticker) on delete cascade,
  fetched_at timestamptz not null default now(),
  last_reported date
);
alter table public.earnings_history enable row level security;
alter table public.earnings_fetch enable row level security;
create policy "owner reads earnings history" on public.earnings_history for select to authenticated using ((select private.is_owner()));
create policy "owner reads earnings fetch" on public.earnings_fetch for select to authenticated using ((select private.is_owner()));
