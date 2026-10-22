import { quarterLabel } from "@/components/investors/bits";

type Point = { period: string; r: number; bench: number };
const pct = (v: number, signed = false) => {
  const n = Math.round(v * 100);
  return n === 0 ? "%0" : `${signed && n > 0 ? "+" : n < 0 ? "−" : ""}%${Math.abs(n)}`;
};

/** Growth of $1: 1, then the running product of (1 + r). */
function cumulative(rs: number[]): number[] {
  const out = [1];
  for (const r of rs) out.push(out[out.length - 1] * (1 + r));
  return out;
}

/** Growth of $1 through the quarters for the fund (indigo) and SPY (grey), from the same 13F method. */
export function GrowthLines({ series, height = 48, width = 160 }: { series: Point[]; height?: number; width?: number }) {
  if (series.length < 2) return null;
  const fund = cumulative(series.map((s) => s.r));
  const bench = cumulative(series.map((s) => s.bench));
  const max = Math.max(...fund, ...bench), min = Math.min(...fund, ...bench);
  const y = (v: number) => (height - 3 - ((v - min) / (max - min || 1)) * (height - 6)).toFixed(1);
  const pts = (xs: number[]) => xs.map((v, i) => `${((i / (xs.length - 1)) * width).toFixed(1)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts(bench)} fill="none" stroke="var(--color-outline)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      <polyline points={pts(fund)} fill="none" stroke="var(--color-primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Quarter-by-quarter returns of the fund next to SPY, as paired bars around a zero line. */
export function QuarterPairs({ series }: { series: Point[] }) {
  const max = Math.max(0.05, ...series.flatMap((s) => [Math.abs(s.r), Math.abs(s.bench)]));
  const bar = (v: number, cls: string) => (
    <div className="flex h-24 w-3 flex-col">
      <div className="flex flex-1 items-end">{v >= 0 ? <span className={`w-full rounded-t-sm ${cls}`} style={{ height: `${(v / max) * 100}%` }} /> : null}</div>
      <div className="flex flex-1 items-start">{v < 0 ? <span className={`w-full rounded-b-sm ${cls}`} style={{ height: `${(-v / max) * 100}%` }} /> : null}</div>
    </div>
  );
  return (
    <div>
      <div className="flex items-stretch justify-between gap-2 border-y border-transparent" role="img"
        aria-label={series.map((s) => `${quarterLabel(s.period)}: fon ${pct(s.r, true)}, S&P 500 ${pct(s.bench, true)}`).join("; ")}>
        {series.map((s) => (
          <div key={s.period} className="flex flex-1 flex-col items-center">
            <div className="relative flex gap-0.5">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-outline-soft" />
              {bar(s.r, s.r >= s.bench ? "bg-primary" : "bg-primary/45")}
              {bar(s.bench, "bg-outline/50")}
            </div>
            <span className={`mt-1 text-[11px] font-semibold num ${Math.abs(s.r) < 0.005 ? "text-ink-muted" : s.r > 0 ? "text-gain" : "text-loss"}`}>{pct(s.r, true)}</span>
            <span className="text-[10px] text-ink-muted">{s.period.slice(2, 4)}/{Math.floor((Number(s.period.slice(5, 7)) - 1) / 3) + 1}Ç</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" /> Fon</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-outline/50" /> S&amp;P 500 (SPY)</span>
      </p>
    </div>
  );
}
