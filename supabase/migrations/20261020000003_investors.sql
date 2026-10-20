-- Famous investors' portfolios from SEC 13F filings (last three quarters per investor), and a CUSIP to
-- ticker cache (OpenFIGI, with company-name matching as fallback).
create table public.investor_filings (
  accession text primary key,
  cik bigint not null,
  period date not null,               -- quarter end the holdings are as of
  filed_at date not null,
  total_value numeric not null,
  positions integer not null
);
create index investor_filings_cik_idx on public.investor_filings (cik, period desc);

create table public.investor_holdings (
  cik bigint not null,
  period date not null,
  cusip text not null,
  put_call text not null default '',
  issuer text not null,
  title text,
  ticker text,
  value numeric not null,
  shares numeric not null,
  primary key (cik, period, cusip, put_call)
);
create index investor_holdings_ticker_idx on public.investor_holdings (ticker, period desc);

create table public.cusip_map (
  cusip text primary key,
  ticker text,                        -- null: looked up, no US equity ticker found
  name text,
  source text,                        -- openfigi | name
  updated_at timestamptz not null default now()
);

alter table public.investor_filings enable row level security;
alter table public.investor_holdings enable row level security;
alter table public.cusip_map enable row level security;
create policy "owner reads investor filings" on public.investor_filings for select to authenticated using ((select private.is_owner()));
create policy "owner reads investor holdings" on public.investor_holdings for select to authenticated using ((select private.is_owner()));
create policy "owner reads cusip map" on public.cusip_map for select to authenticated using ((select private.is_owner()));
