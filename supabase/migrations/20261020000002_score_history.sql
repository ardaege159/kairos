-- Daily Kairos Score per core ticker (S&P 500 + extras), written by compute-metrics. ~500 rows a day.
create table public.score_history (
  ticker text not null references public.companies (ticker) on delete cascade,
  date date not null,
  score smallint not null,
  parts jsonb,
  primary key (ticker, date)
);
alter table public.score_history enable row level security;
create policy "owner reads score history" on public.score_history for select to authenticated using ((select private.is_owner()));
