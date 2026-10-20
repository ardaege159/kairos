import { InfoTip } from "@/components/info-tip";
import { formatMetric } from "@/lib/format";
import { METRIC_BY_KEY } from "@/lib/metrics/definitions";
import type { SectorStat } from "@/lib/data/stocks";

/** Half-ring gauge: arc up to the stock's value, a tick at the sector median. */
function Gauge({ metric, value, stat, verdict }: { metric: string; value: number | undefined; stat?: SectorStat; verdict: (v: number, m: number) => string }) {
  const d = METRIC_BY_KEY[metric];
  const median = stat?.median ?? null;
  const max = Math.max((median ?? 1) * 2, (value ?? 0) * 1.15, 0.5);
  const frac = value != null ? Math.min(Math.max(value / max, 0), 1) : 0;
  const r = 44, cx = 56, cy = 52;
  const point = (f: number) => [cx - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)] as const;
  const [ex, ey] = point(frac);
  const [mx1, my1] = median != null ? point(Math.min(median / max, 1)) : [0, 0];
  const arc = (to: number) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${to === 1 ? cx + r : point(to)[0]} ${to === 1 ? cy : point(to)[1]}`;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 112 60" className="h-20 w-36 shrink-0" role="img" aria-label={`${d.label} ${formatMetric(value, d.format)}, sektör medyanı ${formatMetric(median, d.format)}`}>
        <path d={arc(1)} fill="none" stroke="var(--color-surface-high)" strokeWidth="9" strokeLinecap="round" />
        {value != null && frac > 0 ? <path d={arc(frac)} fill="none" stroke="var(--color-primary)" strokeWidth="9" strokeLinecap="round" /> : null}
        {value != null ? <circle cx={ex} cy={ey} r="3" fill="#fff" /> : null}
        {median != null ? (
          <line x1={mx1} y1={my1} x2={cx + (mx1 - cx) * 1.28} y2={cy + (my1 - cy) * 1.28} stroke="var(--color-ink)" strokeWidth="2" />
        ) : null}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-ink text-[15px] font-semibold">{formatMetric(value, d.format)}</text>
      </svg>
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1 font-semibold">
          {d.label}
          <InfoTip title={d.label} formula={d.help}>{d.meaning}</InfoTip>
        </p>
        <p className="text-ink-muted">
          {value != null && median != null ? verdict(value, median) : "Şirket bu kalemi raporlamıyor."}
        </p>
        <p className="text-xs text-ink-muted num">Sektör medyanı: {formatMetric(median, d.format)} (siyah çizgi)</p>
      </div>
    </div>
  );
}

export function HealthGauges({ metrics, stats }: { metrics: Record<string, number>; stats: Record<string, SectorStat> }) {
  return (
    <section className="glass-card p-5" aria-labelledby="health-title">
      <h2 id="health-title" className="mb-4 font-semibold">Bilanço sağlığı</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <Gauge
          metric="debt_to_equity"
          value={metrics.debt_to_equity}
          stat={stats.debt_to_equity}
          verdict={(v, m) => (v <= m ? "Borç yükü sektörün tipik şirketinden hafif." : v <= m * 1.5 ? "Borç yükü sektör ortalamasının biraz üstünde." : "Borç yükü sektöre göre belirgin şekilde ağır.")}
        />
        <Gauge
          metric="current_ratio"
          value={metrics.current_ratio}
          stat={stats.current_ratio}
          verdict={(v) => (v >= 1.5 ? "Kısa vadeli borçlarını rahatça karşılayabiliyor." : v >= 1 ? "Kısa vadeli ödeme gücü yeterli ama dar." : "Kısa vadeli borçları dönen varlıklarından fazla; likiditeye dikkat.")}
        />
      </div>
    </section>
  );
}
