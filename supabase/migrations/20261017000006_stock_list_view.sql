-- Flat list for search, filters and server-side sorting. security_invoker keeps the owner-only RLS
-- of the underlying tables in force.
create view public.stock_list with (security_invoker = true) as
select c.ticker, c.name, c.sector, c.asset_type, c.in_sp500, c.core, c.exchange,
       m.price, m.change_1d, m.market_cap, m.pe, m.pb, m.return_1y, m.score, m.as_of
from public.companies c
left join public.stock_metrics m using (ticker);
