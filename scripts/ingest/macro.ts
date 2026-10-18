// Macro series from FRED (free key) and ECB exchange rates (Frankfurter, no key) -> macro_observations.
//   node --env-file=.env.local scripts/ingest/macro.ts
// Daily series keep ~3 years, monthly and quarterly ~6 years (enough for year-over-year changes).
import { createClient } from "@supabase/supabase-js";
import { MACRO } from "../../lib/macro/series.ts";

const { NEXT_PUBLIC_SUPABASE_URL: url, FRED_API_KEY: fredKey } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret || !fredKey) {
  console.error("Supabase anahtarları ve FRED_API_KEY gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const DAILY = new Set(["USDTRY", "DFF", "DGS2", "DGS10", "T10Y2Y", "VIXCLS", "BAMLH0A0HYM2", "DTWEXBGS", "DCOILWTICO"]);
const yearsAgo = (n: number) => new Date(Date.now() - n * 365.25 * 864e5).toISOString().slice(0, 10);

const { data: run } = await db.from("ingest_runs").insert({ source: "macro" }).select("id").single();
try {
  const counts: Record<string, number> = {};
  for (const def of MACRO) {
    const start = yearsAgo(DAILY.has(def.id) ? 3 : 6);
    let rows: { series_id: string; date: string; value: number }[];
    if (def.source === "frankfurter") {
      // ECB reference rates (business days), e.g. USD/TRY.
      const r = await fetch(`https://api.frankfurter.dev/v1/${start}..?from=${def.id.slice(0, 3)}&to=${def.id.slice(3)}`);
      if (!r.ok) throw new Error(`Frankfurter HTTP ${r.status} ${def.id}`);
      const j = (await r.json()) as { rates: Record<string, Record<string, number>> };
      rows = Object.entries(j.rates).map(([date, v]) => ({ series_id: def.id, date, value: v[def.id.slice(3)] }));
    } else {
      const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${def.id}&api_key=${fredKey}&file_type=json&observation_start=${start}`);
      if (!r.ok) throw new Error(`FRED HTTP ${r.status} ${def.id}`);
      const j = (await r.json()) as { observations: { date: string; value: string }[] };
      // FRED marks missing days (holidays) with ".".
      rows = j.observations.filter((o) => o.value !== ".").map((o) => ({ series_id: def.id, date: o.date, value: Number(o.value) }));
    }
    const { error: delErr } = await db.from("macro_observations").delete().eq("series_id", def.id).lt("date", start);
    if (delErr) throw delErr;
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await db.from("macro_observations").upsert(rows.slice(i, i + 1000), { onConflict: "series_id,date" });
      if (error) throw error;
    }
    counts[def.id] = rows.length;
  }
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail: counts }).eq("id", run!.id);
  console.log(JSON.stringify(counts, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
