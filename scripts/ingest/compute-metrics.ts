// Rebuild public.stock_metrics and public.sector_stats from fundamentals + prices.
//   node --env-file=.env.local scripts/ingest/compute-metrics.ts
// Runs with Node's built-in TypeScript type stripping (Node 23.6+).
import { createClient } from "@supabase/supabase-js";
import {
  SCORED_METRICS,
  fundamentalMetrics,
  kairosScore,
  percentiles,
  priceMetrics,
  quantile,
  type Bar,
  type Fundamentals,
  type Metrics,
} from "../../lib/metrics/compute.ts";
import { METRICS } from "../../lib/metrics/definitions.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST builder generics are untyped without generated DB types
type Query = any;
async function selectAll<T>(table: string, columns: string, filter?: (q: Query) => Query): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const { data: run } = await db.from("ingest_runs").insert({ source: "compute_metrics" }).select("id").single();
try {
  const companies = await selectAll<{ ticker: string; cik: number; sector: string }>("companies", "ticker,cik,sector");
  const facts = await selectAll<{ cik: number; period: string; metric: string; value: number }>(
    "fundamentals_quarterly", "cik,period,metric,value", (q) => q.order("cik").order("period").order("metric"));
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const prices = await selectAll<{ ticker: string; date: string; close: number; high: number; low: number }>(
    "prices_daily", "ticker,date,close,high,low", (q) => q.gte("date", since).order("ticker").order("date"));

  const fundamentals = new Map<number, Fundamentals>();
  for (const r of facts) {
    const f = fundamentals.get(r.cik) ?? new Map();
    const q = f.get(r.period) ?? {};
    q[r.metric] = Number(r.value);
    f.set(r.period, q);
    fundamentals.set(r.cik, f);
  }
  const bars = new Map<string, Bar[]>();
  for (const p of prices) {
    const list = bars.get(p.ticker) ?? [];
    list.push({ date: p.date, close: Number(p.close), high: Number(p.high), low: Number(p.low) });
    bars.set(p.ticker, list);
  }

  type Row = { ticker: string; sector: string; asOf: string | null; period: string | null; price: number | null; change1d: number | null; metrics: Metrics };
  const rows: Row[] = companies.map((c) => {
    const b = bars.get(c.ticker) ?? [];
    const { price, change_1d, ...pm } = priceMetrics(b);
    const { period, metrics: fm } = fundamentalMetrics(fundamentals.get(c.cik) ?? new Map(), price);
    return { ticker: c.ticker, sector: c.sector, asOf: b.at(-1)?.date ?? null, period, price, change1d: change_1d, metrics: { ...fm, ...pm } };
  });

  // Sector distributions and within-sector percentiles.
  const sectors = [...new Set(rows.map((r) => r.sector))];
  const sectorStats: { sector: string; metric: string; median: number | null; p25: number | null; p75: number | null; n: number }[] = [];
  const pct = new Map<string, Record<string, number>>(rows.map((r) => [r.ticker, {}]));
  for (const sector of sectors) {
    const inSector = rows.filter((r) => r.sector === sector);
    for (const def of METRICS) {
      const vals = new Map<string, number>();
      for (const r of inSector) {
        const v = r.metrics[def.key];
        if (v != null && Number.isFinite(v)) vals.set(r.ticker, v);
      }
      const sorted = [...vals.values()].sort((a, b) => a - b);
      sectorStats.push({ sector, metric: def.key, median: quantile(sorted, 0.5), p25: quantile(sorted, 0.25), p75: quantile(sorted, 0.75), n: sorted.length });
      if (def.better && vals.size >= 3) for (const [t, p] of percentiles(vals, def.better)) pct.get(t)![def.key] = p;
    }
  }
  // Sector direction: each sector's median 3-month return, ranked across sectors.
  const sectorMomentum = new Map(sectors.map((s) => [s, sectorStats.find((x) => x.sector === s && x.metric === "return_3m")?.median ?? null] as const));
  const direction = percentiles(new Map([...sectorMomentum].filter((e): e is [string, number] => e[1] != null)), "higher");

  const now = new Date().toISOString();
  const metricRows = rows.filter((r) => r.asOf).map((r) => {
    const s = kairosScore({ sectorPct: pct.get(r.ticker)!, sectorDirection: direction.get(r.sector) ?? null });
    const clean = Object.fromEntries(Object.entries(r.metrics).filter(([, v]) => v != null && Number.isFinite(v)));
    return { ticker: r.ticker, as_of: r.asOf, latest_period: r.period, price: r.price, change_1d: r.change1d, metrics: clean,
      sector_pct: pct.get(r.ticker), score: s.score, score_parts: s.parts, updated_at: now };
  });

  for (let i = 0; i < metricRows.length; i += 500) {
    const { error } = await db.from("stock_metrics").upsert(metricRows.slice(i, i + 500), { onConflict: "ticker" });
    if (error) throw error;
  }
  const { error: se } = await db.from("sector_stats").upsert(sectorStats.map((s) => ({ ...s, updated_at: now })), { onConflict: "sector,metric" });
  if (se) throw se;

  const scored = metricRows.filter((r) => r.score != null);
  const detail = {
    tickers: metricRows.length, scored: scored.length, scoredMetrics: SCORED_METRICS.length,
    coverage: Object.fromEntries(METRICS.map((m) => [m.key, metricRows.filter((r) => (r.metrics as Metrics)[m.key] != null).length])),
  };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
