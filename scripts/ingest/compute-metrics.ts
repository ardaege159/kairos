// Rebuild public.stock_metrics and public.sector_stats for the whole universe.
//   node --env-file=.env.local scripts/ingest/compute-metrics.ts
// Core tickers read their bars from prices_daily; all other tickers get one year of daily bars from
// Alpaca in memory (not stored, to stay inside the free database size).
import { createClient } from "@supabase/supabase-js";
import {
  SCORED_METRICS,
  fundamentalMetrics,
  kairosScore,
  percentileOf,
  percentiles,
  priceMetrics,
  quantile,
  type Bar,
  type Fundamentals,
  type Metrics,
} from "../../lib/metrics/compute.ts";
import { METRICS } from "../../lib/metrics/definitions.ts";

const { NEXT_PUBLIC_SUPABASE_URL: url, ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret || !ALPACA_API_KEY_ID || !ALPACA_API_SECRET_KEY) {
  console.error("Supabase ve Alpaca anahtarları gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const alpacaHeaders = { "APCA-API-KEY-ID": ALPACA_API_KEY_ID.trim(), "APCA-API-SECRET-KEY": ALPACA_API_SECRET_KEY.trim() };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function alpacaBars(symbols: string[], start: string, end: string): Promise<Map<string, Bar[]>> {
  const out = new Map<string, Bar[]>();
  let page: string | undefined;
  do {
    const u = new URL("https://data.alpaca.markets/v2/stocks/bars");
    u.search = new URLSearchParams({ symbols: symbols.join(","), timeframe: "1Day", start, end, limit: "10000", feed: "sip",
      adjustment: "split", ...(page ? { page_token: page } : {}) }).toString();
    let j: { bars?: Record<string, { t: string; c: number; h: number; l: number }[]>; next_page_token?: string } | null = null;
    for (let attempt = 1; attempt <= 4 && !j; attempt++) {
      const r = await fetch(u, { headers: alpacaHeaders });
      if (r.ok) j = await r.json();
      else if (r.status !== 429 && r.status < 500) throw new Error(`Alpaca HTTP ${r.status}`);
      else await sleep(1500 * attempt);
    }
    if (!j) throw new Error("Alpaca: tekrar denemeler tükendi");
    for (const [s, list] of Object.entries(j.bars ?? {})) {
      const arr = out.get(s) ?? [];
      for (const b of list) arr.push({ date: b.t.slice(0, 10), close: b.c, high: b.h, low: b.l });
      out.set(s, arr);
    }
    page = j.next_page_token ?? undefined;
  } while (page);
  return out;
}

type Company = { ticker: string; cik: number | null; sector: string | null; in_sp500: boolean; core: boolean; asset_type: "stock" | "etf" };

const { data: run } = await db.from("ingest_runs").insert({ source: "compute_metrics" }).select("id").single();
try {
  const companies = await selectAll<Company>("companies", "ticker,cik,sector,in_sp500,core,asset_type");
  const facts = await selectAll<{ cik: number; period: string; values: Record<string, number> }>(
    "fundamentals_q", "cik,period,values", (q) => q.order("cik").order("period"));
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const corePrices = await selectAll<{ ticker: string; date: string; close: number; high: number; low: number }>(
    "prices_daily", "ticker,date,close,high,low", (q) => q.gte("date", since).order("ticker").order("date"));

  // News tone: average Marketaux sentiment over the last 30 days, strong mentions only, at least 2 articles.
  const newsSince = new Date(Date.now() - 30 * 864e5).toISOString();
  const newsLinks = await selectAll<{ ticker: string; sentiment: number | null; match_score: number | null }>(
    "news_tickers", "ticker,sentiment,match_score,news_items!inner(published_at)",
    (q) => q.gte("news_items.published_at", newsSince).not("sentiment", "is", null).gte("match_score", 10));
  const newsAgg = new Map<string, { sum: number; n: number }>();
  for (const l of newsLinks) {
    const a = newsAgg.get(l.ticker) ?? { sum: 0, n: 0 };
    a.sum += Number(l.sentiment);
    a.n += 1;
    newsAgg.set(l.ticker, a);
  }

  const fundamentals = new Map<number, Fundamentals>();
  for (const r of facts) {
    const f = fundamentals.get(r.cik) ?? new Map();
    f.set(r.period, Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, Number(v)])));
    fundamentals.set(r.cik, f);
  }
  const bars = new Map<string, Bar[]>();
  for (const p of corePrices) {
    const list = bars.get(p.ticker) ?? [];
    list.push({ date: p.date, close: Number(p.close), high: Number(p.high), low: Number(p.low) });
    bars.set(p.ticker, list);
  }

  const broad = companies.filter((c) => !c.core).map((c) => c.ticker);
  const start = new Date(Date.now() - 380 * 864e5).toISOString();
  const end = new Date(Date.now() - 20 * 60e3).toISOString();
  for (let i = 0; i < broad.length; i += 100) {
    for (const [s, list] of await alpacaBars(broad.slice(i, i + 100), start, end)) bars.set(s, list);
    if ((i / 100) % 20 === 19) console.log(`  fiyat ${Math.min(i + 100, broad.length)}/${broad.length}`);
  }

  type Row = { c: Company; asOf: string | null; period: string | null; price: number | null; change1d: number | null; metrics: Metrics };
  const rows: Row[] = companies.map((c) => {
    const b = bars.get(c.ticker) ?? [];
    const { price, change_1d, ...pm } = priceMetrics(b);
    const { period, metrics: fm } =
      c.asset_type === "stock" && c.cik ? fundamentalMetrics(fundamentals.get(c.cik) ?? new Map(), price) : { period: null, metrics: {} };
    const news = newsAgg.get(c.ticker);
    const newsMetrics: Metrics = news && news.n >= 2 ? { news_sentiment: news.sum / news.n, news_count: news.n } : {};
    return { c, asOf: b.at(-1)?.date ?? null, period, price, change1d: change_1d, metrics: { ...fm, ...pm, ...newsMetrics } };
  });

  // Sector distributions come from S&P 500 members only; every other stock is placed within them.
  const sectors = [...new Set(rows.filter((r) => r.c.in_sp500 && r.c.sector).map((r) => r.c.sector!))];
  const sectorStats: { sector: string; metric: string; median: number | null; p25: number | null; p75: number | null; n: number }[] = [];
  const pct = new Map<string, Record<string, number>>(rows.map((r) => [r.c.ticker, {}]));
  for (const sector of sectors) {
    const members = rows.filter((r) => r.c.sector === sector && r.c.in_sp500);
    const others = rows.filter((r) => r.c.sector === sector && !r.c.in_sp500 && r.c.asset_type === "stock");
    for (const def of METRICS) {
      const vals = new Map<string, number>();
      for (const r of members) {
        const v = r.metrics[def.key];
        if (v != null && Number.isFinite(v)) vals.set(r.c.ticker, v);
      }
      const sorted = [...vals.values()].sort((a, b) => a - b);
      sectorStats.push({ sector, metric: def.key, median: quantile(sorted, 0.5), p25: quantile(sorted, 0.25), p75: quantile(sorted, 0.75), n: sorted.length });
      if (!def.better || vals.size < 3) continue;
      for (const [t, p] of percentiles(vals, def.better)) pct.get(t)![def.key] = p;
      for (const r of others) {
        const v = r.metrics[def.key];
        const p = v != null && Number.isFinite(v) ? percentileOf(sorted, v, def.better) : null;
        if (p != null) pct.get(r.c.ticker)![def.key] = p;
      }
    }
  }
  // News tone is sparse, so rank it among every stock in the sector that has enough coverage.
  for (const sector of sectors) {
    const vals = new Map<string, number>();
    for (const r of rows) if (r.c.sector === sector && r.metrics.news_sentiment != null) vals.set(r.c.ticker, r.metrics.news_sentiment);
    if (vals.size >= 3) for (const [t, p] of percentiles(vals, "higher")) pct.get(t)!.news_sentiment = p;
  }
  const sectorMomentum = new Map(sectors.map((s) => [s, sectorStats.find((x) => x.sector === s && x.metric === "return_3m")?.median ?? null] as const));
  const direction = percentiles(new Map([...sectorMomentum].filter((e): e is [string, number] => e[1] != null)), "higher");

  const now = new Date().toISOString();
  const num = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : null);
  const metricRows = rows.filter((r) => r.asOf).map((r) => {
    const scored = r.c.asset_type === "stock" && r.c.sector != null;
    const s = scored ? kairosScore({ sectorPct: pct.get(r.c.ticker)!, sectorDirection: direction.get(r.c.sector!) ?? null }) : { score: null, parts: {} };
    const clean = Object.fromEntries(Object.entries(r.metrics).filter(([, v]) => v != null && Number.isFinite(v)));
    return {
      ticker: r.c.ticker, as_of: r.asOf, latest_period: r.period, price: r.price, change_1d: r.change1d, metrics: clean,
      sector_pct: pct.get(r.c.ticker), score: s.score, score_parts: s.parts, updated_at: now,
      market_cap: num(r.metrics.market_cap), pe: num(r.metrics.pe), pb: num(r.metrics.pb), return_1y: num(r.metrics.return_1y),
    };
  });

  for (let i = 0; i < metricRows.length; i += 500) {
    const { error } = await db.from("stock_metrics").upsert(metricRows.slice(i, i + 500), { onConflict: "ticker" });
    if (error) throw error;
  }
  const { error: se } = await db.from("sector_stats").upsert(sectorStats.map((s) => ({ ...s, updated_at: now })), { onConflict: "sector,metric" });
  if (se) throw se;

  const detail = {
    tickers: metricRows.length, withoutPrice: rows.length - metricRows.length, scored: metricRows.filter((r) => r.score != null).length,
    scoredMetrics: SCORED_METRICS.length,
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
