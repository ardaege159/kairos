-- Average daily traded value (last 20 sessions): lets ETFs, which have no market cap, sort by liquidity.
alter table public.stock_metrics add column dollar_volume numeric;
create index stock_metrics_dollar_volume_idx on public.stock_metrics (dollar_volume desc nulls last);

create or replace view public.stock_list with (security_invoker = true) as
select c.ticker, c.name, c.sector, c.asset_type, c.in_sp500, c.core, c.exchange,
       m.price, m.change_1d, m.market_cap, m.pe, m.pb, m.return_1y, m.score, m.as_of, m.dollar_volume
from public.companies c
left join public.stock_metrics m using (ticker);
