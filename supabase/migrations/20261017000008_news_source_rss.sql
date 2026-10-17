-- Global headlines come from publishers' public RSS feeds (GDELT throttles shared IPs).
alter table public.news_items drop constraint news_items_source_check;
alter table public.news_items add constraint news_items_source_check check (source in ('marketaux', 'gdelt', 'rss'));
