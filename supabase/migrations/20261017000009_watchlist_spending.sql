-- Watchlist (owner edits it from the app) and federal spending (USAspending) linked to tickers.

create table public.watchlist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticker text not null references public.companies (ticker) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
alter table public.watchlist enable row level security;
create policy "owner reads own watchlist" on public.watchlist for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner adds to own watchlist" on public.watchlist for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner removes from own watchlist" on public.watchlist for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));

-- USAspending recipients with their parent company and the ticker we matched it to (cache).
create table public.spending_recipients (
  recipient_id text primary key,
  name text not null,
  parent_name text,
  ticker text references public.companies (ticker) on delete set null,
  match_method text,                       -- exact | prefix | none
  updated_at timestamptz not null default now()
);

-- Contract obligations per company over the trailing 12 months (federal contracts only).
create table public.spending_by_company (
  ticker text primary key references public.companies (ticker) on delete cascade,
  amount numeric not null,
  recipients text[] not null default '{}',  -- the recipient names that rolled up into this ticker
  period_start date not null,
  period_end date not null,
  updated_at timestamptz not null default now()
);

-- Largest individual contract actions of the last 30 days.
create table public.spending_actions (
  id text primary key,
  action_date date not null,
  award_id text,
  recipient_name text not null,
  ticker text references public.companies (ticker) on delete set null,
  amount numeric not null,
  agency text,
  sub_agency text,
  description text,
  award_url text,
  fetched_at timestamptz not null default now()
);
create index spending_actions_date_idx on public.spending_actions (action_date desc);
create index spending_actions_ticker_idx on public.spending_actions (ticker);

alter table public.spending_recipients enable row level security;
alter table public.spending_by_company enable row level security;
alter table public.spending_actions enable row level security;
create policy "owner reads spending recipients" on public.spending_recipients for select to authenticated using ((select private.is_owner()));
create policy "owner reads spending by company" on public.spending_by_company for select to authenticated using ((select private.is_owner()));
create policy "owner reads spending actions" on public.spending_actions for select to authenticated using ((select private.is_owner()));
