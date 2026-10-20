-- AI-written stock summary, cached per ticker. Regenerated when the underlying outlook changes
-- (input_hash) or on a new day, so it follows the data without calling the model on every visit.
create table public.ai_summaries (
  ticker text primary key references public.companies (ticker) on delete cascade,
  input_hash text not null,
  summary text not null,
  model text,
  created_at timestamptz not null default now()
);
alter table public.ai_summaries enable row level security;
create policy "owner reads ai summaries" on public.ai_summaries for select to authenticated using ((select private.is_owner()));
create policy "owner writes ai summaries" on public.ai_summaries for insert to authenticated with check ((select private.is_owner()));
create policy "owner updates ai summaries" on public.ai_summaries for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
