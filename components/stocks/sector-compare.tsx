import { InfoTip } from "@/components/info-tip";
import { GROUP_LABELS, GROUP_MEANINGS, METRICS, type MetricGroup } from "@/lib/metrics/definitions";
import { formatMetric } from "@/lib/format";
import type { SectorStat } from "@/lib/data/stocks";
import { sectorName } from "@/lib/sectors";

const GROUPS: MetricGroup[] = ["valuation", "profitability", "growth", "health", "price"];

/** Company vs sector median for every metric, with the within-sector position as a bar. */
export function SectorCompare({
  sector,
  metrics,
  pct,
  stats,
}: {
  sector: string;
  metrics: Record<string, number>;
  pct: Record<string, number>;
  stats: Record<string, SectorStat>;
}) {
  return (
    <section className="glass-card p-5" aria-labelledby="sector-title">
      <h2 id="sector-title" className="font-semibold">Sektör karşılaştırması</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {sectorName(sector)} sektöründeki {stats.market_cap?.n ?? "—"} S&amp;P 500 şirketiyle karşılaştırma. Konum çubuğu sağa doğru uzadıkça hisse
        sektörüne göre daha iyi durumda.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Gösterge</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Hisse</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Sektör medyanı</th>
              <th scope="col" className="w-40 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Sektör içi konum
                  <InfoTip title="Sektör içi konum" align="end">
                    0–100 arası sıra. 80, hissenin bu göstergede sektöründeki şirketlerin %80&apos;inden daha iyi olduğu anlamına
                    gelir. Değerleme ve borçta düşük olan, karlılık ve büyümede yüksek olan daha iyi sayılır.
                  </InfoTip>
                </span>
              </th>
            </tr>
          </thead>
          {GROUPS.map((g) => {
            const defs = METRICS.filter((m) => m.group === g);
            return (
              <tbody key={g} className="num">
                <tr>
                  <th scope="rowgroup" colSpan={4} className="pt-4 pb-1 text-left text-xs font-semibold text-primary-strong">
                    <span className="inline-flex items-center gap-1">
                      {GROUP_LABELS[g]}
                      <InfoTip title={GROUP_LABELS[g]}>{GROUP_MEANINGS[g]}</InfoTip>
                    </span>
                  </th>
                </tr>
                {defs.map((d) => {
                  const p = pct[d.key];
                  return (
                    <tr key={d.key} className="border-t border-outline-soft/40">
                      <th scope="row" className="py-2 pr-4 text-left font-normal">
                        <span className="inline-flex items-center gap-1">
                          <span>
                            {d.short ? `${d.short} ` : ""}
                            <span className={d.short ? "text-ink-muted" : ""}>{d.short ? `(${d.label})` : d.label}</span>
                          </span>
                          <InfoTip title={d.short ? `${d.short} (${d.label})` : d.label} formula={d.help}>{d.meaning}</InfoTip>
                        </span>
                      </th>
                      <td className="py-2 pr-4 text-right font-medium">{formatMetric(metrics[d.key], d.format)}</td>
                      <td className="py-2 pr-4 text-right text-ink-muted">{formatMetric(stats[d.key]?.median, d.format)}</td>
                      <td className="py-2">
                        {p != null ? (
                          <div className="flex items-center gap-2" title={`Sektörün %${Math.round(p * 100)}'inden iyi`}>
                            <div className="h-1.5 flex-1 rounded-full bg-surface-high">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, p * 100)}%` }} />
                            </div>
                            <span className="w-8 text-right text-xs text-ink-muted">{Math.round(p * 100)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}
