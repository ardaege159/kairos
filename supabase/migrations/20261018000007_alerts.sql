-- Alerts the owner sets (price, daily move, score) and the notifications produced when data updates.
-- Watchlist events (earnings, insider buys, federal contracts, big moves) notify without an alert row.
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticker text not null references public.companies (ticker) on delete cascade,
  kind text not null check (kind in ('price_above', 'price_below', 'move_abs', 'score_above', 'score_below')),
  threshold numeric not null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  triggered_at timestamptz
);
create index alerts_user_idx on public.alerts (user_id, active);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text references public.companies (ticker) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  dedupe text not null,                 -- one notification per event (e.g. "earnings|AAPL|2026-10-30")
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.alerts enable row level security;
alter table public.notifications enable row level security;
create policy "owner reads own alerts" on public.alerts for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner creates own alerts" on public.alerts for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner updates own alerts" on public.alerts for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()))
  with check (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner deletes own alerts" on public.alerts for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner reads own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner marks own notifications" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()))
  with check (user_id = (select auth.uid()) and (select private.is_owner()));
create policy "owner deletes own notifications" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_owner()));
