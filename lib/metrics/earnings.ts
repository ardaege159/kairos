// Earnings surprise summary over the last reported quarters. Pure (tested).

export type EarningsRow = { fiscal_date_ending: string; reported_date: string | null; reported_eps: number | null; estimated_eps: number | null; surprise_pct: number | null };

/** Beats/misses over the last `n` reported quarters (newest first in `rows` or not; sorted here). */
export function surpriseSummary(rows: EarningsRow[], n = 8) {
  const recent = rows
    .filter((r) => r.reported_eps != null && r.estimated_eps != null)
    .sort((a, b) => b.fiscal_date_ending.localeCompare(a.fiscal_date_ending))
    .slice(0, n);
  const beats = recent.filter((r) => r.reported_eps! > r.estimated_eps!).length;
  const misses = recent.filter((r) => r.reported_eps! < r.estimated_eps!).length;
  const pcts = recent.map((r) => r.surprise_pct).filter((v): v is number => v != null);
  const lastFour = recent.slice(0, 4);
  return {
    quarters: recent.length, beats, misses,
    avgSurprise: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    recentMisses: lastFour.filter((r) => r.reported_eps! < r.estimated_eps!).length,
    last: recent[0] ?? null,
  };
}
