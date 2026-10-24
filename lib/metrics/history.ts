// Valuation multiples through time: at each quarter end, the price then over the trailing figures
// known at that quarter (no look-ahead). Pure (tested).
import { instant, latestPeriod, sharesAt, ttm, type Fundamentals } from "./compute.ts";

export type ValuationPoint = { date: string; pe: number | null; ps: number | null; pb: number | null };
type Close = { date: string; close: number };

function closeOn(prices: Close[], date: string): number | null {
  let hit: number | null = null;
  for (const p of prices) {
    if (p.date > date) break;
    hit = p.close;
  }
  return hit;
}

/**
 * One point per quarter that has a full trailing year (plus `latest` as of today with the newest
 * quarter's figures). Multiples on losses or negative equity are null.
 */
export function valuationHistory(f: Fundamentals, periodEnds: Record<string, string>, prices: Close[], latest?: { date: string; price: number }): ValuationPoint[] {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const periods = [...f.keys()].sort();
  const point = (period: string, date: string, price: number | null): ValuationPoint | null => {
    // Same share count and balance-sheet lookback as the current metrics, so today's point matches the
    // multiple shown on the page.
    const shares = sharesAt(f, period);
    if (price == null || !shares) return null;
    const cap = price * shares;
    const ni = ttm(f, "net_income", period), rev = ttm(f, "revenue", period);
    const eq = instant(f, "equity", period);
    const pe = ni != null && ni > 0 ? cap / ni : null;
    const ps = rev != null && rev > 0 && (ni == null || ni <= rev) ? cap / rev : null;
    const pb = eq != null && eq > 0 ? cap / eq : null;
    return pe == null && ps == null && pb == null ? null : { date, pe, ps, pb };
  };
  const out: ValuationPoint[] = [];
  for (const p of periods) {
    const end = periodEnds[p];
    if (!end || !sorted.length || end < sorted[0].date) continue;
    const pt = point(p, end, closeOn(sorted, end));
    if (pt) out.push(pt);
  }
  const current = latestPeriod(f);
  if (latest && current) {
    const pt = point(current, latest.date, latest.price);
    if (pt && (!out.length || pt.date > out.at(-1)!.date)) out.push(pt);
  }
  return out;
}

/** Median of the non-null values; null if fewer than 3. */
export function median(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (v.length < 3) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
