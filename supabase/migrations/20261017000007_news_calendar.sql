-- News (Marketaux company news + GDELT global themes), their ticker/sector links, and the
-- economic and earnings calendars for the "Bugün" page.

create table public.news_items (
  id text primary key,                      -- marketaux uuid or sha of the GDELT url
  source text not null check (source in ('marketaux', 'gdelt')),
  kind text not null check (kind in ('company', 'global')),
  url text not null,
  title text not null,
  description text,
  image_url text,
  source_domain text,
  published_at timestamptz not null,
  topic text,                               -- GDELT theme key, e.g. oil, rates
  sectors text[] not null default '{}',     -- GICS sectors the item is relevant to
  fetched_at timestamptz not null default now()
);
create index news_items_published_idx on public.news_items (published_at desc);
create index news_items_kind_idx on public.news_items (kind, published_at desc);

create table public.news_tickers (
  news_id text not null references public.news_items (id) on delete cascade,
  ticker text not null references public.companies (ticker) on delete cascade,
  match_score numeric,
  sentiment numeric,                        -- Marketaux entity sentiment, -1..1
  primary key (news_id, ticker)
);
create index news_tickers_ticker_idx on public.news_tickers (ticker);

create table public.econ_calendar (
  date date not null,
  release_id integer not null,
  name text not null,
  importance smallint not null default 1,   -- 2 = market-moving (CPI, jobs, GDP, FOMC)
  source text not null default 'fred',
  primary key (date, release_id)
);

create table public.earnings_calendar (
  ticker text not null references public.companies (ticker) on delete cascade,
  report_date date not null,
  fiscal_date_ending date,
  estimate_eps numeric,
  time_of_day text,                         -- pre-market / post-market / null
  primary key (ticker, report_date)
);
create index earnings_calendar_date_idx on public.earnings_calendar (report_date);

alter table public.news_items enable row level security;
alter table public.news_tickers enable row level security;
alter table public.econ_calendar enable row level security;
alter table public.earnings_calendar enable row level security;
create policy "owner reads news" on public.news_items for select to authenticated using ((select private.is_owner()));
create policy "owner reads news tickers" on public.news_tickers for select to authenticated using ((select private.is_owner()));
create policy "owner reads econ calendar" on public.econ_calendar for select to authenticated using ((select private.is_owner()));
create policy "owner reads earnings calendar" on public.earnings_calendar for select to authenticated using ((select private.is_owner()));
