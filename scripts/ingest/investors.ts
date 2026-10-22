// Famous investors' portfolios from SEC 13F-HR filings -> investor_filings, investor_holdings.
//   node --env-file=.env.local scripts/ingest/investors.ts [--quarters=3]
// Needs SEC_USER_AGENT (SEC asks for a name and contact e-mail). CUSIPs are mapped to tickers with
// OpenFIGI (free, no key: 25 requests a minute, 10 CUSIPs each) and cached in cusip_map; issuer-name
// matching against our company list is the fallback (scripts/ingest/lib-cusip.ts). Filings already stored are skipped.
import { createClient } from "@supabase/supabase-js";
import { INVESTORS } from "../../lib/investors/list.ts";
import { normalizeUnits, parseInfoTable } from "../../lib/investors/thirteenf.ts";
import { companyMatcher, resolveCusips } from "./lib-cusip.ts";

const QUARTERS = Number(process.argv.find((a) => a.startsWith("--quarters="))?.split("=")[1] ?? 3);
const UA = process.env.SEC_USER_AGENT?.trim();
const { NEXT_PUBLIC_SUPABASE_URL: url } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret || !UA) {
  console.error("Supabase anahtarları ve SEC_USER_AGENT gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function sec(u: string): Promise<Response | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = 120 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetch(u, { headers: { "User-Agent": UA!, "Accept-Encoding": "gzip, deflate" } }).catch(() => null);
    if (r?.ok) return r;
    if (r?.status === 404) return null;
    await sleep(1000 * attempt);
  }
  return null;
}

const { data: run } = await db.from("ingest_runs").insert({ source: "investors" }).select("id").single();
try {
  const ctx = await companyMatcher(db);

  const { data: stored } = await db.from("investor_filings").select("accession");
  const have = new Set((stored ?? []).map((s) => s.accession));
  let newFilings = 0, positions = 0;
  const unmapped = new Set<string>();
  const pending: { cik: number; period: string; rows: ReturnType<typeof parseInfoTable> }[] = [];

  for (const inv of INVESTORS) {
    const r = await sec(`https://data.sec.gov/submissions/CIK${String(inv.cik).padStart(10, "0")}.json`);
    if (!r) continue;
    const recent = ((await r.json()) as { filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; reportDate: string[] } } }).filings.recent;
    // Latest original 13F-HR per quarter (amendments 13F-HR/A only add or correct rows; skipped).
    const periods = new Map<string, { acc: string; filed: string }>();
    for (let i = 0; i < recent.form.length && periods.size < QUARTERS; i++) {
      if (recent.form[i] !== "13F-HR" || periods.has(recent.reportDate[i])) continue;
      periods.set(recent.reportDate[i], { acc: recent.accessionNumber[i], filed: recent.filingDate[i] });
    }
    for (const [period, f] of periods) {
      if (have.has(f.acc)) continue;
      const dir = `https://www.sec.gov/Archives/edgar/data/${inv.cik}/${f.acc.replace(/-/g, "")}`;
      const idx = await sec(`${dir}/index.json`);
      if (!idx) continue;
      const items = ((await idx.json()) as { directory: { item: { name: string; size: string }[] } }).directory.item;
      const table = items.filter((it) => it.name.toLowerCase().endsWith(".xml") && it.name !== "primary_doc.xml").sort((a, b) => Number(b.size) - Number(a.size))[0];
      if (!table) continue;
      const x = await sec(`${dir}/${table.name}`);
      if (!x) continue;
      const { rows, scaled } = normalizeUnits(parseInfoTable(await x.text()));
      if (scaled) console.log(`${inv.fund} ${period}: değerler bin $ cinsindendi, 1.000 ile çarpıldı`);
      pending.push({ cik: inv.cik, period, rows });
      const { error } = await db.from("investor_filings").upsert({
        accession: f.acc, cik: inv.cik, period, filed_at: f.filed, total_value: rows.reduce((s, p) => s + p.value, 0), positions: rows.length,
      }, { onConflict: "accession" });
      if (error) throw error;
      newFilings++;
    }
  }

  // Map CUSIPs: those in new filings plus stored positions still without a ticker. Cache first, then
  // OpenFIGI, then every issuer spelling seen for the CUSIP ("CHUBB LIMITED", "CHUBB LTD SWITZ").
  const names = new Map<string, Set<string>>();
  const addName = (c: string, n: string) => (names.get(c) ?? names.set(c, new Set()).get(c)!).add(n);
  for (const p of pending) for (const r of p.rows) addName(r.cusip, r.issuer);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("investor_holdings").select("cusip,issuer").is("ticker", null).range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) addName(r.cusip, r.issuer);
    if (!data || data.length < 1000) break;
  }
  const { cache, newlyMapped, looked } = await resolveCusips(db, names, ctx);

  // Stored positions whose CUSIP has now been mapped.
  for (const r of newlyMapped) {
    const { error } = await db.from("investor_holdings").update({ ticker: r.ticker }).eq("cusip", r.cusip).is("ticker", null);
    if (error) throw error;
  }

  for (const p of pending) {
    const rows = p.rows.map((r) => {
      const ticker = cache.get(r.cusip) ?? null;
      if (!ticker) unmapped.add(r.cusip);
      return { cik: p.cik, period: p.period, cusip: r.cusip, put_call: r.putCall, issuer: r.issuer, title: r.title, ticker, value: r.value, shares: r.shares };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("investor_holdings").upsert(rows.slice(i, i + 500), { onConflict: "cik,period,cusip,put_call" });
      if (error) throw error;
    }
    positions += rows.length;
  }

  // Keep the latest QUARTERS periods per investor.
  for (const inv of INVESTORS) {
    const { data: fs } = await db.from("investor_filings").select("period").eq("cik", inv.cik).order("period", { ascending: false });
    const old = [...new Set((fs ?? []).map((f) => f.period))].slice(QUARTERS);
    if (old.length) {
      await db.from("investor_holdings").delete().eq("cik", inv.cik).in("period", old);
      await db.from("investor_filings").delete().eq("cik", inv.cik).in("period", old);
    }
  }

  const detail = { investors: INVESTORS.length, newFilings, positions, newCusips: looked, unmappedPositions: unmapped.size };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
