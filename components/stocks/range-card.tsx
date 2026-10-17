import { InfoTip } from "@/components/info-tip";
import { formatPercent, formatPrice } from "@/lib/format";

/** 52-week low–high bar with today's price, plus 1M/3M/1Y return bars. */
export function RangeCard({ price, metrics }: { price: number | null; metrics: Record<string, number> }) {
  const lo = metrics.low_52w, hi = metrics.high_52w;
  const pos = price != null && lo != null && hi != null && hi > lo ? ((price - lo) / (hi - lo)) * 100 : null;
  const returns = [
    { label: "1 ay", v: metrics.return_1m },
    { label: "3 ay", v: metrics.return_3m },
    { label: "1 yıl", v: metrics.return_1y },
  ];
  const maxAbs = Math.max(0.05, ...returns.map((r) => Math.abs(r.v ?? 0)));
  return (
    <section className="glass-card p-5" aria-labelledby="range-title">
      <h2 id="range-title" className="flex items-center gap-1 font-semibold">
        Fiyat performansı
        <InfoTip title="52 haftalık aralık">
          Çubuk, hissenin son bir yıldaki en düşük ve en yüksek fiyatı arasındaki aralıktır; nokta bugünkü fiyattır. Sağa
          yakınsa hisse zirvesine yakın, sola yakınsa dibine yakın işlem görüyor.
        </InfoTip>
      </h2>
      {pos != null ? (
        <div className="mt-4">
          <div className="relative h-2 rounded-full bg-gradient-to-r from-secondary/30 via-surface-high to-primary/40">
            <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow" style={{ left: `${pos}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-muted num">
            <span>En düşük {formatPrice(lo)}</span>
            <span>En yüksek {formatPrice(hi)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-muted num">Zirveden uzaklık: {formatPercent(price! / hi - 1)}</p>
        </div>
      ) : null}
      <ul className="mt-5 space-y-2" aria-label="Getiriler">
        {returns.map((r) => (
          <li key={r.label} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-3 text-sm">
            <span className="text-ink-muted">{r.label}</span>
            <div className="relative h-2.5">
              <div className="absolute top-0 left-1/2 h-full w-px bg-outline-soft" />
              {r.v != null ? (
                <div
                  className={`absolute top-0 h-full rounded-full ${r.v >= 0 ? "bg-gain" : "bg-loss"}`}
                  style={r.v >= 0 ? { left: "50%", width: `${(r.v / maxAbs) * 50}%` } : { right: "50%", width: `${(-r.v / maxAbs) * 50}%` }}
                />
              ) : null}
            </div>
            <span className={`text-right num ${r.v == null ? "text-ink-muted" : r.v >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(r.v, true)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
