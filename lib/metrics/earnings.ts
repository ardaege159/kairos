// Earnings surprise summary over the last reported quarters. Pure (tested).

export type EarningsRow = { fiscal_date_ending: string; reported_date: string | null; reported_eps: number | null; estimated_eps: number | null; surprise_pct: number | null };

/**
 * Surprise % only when the estimate is far enough from zero to divide by: Intel beating a $0.01
 * estimate by $0.28 is "+2,800%", which says nothing. Those quarters still count as beats or misses.
 */
export function surprisePct(r: EarningsRow): number | null {
  return r.estimated_eps != null && Math.abs(r.estimated_eps) >= 0.1 ? r.surprise_pct : null;
}

/** Beats/misses over the last `n` reported quarters (newest first in `rows` or not; sorted here). */
export function surpriseSummary(rows: EarningsRow[], n = 8) {
  const recent = rows
    .filter((r) => r.reported_eps != null && r.estimated_eps != null)
    .sort((a, b) => b.fiscal_date_ending.localeCompare(a.fiscal_date_ending))
    .slice(0, n);
  const beats = recent.filter((r) => r.reported_eps! > r.estimated_eps!).length;
  const misses = recent.filter((r) => r.reported_eps! < r.estimated_eps!).length;
  // Median, so one outsized quarter does not set the "typical" surprise.
  const pcts = recent.map(surprisePct).filter((v): v is number => v != null).sort((a, b) => a - b);
  const mid = Math.floor(pcts.length / 2);
  const lastFour = recent.slice(0, 4);
  return {
    quarters: recent.length, beats, misses,
    avgSurprise: pcts.length ? (pcts.length % 2 ? pcts[mid] : (pcts[mid - 1] + pcts[mid]) / 2) : null,
    recentMisses: lastFour.filter((r) => r.reported_eps! < r.estimated_eps!).length,
    last: recent[0] ?? null,
  };
}
