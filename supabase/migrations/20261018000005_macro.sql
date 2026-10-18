-- Macro dashboard: FRED observations (daily series ~3 years, monthly/quarterly ~6 years).
create table public.macro_observations (
  series_id text not null,
  date date not null,
  value numeric not null,
  primary key (series_id, date)
);
alter table public.macro_observations enable row level security;
create policy "owner reads macro observations" on public.macro_observations for select to authenticated using ((select private.is_owner()));
