-- Screener: expose every computed metric (jsonb) on the list view so filters can target any of them.
create or replace view public.stock_list with (security_invoker = true) as
select c.ticker, c.name, c.sector, c.asset_type, c.in_sp500, c.core, c.exchange,
       m.price, m.change_1d, m.market_cap, m.pe, m.pb, m.return_1y, m.score, m.as_of, m.dollar_volume,
       m.metrics
from public.companies c
left join public.stock_metrics m using (ticker);
