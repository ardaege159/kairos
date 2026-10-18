// Earnings surprises (Alpha Vantage EARNINGS: reported vs estimated EPS) -> earnings_history.
//   node --env-file=.env.local scripts/ingest/earnings-history.ts [--budget=20]
// Free tier: 25 requests a day (one goes to the earnings calendar). Order: watchlist and portfolio
// tickers that reported since their last fetch, then S&P 500 by market cap never fetched or stale.
import { createClient } from "@supabase/supabase-js";

const BUDGET = Number(process.argv.find((a) => a.startsWith("--budget="))?.split("=")[1] ?? 20);
const { NEXT_PUBLIC_SUPABASE_URL: url, ALPHA_VANTAGE_API_KEY: avKey } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret || !avKey) {
  console.error("Supabase anahtarları ve ALPHA_VANTAGE_API_KEY gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

const { data: run } = await db.from("ingest_runs").insert({ source: "earnings_history" }).select("id").single();
try {
  const [watch, pos, fetched, recent, sp] = await Promise.all([
    db.from("watchlist").select("ticker"),
    db.from("portfolio_positions").select("ticker"),
    db.from("earnings_fetch").select("ticker,fetched_at,last_reported"),
    // Calendar rows in the past: who has reported recently (kept by calendars.ts until replaced).
    db.from("earnings_calendar").select("ticker,report_date").lte("report_date", today),
    db.from("stock_list").select("ticker").eq("in_sp500", true).eq("asset_type", "stock").order("market_cap", { ascending: false, nullsFirst: false }).limit(600),
  ]);
  for (const r of [watch, pos, fetched, recent, sp]) if (r.error) throw r.error;
  const last = new Map((fetched.data ?? []).map((f) => [f.ticker, f]));
  const reported = new Map<string, string>();
  for (const r of recent.data ?? []) if ((reported.get(r.ticker) ?? "") < r.report_date) reported.set(r.ticker, r.report_date);
  // Due: never fetched, reported after the last fetch, or older than 100 days (catches missed reports).
  const due = (t: string) => {
    const f = last.get(t);
    if (!f) return true;
    const rep = reported.get(t);
    return (rep != null && rep > (f.last_reported ?? "") && rep < today) || f.fetched_at < daysAgo(100);
  };
  const mine = [...new Set([...(watch.data ?? []), ...(pos.data ?? [])].map((r) => r.ticker))];
  const queue = [...new Set([...mine.filter(due), ...(sp.data ?? []).map((r) => r.ticker).filter(due)])].slice(0, BUDGET);

  let done = 0, rows = 0, limited = false;
  for (const t of queue) {
    const r = await fetch(`https://www.alphavantage.co/query?function=EARNINGS&symbol=${encodeURIComponent(t)}&apikey=${avKey}`);
    const j = (await r.json()) as { quarterlyEarnings?: Record<string, string>[]; Information?: string; Note?: string };
    if (!j.quarterlyEarnings) {
      if (j.Information || j.Note) { limited = true; break; } // daily or per-minute limit reached
      continue;
    }
    const num = (v: string | undefined) => (v == null || v === "None" || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
    const qs = j.quarterlyEarnings.slice(0, 12).map((q) => ({
      ticker: t, fiscal_date_ending: q.fiscalDateEnding, reported_date: q.reportedDate || null,
      reported_eps: num(q.reportedEPS), estimated_eps: num(q.estimatedEPS), surprise_pct: num(q.surprisePercentage), report_time: q.reportTime || null,
    }));
    if (qs.length) {
      const { error } = await db.from("earnings_history").upsert(qs, { onConflict: "ticker,fiscal_date_ending" });
      if (error) throw error;
    }
    const { error: fe } = await db.from("earnings_fetch").upsert({ ticker: t, fetched_at: new Date().toISOString(), last_reported: qs[0]?.reported_date ?? null }, { onConflict: "ticker" });
    if (fe) throw fe;
    done++;
    rows += qs.length;
    await sleep(1500);
  }
  const detail = { queued: queue.length, fetched: done, rows, limited };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
