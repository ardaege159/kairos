// Insider transactions (SEC Form 4) for core tickers (S&P 500 + extras), last 120 days.
//   node --env-file=.env.local scripts/ingest/insiders.ts [--days=120]
// SEC's archive requires a User-Agent that names you and gives a contact e-mail: set SEC_USER_AGENT in
// .env.local (e.g. "Ad Soyad ad@example.com"). Already processed filings are skipped, so daily runs are short.
import { createClient } from "@supabase/supabase-js";
import { parseForm4 } from "../../lib/insiders/parse.ts";

const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 120);
const UA = process.env.SEC_USER_AGENT?.trim();
const { NEXT_PUBLIC_SUPABASE_URL: url } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.error("Supabase anahtarları gerekli (.env.local).");
  process.exit(1);
}
if (!UA || !/@/.test(UA)) {
  console.error('SEC_USER_AGENT eksik: .env.local dosyasına SEC_USER_AGENT="Ad Soyad eposta@ornek.com" satırını ekle (SEC kuralı).');
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function sec(u: string): Promise<Response | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = 120 - (Date.now() - last); // under SEC's 10 requests/second
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetch(u, { headers: { "User-Agent": UA!, "Accept-Encoding": "gzip, deflate" } }).catch(() => null);
    if (r?.ok) return r;
    if (r && r.status === 404) return null;
    await sleep(1000 * attempt);
  }
  return null;
}

const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
const { data: run } = await db.from("ingest_runs").insert({ source: "insiders" }).select("id").single();
try {
  const { data: core, error } = await db.from("companies").select("ticker,cik").eq("core", true).eq("asset_type", "stock").not("cik", "is", null);
  if (error) throw error;
  const seen = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("insider_filings").select("accession").range(from, from + 999);
    for (const r of data ?? []) seen.add(r.accession);
    if (!data || data.length < 1000) break;
  }

  let filings = 0, trades = 0, failed = 0;
  // Share classes (GOOGL/GOOG) share a CIK: process each CIK once, attribute to the first ticker.
  const byCik = new Map<number, string>();
  for (const c of core ?? []) if (!byCik.has(c.cik)) byCik.set(c.cik, c.ticker);
  for (const [cik, ticker] of byCik) {
    const r = await sec(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`);
    if (!r) { failed++; continue; }
    const recent = ((await r.json()) as { filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; primaryDocument: string[] } } }).filings.recent;
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] !== "4" || recent.filingDate[i] < since || seen.has(recent.accessionNumber[i])) continue;
      const acc = recent.accessionNumber[i];
      const doc = recent.primaryDocument[i].replace(/^xsl[^/]+\//, ""); // raw XML instead of the rendered page
      const x = await sec(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/${doc}`);
      if (!x) { failed++; continue; }
      const parsed = parseForm4(await x.text());
      const { error: fe } = await db.from("insider_filings").upsert({ accession: acc, ticker, filed_at: recent.filingDate[i] }, { onConflict: "accession" });
      if (fe) throw fe;
      const rows = parsed.trades.map((t, k) => ({ id: `${acc}|${k}`, accession: acc, ticker, filed_at: recent.filingDate[i], trade_date: t.date,
        owner: t.owner, role: t.role, code: t.code, acquired: t.acquired, shares: t.shares, price: t.price, value: t.value, owned_after: t.owned_after, plan: t.plan }));
      if (rows.length) {
        const { error: te } = await db.from("insider_trades").upsert(rows, { onConflict: "id" });
        if (te) throw te;
      }
      filings++;
      trades += rows.length;
    }
  }
  // Keep a year of history.
  const { error: oldErr } = await db.from("insider_filings").delete().lt("filed_at", new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10));
  if (oldErr) throw oldErr;
  const detail = { companies: byCik.size, newFilings: filings, newTrades: trades, failed };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
