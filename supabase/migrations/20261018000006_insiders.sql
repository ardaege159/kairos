-- Insider transactions (SEC Form 4) for core tickers. insider_filings records every processed filing
-- so later runs only fetch new ones (some filings have no common-stock transactions).
create table public.insider_filings (
  accession text primary key,
  ticker text not null references public.companies (ticker) on delete cascade,
  filed_at date not null
);
create table public.insider_trades (
  id text primary key,                 -- accession|row
  accession text not null references public.insider_filings (accession) on delete cascade,
  ticker text not null references public.companies (ticker) on delete cascade,
  filed_at date not null,
  trade_date date not null,
  owner text not null,
  role text,
  code text not null,
  acquired boolean not null,
  shares numeric not null,
  price numeric,
  value numeric,
  owned_after numeric,
  plan boolean not null default false
);
create index insider_trades_ticker_idx on public.insider_trades (ticker, trade_date desc);
create index insider_trades_code_idx on public.insider_trades (code, trade_date desc);

alter table public.insider_filings enable row level security;
alter table public.insider_trades enable row level security;
create policy "owner reads insider filings" on public.insider_filings for select to authenticated using ((select private.is_owner()));
create policy "owner reads insider trades" on public.insider_trades for select to authenticated using ((select private.is_owner()));
