// Famous investors' portfolios from SEC 13F-HR filings -> investor_filings, investor_holdings.
//   node --env-file=.env.local scripts/ingest/investors.ts [--quarters=3]
// Needs SEC_USER_AGENT (SEC asks for a name and contact e-mail). CUSIPs are mapped to tickers with
// OpenFIGI (free, no key: 25 requests a minute, 10 CUSIPs each) and cached in cusip_map; issuer-name
// matching against our company list is the fallback. Filings already stored are skipped.
import { createClient } from "@supabase/supabase-js";
import { INVESTORS } from "../../lib/investors/list.ts";
import { cleanIssuer, cleanListingName, normalizeUnits, parseInfoTable } from "../../lib/investors/thirteenf.ts";
import { buildMatcher } from "../../lib/spending/match.ts";

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

/** OpenFIGI: CUSIP -> US-listed equity ticker ("BRK/B" -> "BRK.B"). Unknown CUSIPs map to null; CUSIPs whose request failed are absent. */
async function figi(cusips: string[]): Promise<Map<string, { ticker: string | null; name: string | null }>> {
  const out = new Map<string, { ticker: string | null; name: string | null }>();
  for (let i = 0; i < cusips.length; i += 10) {
    const batch = cusips.slice(i, i + 10);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((c) => ({ idType: "ID_CUSIP", idValue: c, exchCode: "US" }))),
      }).catch(() => null);
      if (r?.status === 429) { await sleep(60_000); continue; }
      if (!r?.ok) { await sleep(3000); continue; }
      const j = (await r.json()) as { data?: { ticker?: string; name?: string; marketSector?: string }[] }[];
      j.forEach((res, k) => {
        const hit = res.data?.find((d) => d.marketSector === "Equity" && d.ticker) ?? res.data?.[0];
        out.set(batch[k], { ticker: hit?.ticker ? hit.ticker.replace("/", ".") : null, name: hit?.name ?? null });
      });
      break;
    }
    await sleep(2600); // 25 requests a minute without an API key
  }
  return out;
}

const { data: run } = await db.from("ingest_runs").insert({ source: "investors" }).select("id").single();
try {
  const companies: { ticker: string; name: string; in_sp500: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker,name,in_sp500").range(from, from + 999);
    if (error) throw error;
    companies.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  companies.sort((a, b) => Number(b.in_sp500) - Number(a.in_sp500));
  const known = new Set(companies.map((c) => c.ticker));
  // Listing names carry the security type ("… Common Stock"); 13F names are abbreviated ("… HLDG NV").
  const match = buildMatcher(companies.map((c) => ({ ticker: c.ticker, name: cleanListingName(c.name) })));

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
  const cusips = [...names.keys()];
  const cache = new Map<string, string | null>();
  const figiUnknown = new Set<string>();   // OpenFIGI already answered "not found": only retry the name match
  for (let i = 0; i < cusips.length; i += 500) {
    const { data } = await db.from("cusip_map").select("cusip,ticker,source").in("cusip", cusips.slice(i, i + 500));
    for (const c of data ?? []) {
      if (c.ticker) cache.set(c.cusip, c.ticker);
      else if (c.source === "none") figiUnknown.add(c.cusip);
    }
  }
  const missing = cusips.filter((c) => !cache.has(c));
  const mapped = await figi(missing.filter((c) => !figiUnknown.has(c)));
  const byName = (c: string) => { for (const n of names.get(c) ?? []) { const m = match(cleanIssuer(n)); if (m) return m; } return null; };
  const issuerOf = (c: string) => [...(names.get(c) ?? [])][0] ?? null;
  const cacheRows = missing.flatMap((c) => {
    const m = mapped.get(c);
    let ticker = m?.ticker && known.has(m.ticker) ? m.ticker : null;
    let source = ticker ? "openfigi" : null;
    if (!ticker) {
      const hit = byName(c);
      if (hit) { ticker = hit.ticker; source = "name"; }
    }
    cache.set(c, ticker);
    // A failed OpenFIGI request leaves no record, so the CUSIP is tried again next run.
    if (!ticker && !m && !figiUnknown.has(c)) return [];
    return [{ cusip: c, ticker, name: m?.name ?? issuerOf(c), source: source ?? "none", updated_at: new Date().toISOString() }];
  });
  for (let i = 0; i < cacheRows.length; i += 500) {
    const { error } = await db.from("cusip_map").upsert(cacheRows.slice(i, i + 500), { onConflict: "cusip" });
    if (error) throw error;
  }

  // Stored positions whose CUSIP has now been mapped.
  for (const r of cacheRows.filter((x) => x.ticker)) {
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

  const detail = { investors: INVESTORS.length, newFilings, positions, newCusips: missing.length, unmappedPositions: unmapped.size };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
