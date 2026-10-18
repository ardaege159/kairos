import { Heatmap, type HeatItem } from "@/components/heatmap";
import { listSp500 } from "@/lib/data/stocks";

/** Server wrapper: S&P 500 members with a market cap, as heatmap cells. */
export async function MarketHeatmap({ height }: { height?: number }) {
  const members = await listSp500();
  const items: HeatItem[] = members
    .filter((s) => s.sector && s.metrics.market_cap)
    .map((s) => ({
      ticker: s.ticker, name: s.name, sector: s.sector!, cap: s.metrics.market_cap!,
      d1: s.change_1d, m1: s.metrics.return_1m ?? null, m3: s.metrics.return_3m ?? null,
    }));
  return (
    <section className="glass-card p-5" aria-labelledby="heatmap-title">
      <h2 id="heatmap-title" className="mb-3 font-semibold">S&amp;P 500 ısı haritası</h2>
      <Heatmap items={items} height={height} />
    </section>
  );
}
