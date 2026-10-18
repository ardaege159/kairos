// Evaluate alerts and watchlist events against the freshly loaded data -> notifications.
//   node --env-file=.env.local scripts/ingest/alerts.ts
// Runs at the end of every data update (veri:fiyat, veri:haber, veri:yukle). Notifications are unique
// per (user, dedupe), so re-running never duplicates them.
import { createClient } from "@supabase/supabase-js";
import { evaluateAlert, watchlistEvents, type Alert, type Notice, type Snapshot } from "../../lib/alerts/evaluate.ts";

const { NEXT_PUBLIC_SUPABASE_URL: url } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.error("Supabase anahtarları gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const { data: run } = await db.from("ingest_runs").insert({ source: "alerts" }).select("id").single();
try {
  const [{ data: alerts, error: ae }, { data: watch, error: we }] = await Promise.all([
    db.from("alerts").select("id,user_id,ticker,kind,threshold,note").eq("active", true),
    db.from("watchlist").select("user_id,ticker"),
  ]);
  if (ae) throw ae;
  if (we) throw we;
  const tickers = [...new Set([...(alerts ?? []).map((a) => a.ticker), ...(watch ?? []).map((w) => w.ticker)])];
  if (!tickers.length) {
    await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail: { tickers: 0 } }).eq("id", run!.id);
    console.log("Alarm ya da izleme listesi yok.");
    process.exit(0);
  }

  const [snaps, earnings, buys, contracts] = await Promise.all([
    db.from("companies").select("ticker,name,stock_metrics(price,change_1d,score,as_of)").in("ticker", tickers),
    db.from("earnings_calendar").select("ticker,report_date,time_of_day").in("ticker", tickers).gte("report_date", today).order("report_date"),
    db.from("insider_trades").select("id,ticker,owner,role,value,trade_date").in("ticker", tickers).eq("code", "P").gte("filed_at", daysAgo(7)),
    db.from("spending_actions").select("id,ticker,amount,agency,action_date,psc_desc").in("ticker", tickers).gte("fetched_at", new Date(Date.now() - 3 * 864e5).toISOString()),
  ]);
  for (const r of [snaps, earnings, buys, contracts]) if (r.error) throw r.error;

  type M = { price: number | null; change_1d: number | null; score: number | null; as_of: string | null } | null;
  const snapshot = new Map<string, Snapshot>((snaps.data as unknown as { ticker: string; name: string; stock_metrics: M }[]).map((c) => [c.ticker, {
    ticker: c.ticker, name: c.name, price: c.stock_metrics?.price == null ? null : Number(c.stock_metrics.price),
    change_1d: c.stock_metrics?.change_1d == null ? null : Number(c.stock_metrics.change_1d), score: c.stock_metrics?.score ?? null, as_of: c.stock_metrics?.as_of ?? null,
  }]));

  const rows: (Notice & { user_id: string })[] = [];
  const fired: string[] = [];
  for (const a of alerts ?? []) {
    const s = snapshot.get(a.ticker);
    const n = s ? evaluateAlert({ ...(a as Alert), threshold: Number(a.threshold) }, s) : null;
    if (!n) continue;
    rows.push({ ...n, user_id: a.user_id });
    if (n.oneShot) fired.push(a.id);
  }
  for (const w of watch ?? []) {
    const s = snapshot.get(w.ticker);
    if (!s) continue;
    const e = (earnings.data ?? []).find((x) => x.ticker === w.ticker) ?? null;
    const events = watchlistEvents({
      snapshot: s, today, earnings: e,
      insiderBuys: (buys.data ?? []).filter((b) => b.ticker === w.ticker).map((b) => ({ id: b.id, owner: b.owner, role: b.role, value: b.value == null ? null : Number(b.value), date: b.trade_date })),
      contracts: (contracts.data ?? []).filter((c) => c.ticker === w.ticker).map((c) => ({ id: c.id, amount: Number(c.amount), agency: c.agency, action_date: c.action_date, what: c.psc_desc })),
    });
    rows.push(...events.map((n) => ({ ...n, user_id: w.user_id })));
  }

  // ignoreDuplicates: an event already notified (same dedupe key) is left as it is, read or not.
  const payload = rows.map(({ oneShot: _o, ...n }) => n);
  if (payload.length) {
    const { error } = await db.from("notifications").upsert(payload, { onConflict: "user_id,dedupe", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (fired.length) {
    const { error } = await db.from("alerts").update({ active: false, triggered_at: new Date().toISOString() }).in("id", fired);
    if (error) throw error;
  }
  const detail = { tickers: tickers.length, alerts: alerts?.length ?? 0, notices: payload.length, alertsFired: fired.length };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
