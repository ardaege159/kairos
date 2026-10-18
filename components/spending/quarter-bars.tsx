import { money } from "@/lib/spending/explain";
import { fqLabel } from "@/lib/spending/trends";

type Q = { fy: number; q: number; amount: number };

/**
 * Fiscal-quarter bars. The last `pending` quarters are drawn lighter: DoD and some agencies report
 * with a ~90-day lag, so the most recent quarters are still filling in.
 */
export function QuarterBars({ quarters, height = 56, pending = 1, labels = false }: { quarters: Q[]; height?: number; pending?: number; labels?: boolean }) {
  if (!quarters.length) return null;
  const max = Math.max(...quarters.map((x) => x.amount), 1);
  const label = quarters.map((x) => `${fqLabel(x.fy, x.q)}: ${money(x.amount)}`).join(", ");
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label={`Çeyreklik federal harcama. ${label}`}>
        {quarters.map((x, i) => {
          const late = i >= quarters.length - pending;
          return (
            <span key={`${x.fy}-${x.q}`} title={`${fqLabel(x.fy, x.q)}: ${money(x.amount)}${late ? " (raporlama sürüyor)" : ""}`}
              className={`flex-1 rounded-t-sm ${late ? "bg-primary/30" : x.q === 1 ? "bg-secondary" : "bg-primary"}`}
              style={{ height: `${Math.max(3, (x.amount / max) * 100)}%` }} />
          );
        })}
      </div>
      {labels ? (
        <div className="mt-1 flex gap-[3px] text-[10px] text-ink-muted num" aria-hidden>
          {quarters.map((x) => <span key={`${x.fy}-${x.q}`} className="flex-1 truncate text-center">{x.q === 1 ? `MY${String(x.fy).slice(2)}` : ""}</span>)}
        </div>
      ) : null}
    </div>
  );
}

export function GrowthBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-ink-muted">—</span>;
  const up = value >= 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold num ${up ? "bg-gain-soft/50 text-gain" : "bg-loss-soft/70 text-loss"}`}>
      {up ? "+" : "−"}%{Math.round(Math.abs(value) * 100).toLocaleString("tr-TR")}
    </span>
  );
}
