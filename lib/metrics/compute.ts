// Pure metric calculations shared by the ingestion job and tests. No I/O here.
import { SCORE_PARTS, type ScorePartKey } from "../score/weights.ts";
import { METRICS } from "./definitions.ts";

export type Quarter = Record<string, number>; // metric -> value for one CY period
export type Fundamentals = Map<string, Quarter>; // "CY2026Q2" -> values
export type Bar = { date: string; close: number; high: number; low: number };
export type Metrics = Record<string, number | null>;

export const periodKey = (y: number, q: number) => `CY${y}Q${q}`;

export function parsePeriod(p: string): { y: number; q: number } {
  const m = /^CY(\d{4})Q([1-4])$/.exec(p);
  if (!m) throw new Error(`bad period ${p}`);
  return { y: Number(m[1]), q: Number(m[2]) };
}

export function shiftPeriod(p: string, quarters: number): string {
  const { y, q } = parsePeriod(p);
  const idx = y * 4 + (q - 1) + quarters;
  return periodKey(Math.floor(idx / 4), (idx % 4) + 1);
}

/** Latest period that has both revenue (or net income) and a balance sheet. */
export function latestPeriod(f: Fundamentals): string | null {
  const ps = [...f.keys()].sort();
  for (let i = ps.length - 1; i >= 0; i--) {
    const v = f.get(ps[i])!;
    if ((v.revenue != null || v.net_income != null) && v.equity != null) return ps[i];
  }
  return null;
}

/** Sum of a flow over the 4 quarters ending at `end` (shifted back `offset` quarters); null if any is missing. */
export function ttm(f: Fundamentals, metric: string, end: string, offset = 0): number | null {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const v = f.get(shiftPeriod(end, -(i + offset)))?.[metric];
    if (v == null) return null;
    sum += v;
  }
  return sum;
}

/** Most recent value of an instant metric at or before `end` (looks back up to 2 quarters). */
function instant(f: Fundamentals, metric: string, end: string): number | null {
  for (let i = 0; i <= 2; i++) {
    const v = f.get(shiftPeriod(end, -i))?.[metric];
    if (v != null) return v;
  }
  return null;
}

const div = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b);
const growth = (now: number | null, before: number | null) =>
  now == null || before == null || before <= 0 ? null : now / before - 1;

export function priceMetrics(bars: Bar[]): Metrics & { price: number | null; change_1d: number | null } {
  const b = [...bars].sort((x, y) => x.date.localeCompare(y.date));
  const last = b.at(-1);
  const back = (n: number) => (b.length > n ? b[b.length - 1 - n].close : null);
  const year = b.slice(-252);
  return {
    price: last?.close ?? null,
    change_1d: last ? growth(last.close, back(1)) : null,
    return_1m: last ? growth(last.close, back(21)) : null,
    return_3m: last ? growth(last.close, back(63)) : null,
    return_1y: last ? growth(last.close, back(252) ?? (b.length >= 200 ? b[0].close : null)) : null,
    high_52w: year.length ? Math.max(...year.map((x) => x.high)) : null,
    low_52w: year.length ? Math.min(...year.map((x) => x.low)) : null,
  };
}

export function fundamentalMetrics(f: Fundamentals, price: number | null): { period: string | null; metrics: Metrics } {
  const period = latestPeriod(f);
  if (!period) return { period: null, metrics: {} };
  const q = f.get(period)!;
  const yearAgo = f.get(shiftPeriod(period, -4));

  const revenue = ttm(f, "revenue", period);
  const netIncome = ttm(f, "net_income", period);
  const operating = ttm(f, "operating_income", period);
  const gross = ttm(f, "gross_profit", period);
  const prevRevenue = ttm(f, "revenue", period, 4);

  const equity = instant(f, "equity", period);
  const assets = instant(f, "assets", period);
  const shares = instant(f, "shares_outstanding", period);
  const debt = instant(f, "long_term_debt", period); // null = not reported, never treat as zero
  const cash = instant(f, "cash", period);
  const marketCap = price != null && shares != null ? price * shares : null;

  return {
    period,
    metrics: {
      market_cap: marketCap,
      pe: netIncome != null && netIncome > 0 ? div(marketCap, netIncome) : null,
      pb: equity != null && equity > 0 ? div(marketCap, equity) : null,
      ps: div(marketCap, revenue),
      ev_sales: marketCap != null && debt != null && cash != null && revenue ? (marketCap + debt - cash) / revenue : null,
      eps_ttm: div(netIncome, shares),
      gross_margin: div(gross, revenue),
      operating_margin: div(operating, revenue),
      net_margin: div(netIncome, revenue),
      roe: equity != null && equity > 0 ? div(netIncome, equity) : null,
      roa: div(netIncome, assets),
      revenue_growth_yoy: growth(q.revenue ?? null, yearAgo?.revenue ?? null),
      net_income_growth_yoy: growth(q.net_income ?? null, yearAgo?.net_income ?? null),
      revenue_growth_ttm: growth(revenue, prevRevenue),
      debt_to_equity: debt != null && equity != null && equity > 0 ? debt / equity : null,
      current_ratio: div(instant(f, "current_assets", period), instant(f, "current_liabilities", period)),
      net_cash: cash != null && debt != null ? cash - debt : null,
    },
  };
}

/** Linear-interpolated quantile of a sorted array. */
export function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Percentile (0..1) of each value within its group, oriented so 1 is always "better". */
export function percentiles(values: Map<string, number>, better: "higher" | "lower"): Map<string, number> {
  const entries = [...values.entries()].sort((a, b) => a[1] - b[1]);
  const out = new Map<string, number>();
  const n = entries.length;
  entries.forEach(([id], idx) => {
    const p = n === 1 ? 0.5 : idx / (n - 1);
    out.set(id, better === "higher" ? p : 1 - p);
  });
  return out;
}

export type ScoreInput = { sectorPct: Record<string, number>; sectorDirection: number | null };

export function kairosScore({ sectorPct, sectorDirection }: ScoreInput) {
  const parts: Partial<Record<ScorePartKey, number>> = {};
  let weighted = 0, weights = 0;
  for (const [key, def] of Object.entries(SCORE_PARTS) as [ScorePartKey, (typeof SCORE_PARTS)[ScorePartKey]][]) {
    if (def.weight === 0) continue;
    let value: number | null = null;
    if (key === "sector") value = sectorDirection;
    else {
      const vals = def.metrics.map((m) => sectorPct[m]).filter((v): v is number => v != null);
      if (vals.length) value = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
    if (value == null) continue;
    parts[key] = Math.round(value * 100);
    weighted += value * def.weight;
    weights += def.weight;
  }
  return { score: weights ? Math.round((weighted / weights) * 100) : null, parts };
}

export const SCORED_METRICS = METRICS.filter((m) => m.better != null);
