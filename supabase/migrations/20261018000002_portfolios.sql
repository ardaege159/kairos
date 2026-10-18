-- Owner portfolios and their positions (shares bought at a price on a date).

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  note text,
  created_at timestamptz not null default now()
);

create table public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  ticker text not null references public.companies (ticker) on delete cascade,
  shares numeric not null check (shares > 0),
  buy_price numeric not null check (buy_price > 0),
  buy_date date not null,
  created_at timestamptz not null default now()
);
create index portfolio_positions_portfolio_idx on public.portfolio_positions (portfolio_id);

alter table public.portfolios enable row level security;
alter table public.portfolio_positions enable row level security;

create policy "owner manages own portfolios" on public.portfolios for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()))
  with check (user_id = (select auth.uid()) and (select private.is_owner()));

create policy "owner manages own positions" on public.portfolio_positions for all to authenticated
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())) and (select private.is_owner()))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())) and (select private.is_owner()));
