-- Keep the owner check out of the exposed API schema (no /rest/v1/rpc/is_owner).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_owner() set schema private;

drop policy "owner reads companies" on public.companies;
drop policy "owner reads fundamentals" on public.fundamentals_quarterly;
drop policy "owner reads ingest runs" on public.ingest_runs;
create policy "owner reads companies" on public.companies
  for select to authenticated using ((select private.is_owner()));
create policy "owner reads fundamentals" on public.fundamentals_quarterly
  for select to authenticated using ((select private.is_owner()));
create policy "owner reads ingest runs" on public.ingest_runs
  for select to authenticated using ((select private.is_owner()));
