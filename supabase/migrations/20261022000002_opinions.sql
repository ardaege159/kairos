-- Independent investors' stock opinions: one row per feed post (processed once), and the stocks the
-- author actually argues for or against, as an AI-written Turkish summary plus the link. No full text kept.
create table public.opinion_posts (
  id text primary key,               -- sha1 of the post URL
  source text not null,              -- lib/opinions/sources.ts key
  title text not null,
  url text not null,
  published_at timestamptz not null,
  mentions integer not null default 0,
  created_at timestamptz not null default now()
);
create index opinion_posts_published_idx on public.opinion_posts (published_at desc);

create table public.opinion_mentions (
  post_id text not null references public.opinion_posts (id) on delete cascade,
  ticker text not null references public.companies (ticker) on delete cascade,
  stance text not null check (stance in ('olumlu', 'olumsuz', 'notr')),
  summary text not null,
  points jsonb not null default '[]',
  primary key (post_id, ticker)
);
create index opinion_mentions_ticker_idx on public.opinion_mentions (ticker);

alter table public.opinion_posts enable row level security;
alter table public.opinion_mentions enable row level security;
create policy "owner reads opinion posts" on public.opinion_posts for select to authenticated using ((select private.is_owner()));
create policy "owner reads opinion mentions" on public.opinion_mentions for select to authenticated using ((select private.is_owner()));

-- Whether the stock is the post's main subject or discussed alongside another company.
alter table public.opinion_mentions add column focus text not null default 'yan' check (focus in ('ana', 'yan'));
