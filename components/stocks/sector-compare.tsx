import { InfoTip } from "@/components/info-tip";
import { GROUP_LABELS, GROUP_MEANINGS, METRICS, type MetricDef, type MetricGroup } from "@/lib/metrics/definitions";
import { formatMetric } from "@/lib/format";
import type { SectorStat } from "@/lib/data/stocks";
import { sectorName } from "@/lib/sectors";

const GROUPS: MetricGroup[] = ["valuation", "profitability", "growth", "health", "price"];

/**
 * Bullet strip: the sector's middle half (25th–75th percentile) as a band, its median as a tick and
 * the stock as a dot. Values outside the visible range are pinned to the edge with an arrow.
 */
function Strip({ value, stat, def }: { value: number | undefined; stat?: SectorStat; def: MetricDef }) {
  if (value == null || !stat || stat.p25 == null || stat.p75 == null || stat.median == null) {
    return <div className="h-6 text-xs leading-6 text-ink-muted">Karşılaştırma yok</div>;
  }
  const iqr = Math.max(stat.p75 - stat.p25, Math.abs(stat.median) * 0.1, 1e-9);
  const lo = stat.p25 - iqr * 1.5;
  const hi = stat.p75 + iqr * 1.5;
  const pos = (v: number) => ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  const clipped = value < lo ? "left" : value > hi ? "right" : null;
  const better = def.better === "lower" ? value <= stat.median : value >= stat.median;
  const label = `${def.short ?? def.label}: hisse ${formatMetric(value, def.format)}, sektör medyanı ${formatMetric(stat.median, def.format)}, sektörün orta yarısı ${formatMetric(stat.p25, def.format)} – ${formatMetric(stat.p75, def.format)}`;
  return (
    <div className="relative h-6" role="img" aria-label={label} title={label}>
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-surface-high" />
      <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-primary-soft" style={{ left: `${pos(stat.p25)}%`, width: `${pos(stat.p75) - pos(stat.p25)}%` }} />
      <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-outline" style={{ left: `${pos(stat.median)}%` }} />
      <div
        className={`absolute top-1/2 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[8px] leading-none text-white shadow ${
          def.better == null || better ? "bg-primary" : "bg-secondary"
        }`}
        style={{ left: `${pos(value)}%` }}
      >
        {clipped === "left" ? "‹" : clipped === "right" ? "›" : null}
      </div>
    </div>
  );
}

export function SectorCompare({
  sector,
  metrics,
  pct,
  stats,
}: {
  sector: string | null;
  metrics: Record<string, number>;
  pct: Record<string, number>;
  stats: Record<string, SectorStat>;
}) {
  return (
    <section className="glass-card p-5" aria-labelledby="sector-title">
      <h2 id="sector-title" className="flex items-center gap-1 font-semibold">
        Sektör karşılaştırması
        <InfoTip title="Bu grafik nasıl okunur?">
          Açık mor bant, sektördeki S&amp;P 500 şirketlerinin ortadaki yarısıdır (tipik aralık). Gri çizgi sektör medyanı,
          nokta ise bu hissedir. Nokta koyu mavi ise hisse o göstergede sektör medyanından daha iyi, mor ise daha zayıf
          durumda. Sağdaki sayı sektör içindeki sırasıdır (100 = en iyi).
        </InfoTip>
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {sectorName(sector)} sektöründeki {stats.market_cap?.n ?? "—"} S&amp;P 500 şirketiyle karşılaştırma.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full bg-primary-soft" aria-hidden /> Sektörün tipik aralığı</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-outline" aria-hidden /> Sektör medyanı</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary" aria-hidden /> Hisse, medyandan iyi</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-secondary" aria-hidden /> Hisse, medyandan zayıf</span>
      </div>
      <div className="mt-4 grid gap-x-10 gap-y-6 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g}>
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-primary-strong">
              {GROUP_LABELS[g]}
              <InfoTip title={GROUP_LABELS[g]}>{GROUP_MEANINGS[g]}</InfoTip>
            </h3>
            <ul className="space-y-2.5">
              {METRICS.filter((d) => d.group === g && d.key !== "market_cap").map((d) => {
                const p = pct[d.key];
                return (
                  <li key={d.key} className="grid grid-cols-[minmax(0,9rem)_4.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate">{d.short ?? d.label}</span>
                      <InfoTip title={d.short ? `${d.short} (${d.label})` : d.label} formula={d.help}>{d.meaning}</InfoTip>
                    </span>
                    <span className="text-right font-medium num">{formatMetric(metrics[d.key], d.format)}</span>
                    <Strip value={metrics[d.key]} stat={stats[d.key]} def={d} />
                    <span className="text-right text-xs text-ink-muted num" title="Sektör içi sıra (100 = en iyi)">
                      {p != null ? Math.round(p * 100) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
