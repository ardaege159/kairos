-- Federal spending, round 2: award details for each contract action, year-over-year company totals,
-- theme (keyword) trends and industry (NAICS) growth, to spot where federal money is moving.

alter table public.spending_actions
  add column generated_id text,
  add column modification text,           -- "0" = new award, otherwise modification number
  add column award_type text,             -- DELIVERY ORDER, DEFINITIVE CONTRACT, PURCHASE ORDER, BPA CALL...
  add column naics_code text,
  add column naics_desc text,
  add column psc_code text,
  add column psc_desc text,
  add column total_obligation numeric,    -- obligated on the whole award so far
  add column potential_value numeric,     -- base and all options
  add column pop_start date,
  add column pop_end date,
  add column place_state text,
  add column competition text,
  add column offers integer;

alter table public.spending_by_company
  add column amount_prev numeric,         -- the 12 months before period_start
  add column prev_start date,
  add column prev_end date;

create table public.spending_themes (
  key text primary key,
  quarters jsonb not null default '[]',   -- [{fy, q, amount}] federal fiscal quarters, oldest first
  amount_12m numeric,
  amount_prev_12m numeric,
  top_recipients jsonb not null default '[]', -- [{name, amount, ticker}]
  updated_at timestamptz not null default now()
);

create table public.spending_industries (
  naics_code text primary key,
  name text not null,
  amount_12m numeric,
  amount_prev_12m numeric,
  updated_at timestamptz not null default now()
);

alter table public.spending_themes enable row level security;
alter table public.spending_industries enable row level security;
create policy "owner reads spending themes" on public.spending_themes for select to authenticated using ((select private.is_owner()));
create policy "owner reads spending industries" on public.spending_industries for select to authenticated using ((select private.is_owner()));

-- Growth compares two fully reported windows (DoD reports ~90 days late): amount_lagged covers the
-- 12 months ending 90 days ago, amount_prev the 12 months before that.
alter table public.spending_by_company add column amount_lagged numeric;
