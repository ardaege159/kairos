-- Turkish headline and short summary per news item, written by scripts/ingest/news-translate.ts.
alter table public.news_items
  add column if not exists title_tr text,
  add column if not exists summary_tr text;

create index if not exists news_items_untranslated_idx on public.news_items (published_at desc) where title_tr is null;
