import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";

export type StockRow = {
  ticker: string;
  name: string;
  sector: string;
  sub_industry: string | null;
  cik: number;
  in_sp500: boolean;
  price: number | null;
  change_1d: number | null;
  as_of: string | null;
  latest_period: string | null;
  metrics: Record<string, number>;
  sector_pct: Record<string, number>;
  score: number | null;
  score_parts: Record<string, number>;
};

export type SectorStat = { metric: string; median: number | null; p25: number | null; p75: number | null; n: number };
export type QuarterRow = { period: string; period_end: string; values: Record<string, number> };
export type PricePoint = { date: string; close: number };

/** All reads go through the owner check first; RLS enforces the same rule in the database. */
async function db() {
  // Per-user data: always render at request time (the Supabase client reads the clock while checking the session).
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  return createClient();
}

type Joined = {
  ticker: string; name: string; sector: string; sub_industry: string | null; cik: number; in_sp500: boolean;
  stock_metrics: Omit<StockRow, "ticker" | "name" | "sector" | "sub_industry" | "cik" | "in_sp500"> | null;
};

function flatten(r: Joined): StockRow {
  const m = r.stock_metrics;
  return {
    ticker: r.ticker, name: r.name, sector: r.sector, sub_industry: r.sub_industry, cik: r.cik, in_sp500: r.in_sp500,
    price: m?.price != null ? Number(m.price) : null,
    change_1d: m?.change_1d != null ? Number(m.change_1d) : null,
    as_of: m?.as_of ?? null, latest_period: m?.latest_period ?? null,
    metrics: m?.metrics ?? {}, sector_pct: m?.sector_pct ?? {},
    score: m?.score != null ? Number(m.score) : null, score_parts: m?.score_parts ?? {},
  };
}

const STOCK_SELECT =
  "ticker,name,sector,sub_industry,cik,in_sp500,stock_metrics(price,change_1d,as_of,latest_period,metrics,sector_pct,score,score_parts)";

export async function listStocks(): Promise<StockRow[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("companies").select(STOCK_SELECT).order("ticker");
  if (error) throw error;
  return (data as unknown as Joined[]).map(flatten);
}

export async function getStock(ticker: string): Promise<StockRow | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("companies").select(STOCK_SELECT).eq("ticker", ticker.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data ? flatten(data as unknown as Joined) : null;
}

export async function getSectorStats(sector: string): Promise<Record<string, SectorStat>> {
  const supabase = await db();
  const { data, error } = await supabase.from("sector_stats").select("metric,median,p25,p75,n").eq("sector", sector);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((s) => [s.metric, { ...s, median: s.median == null ? null : Number(s.median), p25: s.p25 == null ? null : Number(s.p25), p75: s.p75 == null ? null : Number(s.p75) }]),
  );
}

/** sector -> metric -> distribution, for every sector. */
export async function getAllSectorStats(): Promise<Record<string, Record<string, SectorStat>>> {
  const supabase = await db();
  const { data, error } = await supabase.from("sector_stats").select("sector,metric,median,p25,p75,n");
  if (error) throw error;
  const out: Record<string, Record<string, SectorStat>> = {};
  for (const s of data ?? []) {
    (out[s.sector] ??= {})[s.metric] = {
      metric: s.metric, n: s.n,
      median: s.median == null ? null : Number(s.median),
      p25: s.p25 == null ? null : Number(s.p25),
      p75: s.p75 == null ? null : Number(s.p75),
    };
  }
  return out;
}

export async function getQuarters(cik: number): Promise<QuarterRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("fundamentals_quarterly")
    .select("period,period_end,metric,value")
    .eq("cik", cik)
    .order("period");
  if (error) throw error;
  const by = new Map<string, QuarterRow>();
  for (const r of (data ?? []) as { period: string; period_end: string; metric: string; value: number }[]) {
    const q: QuarterRow = by.get(r.period) ?? { period: r.period, period_end: r.period_end, values: {} };
    q.values[r.metric] = Number(r.value);
    by.set(r.period, q);
  }
  return [...by.values()];
}

export async function getPrices(ticker: string): Promise<PricePoint[]> {
  const supabase = await db();
  // Last ~1 year of trading days; avoids Date.now(), which Cache Components flags during prerender.
  const { data, error } = await supabase
    .from("prices_daily")
    .select("date,close")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(260);
  if (error) throw error;
  return (data ?? []).reverse().map((p) => ({ date: p.date, close: Number(p.close) }));
}
