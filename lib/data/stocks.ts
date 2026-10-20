import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import { ETF_CATEGORIES, pgPattern } from "@/lib/etf";
import { filterPath, type Range } from "@/lib/screener";
import { alpacaDailyCloses, type PricePoint } from "./alpaca";

export type { PricePoint };
export type AssetType = "stock" | "etf";

export type StockRow = {
  ticker: string;
  name: string;
  sector: string | null;
  sub_industry: string | null;
  cik: number | null;
  in_sp500: boolean;
  core: boolean;
  asset_type: AssetType;
  exchange: string | null;
  price: number | null;
  change_1d: number | null;
  as_of: string | null;
  latest_period: string | null;
  metrics: Record<string, number>;
  sector_pct: Record<string, number>;
  score: number | null;
  score_parts: Record<string, number>;
};

export type ListRow = {
  ticker: string;
  name: string;
  sector: string | null;
  asset_type: AssetType;
  in_sp500: boolean;
  core: boolean;
  price: number | null;
  change_1d: number | null;
  market_cap: number | null;
  pe: number | null;
  pb: number | null;
  return_1y: number | null;
  score: number | null;
  as_of: string | null;
  dollar_volume: number | null;
};

export type SectorStat = { metric: string; median: number | null; p25: number | null; p75: number | null; n: number };
export type QuarterRow = { period: string; period_end: string; values: Record<string, number> };

/** All reads go through the owner check first; RLS enforces the same rule in the database. */
async function db() {
  // Per-user data: always render at request time (the Supabase client reads the clock while checking the session).
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  return createClient();
}

type Joined = Omit<StockRow, "price" | "change_1d" | "as_of" | "latest_period" | "metrics" | "sector_pct" | "score" | "score_parts"> & {
  stock_metrics: Pick<StockRow, "price" | "change_1d" | "as_of" | "latest_period" | "metrics" | "sector_pct" | "score" | "score_parts"> | null;
};

function flatten({ stock_metrics: m, ...c }: Joined): StockRow {
  return {
    ...c,
    price: m?.price != null ? Number(m.price) : null,
    change_1d: m?.change_1d != null ? Number(m.change_1d) : null,
    as_of: m?.as_of ?? null,
    latest_period: m?.latest_period ?? null,
    metrics: m?.metrics ?? {},
    sector_pct: m?.sector_pct ?? {},
    score: m?.score != null ? Number(m.score) : null,
    score_parts: m?.score_parts ?? {},
  };
}

const STOCK_SELECT =
  "ticker,name,sector,sub_industry,cik,in_sp500,core,asset_type,exchange,stock_metrics(price,change_1d,as_of,latest_period,metrics,sector_pct,score,score_parts)";

const toListRow = (r: Record<string, unknown>): ListRow => {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    ticker: String(r.ticker), name: String(r.name), sector: (r.sector as string) ?? null, asset_type: r.asset_type as AssetType,
    in_sp500: Boolean(r.in_sp500), core: Boolean(r.core), price: n(r.price), change_1d: n(r.change_1d), market_cap: n(r.market_cap),
    pe: n(r.pe), pb: n(r.pb), return_1y: n(r.return_1y), score: n(r.score), as_of: (r.as_of as string) ?? null,
    dollar_volume: n(r.dollar_volume),
  };
};

export async function getStock(ticker: string): Promise<StockRow | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("companies").select(STOCK_SELECT).eq("ticker", ticker.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data ? flatten(data as unknown as Joined) : null;
}

/** Full rows for a handful of tickers, in the order given. */
export async function getStocks(tickers: string[]): Promise<StockRow[]> {
  if (!tickers.length) return [];
  const supabase = await db();
  const { data, error } = await supabase.from("companies").select(STOCK_SELECT).in("ticker", tickers);
  if (error) throw error;
  const rows = new Map((data as unknown as Joined[]).map((r) => [r.ticker, flatten(r)]));
  return tickers.map((t) => rows.get(t)).filter((r): r is StockRow => !!r);
}

/** S&P 500 members (used for sector overviews; extras and the broad universe never shape sector stats). */
export async function listSp500(): Promise<StockRow[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("companies").select(STOCK_SELECT).eq("in_sp500", true).order("ticker");
  if (error) throw error;
  return (data as unknown as Joined[]).map(flatten);
}

export const SORT_KEYS = ["ticker", "price", "change_1d", "market_cap", "pe", "pb", "return_1y", "score", "dollar_volume"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type Universe = "tumu" | "sp500" | "hisse" | "etf";
export const PAGE_SIZE = 50;

/** Escape characters PostgREST treats specially inside or()/ilike filters. */
const like = (q: string) => q.replace(/[%_,()*\\]/g, " ").trim();

export async function searchStocks(opts: {
  q?: string; sector?: string; universe?: Universe; etfCategory?: string; sort?: SortKey; dir?: "asc" | "desc"; page?: number;
}): Promise<{ rows: ListRow[]; total: number }> {
  const supabase = await db();
  const page = Math.max(1, opts.page ?? 1);
  let query = supabase.from("stock_list").select("*", { count: "exact" });
  const q = like(opts.q ?? "");
  if (q) query = query.or(`ticker.ilike.${q}%,name.ilike.%${q}%`);
  if (opts.sector) query = query.eq("sector", opts.sector);
  if (opts.universe === "sp500") query = query.eq("in_sp500", true);
  if (opts.universe === "hisse") query = query.eq("asset_type", "stock");
  if (opts.universe === "etf") {
    query = query.eq("asset_type", "etf");
    // Same first-match-wins order as classifyEtf: match this category, exclude the ones before it.
    const idx = opts.etfCategory === "diger" ? ETF_CATEGORIES.length : ETF_CATEGORIES.findIndex((c) => c.key === opts.etfCategory);
    if (idx >= 0) {
      for (const prev of ETF_CATEGORIES.slice(0, idx)) query = query.not("name", "imatch", pgPattern(prev));
      if (idx < ETF_CATEGORIES.length) query = query.filter("name", "imatch", pgPattern(ETF_CATEGORIES[idx]));
    }
  }
  const sort = opts.sort ?? "market_cap";
  query = query
    .order(sort, { ascending: (opts.dir ?? (sort === "ticker" ? "asc" : "desc")) === "asc", nullsFirst: false })
    .order("ticker")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []).map(toListRow), total: count ?? 0 };
}

export type ScreenRow = ListRow & { metrics: Record<string, number> };

/** Screener: stocks matching every range (missing values never match), sorted by any filter key. */
export async function screenStocks(opts: {
  ranges: Range[]; sector?: string; sp500Only?: boolean; sort: string; dir: "asc" | "desc"; page: number;
}): Promise<{ rows: ScreenRow[]; total: number }> {
  const supabase = await db();
  let query = supabase.from("stock_list").select("*", { count: "exact" }).eq("asset_type", "stock").not("price", "is", null);
  if (opts.sp500Only) query = query.eq("in_sp500", true);
  if (opts.sector) query = query.eq("sector", opts.sector);
  for (const r of opts.ranges) {
    if (r.min != null) query = query.gte(filterPath(r.key), r.min);
    if (r.max != null) query = query.lte(filterPath(r.key), r.max);
  }
  const page = Math.max(1, opts.page);
  query = query
    .order(filterPath(opts.sort), { ascending: opts.dir === "asc", nullsFirst: false })
    .order("ticker")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return {
    rows: (data ?? []).map((r) => ({ ...toListRow(r), metrics: Object.fromEntries(Object.entries((r.metrics ?? {}) as Record<string, number>).map(([k, v]) => [k, Number(v)])) })),
    total: count ?? 0,
  };
}

/** Typeahead: exact ticker first, then ticker prefix, then name matches; bigger companies first. */
export async function suggestTickers(q: string, limit = 8): Promise<ListRow[]> {
  const term = like(q);
  if (!term) return [];
  const supabase = await db();
  const { data, error } = await supabase
    .from("stock_list")
    .select("*")
    .or(`ticker.ilike.${term}%,name.ilike.%${term}%`)
    .order("market_cap", { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) throw error;
  const upper = term.toUpperCase();
  const rank = (r: ListRow) => (r.ticker === upper ? 0 : r.ticker.startsWith(upper) ? 1 : 2);
  return (data ?? []).map(toListRow).sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

export async function getSectorStats(sector: string | null): Promise<Record<string, SectorStat>> {
  if (!sector) return {};
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

export async function getQuarters(cik: number | null): Promise<QuarterRow[]> {
  if (!cik) return [];
  const supabase = await db();
  const { data, error } = await supabase.from("fundamentals_q").select("period,period_end,values").eq("cik", cik).order("period");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    period: r.period, period_end: r.period_end,
    values: Object.fromEntries(Object.entries(r.values as Record<string, number>).map(([k, v]) => [k, Number(v)])),
  }));
}

/** ~1 year of daily closes: stored bars for core tickers, Alpaca (cached) for everything else. */
export async function getPrices(ticker: string, core: boolean): Promise<PricePoint[]> {
  const supabase = await db();
  if (!core) return alpacaDailyCloses(ticker);
  const { data, error } = await supabase
    .from("prices_daily")
    .select("date,close")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(260);
  if (error) throw error;
  return (data ?? []).reverse().map((p) => ({ date: p.date, close: Number(p.close) }));
}

/** Daily Kairos Score snapshots for a ticker, oldest first (last ~1 year). */
export async function getScoreHistory(ticker: string): Promise<{ date: string; score: number }[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("score_history").select("date,score").eq("ticker", ticker).order("date", { ascending: false }).limit(370);
  if (error) throw error;
  return (data ?? []).reverse();
}
