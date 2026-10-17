// Economic + earnings calendars for the "Bugün" page.
//   node --env-file=.env.local scripts/ingest/calendars.ts
//  - FRED release dates (next 3 weeks, last 3 days), filtered to the releases in lib/calendar/releases.ts
//  - FOMC decision days parsed from federalreserve.gov
//  - Alpha Vantage earnings calendar (next 3 months) for tickers in the universe
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "../lib-csv.mjs";
import { FOMC_RELEASE_ID, FOMC_INFO, releaseInfo } from "../../lib/calendar/releases.ts";

const { NEXT_PUBLIC_SUPABASE_URL: url, FRED_API_KEY, ALPHA_VANTAGE_API_KEY } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret || !FRED_API_KEY || !ALPHA_VANTAGE_API_KEY) {
  console.error("Supabase, FRED ve Alpha Vantage anahtarları gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

const { data: run } = await db.from("ingest_runs").insert({ source: "calendars" }).select("id").single();
try {
  // --- FRED ---
  const fu = new URL("https://api.stlouisfed.org/fred/releases/dates");
  fu.search = new URLSearchParams({ api_key: FRED_API_KEY.trim(), file_type: "json", include_release_dates_with_no_data: "true",
    realtime_start: day(-3), realtime_end: day(21), order_by: "release_date", sort_order: "asc", limit: "1000" }).toString();
  const fr = await fetch(fu);
  if (!fr.ok) throw new Error(`FRED HTTP ${fr.status}`);
  const fj = (await fr.json()) as { release_dates: { release_id: number; release_name: string; date: string }[] };
  const econ = new Map<string, { date: string; release_id: number; name: string; importance: number; source: string }>();
  for (const r of fj.release_dates) {
    const info = releaseInfo(r.release_name);
    if (!info) continue;
    econ.set(`${r.date}|${r.release_id}`, { date: r.date, release_id: r.release_id, name: r.release_name, importance: info.importance, source: "fred" });
  }

  // --- FOMC (federalreserve.gov) ---
  const page = await (await fetch("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", { headers: { "User-Agent": "Mozilla/5.0 (Kairos personal reader)" } })).text();
  const parts = page.split(/(\d{4}) FOMC Meetings/);
  let fomc = 0;
  for (let i = 1; i < parts.length; i += 2) {
    const year = Number(parts[i]);
    if (year < new Date().getUTCFullYear()) continue;
    for (const m of parts[i + 1].matchAll(/fomc-meeting__month[^>]*>\s*<strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)) {
      const monthText = m[1].trim().toLowerCase(), dateText = m[2].trim();
      if (/notation|unscheduled/i.test(dateText)) continue;
      const lastMonth = monthText.split("/").pop()!;
      const month = Object.entries(MONTHS).find(([k]) => k.startsWith(lastMonth.slice(0, 3)))?.[1];
      const lastDay = Number(/(\d+)\D*$/.exec(dateText.replace("*", ""))?.[1]);
      if (!month || !lastDay) continue;
      const date = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const sep = dateText.includes("*");
      econ.set(`${date}|${FOMC_RELEASE_ID}`, { date, release_id: FOMC_RELEASE_ID, name: sep ? `${FOMC_INFO.label} *` : FOMC_INFO.label, importance: 2, source: "fed" });
      fomc++;
    }
  }
  const econRows = [...econ.values()];
  const { error: ee } = await db.from("econ_calendar").upsert(econRows, { onConflict: "date,release_id" });
  if (ee) throw ee;

  // --- Earnings (Alpha Vantage, one request) ---
  const tickers = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker").eq("asset_type", "stock").range(from, from + 999);
    if (error) throw error;
    for (const c of data ?? []) tickers.add(c.ticker);
    if (!data || data.length < 1000) break;
  }
  const ar = await fetch(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${ALPHA_VANTAGE_API_KEY.trim()}`);
  const csv = await ar.text();
  if (!csv.startsWith("symbol")) throw new Error(`Alpha Vantage beklenmeyen cevap: ${csv.slice(0, 120).replace(ALPHA_VANTAGE_API_KEY.trim(), "***")}`);
  const earnings = parseCsv(csv)
    .filter((r) => tickers.has(r.symbol.replace("-", ".")) && /^\d{4}-\d{2}-\d{2}$/.test(r.reportDate))
    .map((r) => ({
      ticker: r.symbol.replace("-", "."), report_date: r.reportDate, fiscal_date_ending: /^\d{4}-\d{2}-\d{2}$/.test(r.fiscalDateEnding) ? r.fiscalDateEnding : null,
      estimate_eps: r.estimate === "" ? null : Number(r.estimate), time_of_day: r.timeOfTheDay || null,
    }));
  // Replace the forward window so moved dates do not linger.
  const { error: delErr } = await db.from("earnings_calendar").delete().gte("report_date", day(0));
  if (delErr) throw delErr;
  const uniq = [...new Map(earnings.map((e) => [`${e.ticker}|${e.report_date}`, e])).values()];
  for (let i = 0; i < uniq.length; i += 1000) {
    const { error } = await db.from("earnings_calendar").upsert(uniq.slice(i, i + 1000), { onConflict: "ticker,report_date" });
    if (error) throw error;
  }

  const detail = { econ: econRows.length, fomc, earnings: uniq.length };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
