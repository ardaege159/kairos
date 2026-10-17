-- Extra tickers the owner tracks outside the S&P 500. They are compared against S&P 500
-- sector peers but never change sector statistics.
alter table public.companies add column in_sp500 boolean not null default true;
