import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";

export type NewsItem = {
  id: string;
  source: "marketaux" | "rss" | "gdelt";
  kind: "company" | "global";
  url: string;
  title: string;
  description: string | null;
  source_domain: string | null;
  published_at: string;
  topic: string | null;
  sectors: string[];
  tickers: { ticker: string; sentiment: number | null }[];
};
export type EconEvent = { date: string; release_id: number; name: string; importance: number; source: string };
export type EarningsEvent = { ticker: string; name: string; report_date: string; estimate_eps: number | null; time_of_day: string | null; market_cap: number | null };

// Marketaux links an article to every entity it mentions; weak mentions (low match score) are noise.
const MIN_MATCH = 10;

/** Request time for relative timestamps ("3 saat önce"); request-time only, never prerendered. */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}

async function db() {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  return createClient();
}

type RawNews = Omit<NewsItem, "tickers"> & { news_tickers: { ticker: string; sentiment: number | null; match_score: number | null }[] };
const NEWS_SELECT = "id,source,kind,url,title,description,source_domain,published_at,topic,sectors,news_tickers(ticker,sentiment,match_score)";
const toItem = ({ news_tickers, ...n }: RawNews): NewsItem => ({
  ...n,
  tickers: news_tickers
    .filter((t) => t.match_score == null || Number(t.match_score) >= MIN_MATCH)
    .map((t) => ({ ticker: t.ticker, sentiment: t.sentiment == null ? null : Number(t.sentiment) })),
});

export async function getNews(opts: { kind?: "company" | "global"; topic?: string; sector?: string; hours?: number; limit?: number } = {}): Promise<NewsItem[]> {
  const supabase = await db();
  let q = supabase.from("news_items").select(NEWS_SELECT).order("published_at", { ascending: false }).limit(opts.limit ?? 60);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.topic) q = q.eq("topic", opts.topic);
  if (opts.sector) q = q.contains("sectors", [opts.sector]);
  if (opts.hours) q = q.gte("published_at", new Date(Date.now() - opts.hours * 3600e3).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as RawNews[]).map(toItem);
}

/** Headlines or summaries mentioning any of the terms (e.g. an investor's name), newest first. */
export async function getNewsMentioning(terms: string[], limit = 8): Promise<NewsItem[]> {
  const safe = terms.map((t) => t.replace(/[%_,()*\\"]/g, " ").trim()).filter(Boolean);
  if (!safe.length) return [];
  const supabase = await db();
  const { data, error } = await supabase.from("news_items").select(NEWS_SELECT)
    .or(safe.flatMap((t) => [`title.ilike.%${t}%`, `description.ilike.%${t}%`]).join(","))
    .order("published_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as unknown as RawNews[]).map(toItem);
}

/** News linked to one ticker, newest first. */
export async function getTickerNews(ticker: string, limit = 12): Promise<NewsItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("news_items")
    .select(NEWS_SELECT.replace("news_tickers(", "news_tickers!inner(") )
    .eq("news_tickers.ticker", ticker)
    .order("published_at", { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  return (data as unknown as RawNews[]).map(toItem).filter((n) => n.tickers.some((t) => t.ticker === ticker)).slice(0, limit);
}

export async function getEconCalendar(from: string, to: string): Promise<EconEvent[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("econ_calendar").select("date,release_id,name,importance,source").gte("date", from).lte("date", to).order("date").order("importance", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Earnings in a date range, biggest companies first within each day. */
export async function getEarnings(from: string, to: string): Promise<EarningsEvent[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("earnings_calendar")
    .select("ticker,report_date,estimate_eps,time_of_day,companies(name,stock_metrics(market_cap))")
    .gte("report_date", from)
    .lte("report_date", to)
    .order("report_date");
  if (error) throw error;
  type Raw = { ticker: string; report_date: string; estimate_eps: number | null; time_of_day: string | null; companies: { name: string; stock_metrics: { market_cap: number | null } | null } | null };
  return (data as unknown as Raw[])
    .map((r) => ({
      ticker: r.ticker, report_date: r.report_date, estimate_eps: r.estimate_eps == null ? null : Number(r.estimate_eps), time_of_day: r.time_of_day,
      name: r.companies?.name ?? r.ticker, market_cap: r.companies?.stock_metrics?.market_cap == null ? null : Number(r.companies.stock_metrics.market_cap),
    }))
    .sort((a, b) => a.report_date.localeCompare(b.report_date) || (b.market_cap ?? 0) - (a.market_cap ?? 0));
}

/** Next earnings date per ticker for a set of tickers (e.g. the watchlist). */
export async function getUpcomingEarningsFor(tickers: string[]): Promise<Record<string, { report_date: string; time_of_day: string | null }>> {
  if (!tickers.length) return {};
  const supabase = await db();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("earnings_calendar").select("ticker,report_date,time_of_day").in("ticker", tickers).gte("report_date", today).order("report_date");
  if (error) throw error;
  const out: Record<string, { report_date: string; time_of_day: string | null }> = {};
  for (const r of data ?? []) out[r.ticker] ??= { report_date: r.report_date, time_of_day: r.time_of_day };
  return out;
}

/** Latest news for any of the given tickers, newest first. */
export async function getNewsForTickers(tickers: string[], limit = 15): Promise<NewsItem[]> {
  if (!tickers.length) return [];
  const supabase = await db();
  const { data, error } = await supabase
    .from("news_items")
    .select(NEWS_SELECT.replace("news_tickers(", "news_tickers!inner("))
    .in("news_tickers.ticker", tickers)
    .order("published_at", { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  const set = new Set(tickers);
  return (data as unknown as RawNews[]).map(toItem).filter((n) => n.tickers.some((t) => set.has(t.ticker))).slice(0, limit);
}

export async function getNextEarnings(ticker: string): Promise<{ report_date: string; time_of_day: string | null; estimate_eps: number | null } | null> {
  const supabase = await db();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("earnings_calendar").select("report_date,time_of_day,estimate_eps").eq("ticker", ticker).gte("report_date", today).order("report_date").limit(1);
  if (error) throw error;
  return data?.[0] ? { ...data[0], estimate_eps: data[0].estimate_eps == null ? null : Number(data[0].estimate_eps) } : null;
}

/** Reported vs estimated EPS history for a ticker (Alpha Vantage), newest first. */
export async function getEarningsHistory(ticker: string) {
  const supabase = await db();
  const { data, error } = await supabase.from("earnings_history").select("fiscal_date_ending,reported_date,reported_eps,estimated_eps,surprise_pct")
    .eq("ticker", ticker).order("fiscal_date_ending", { ascending: false }).limit(12);
  if (error) throw error;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return (data ?? []).map((r) => ({ ...r, reported_eps: n(r.reported_eps), estimated_eps: n(r.estimated_eps), surprise_pct: n(r.surprise_pct) }));
}
