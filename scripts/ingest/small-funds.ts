// Find small, concentrated stock pickers that beat the S&P 500, from SEC's quarterly 13F bulk data sets.
//   node --env-file=.env.local scripts/ingest/small-funds.ts --dir=<folder with *_form13f.zip> [--dry] [--top=25]
// Download the data sets from https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets
// (about 100 MB each; the last 9 cover ~2 years). Each zip is streamed with `unzip -p`, nothing is
// extracted. Performance is 13F-implied (lib/investors/performance.ts) and SPY is measured the same way.
import { execFileSync, spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { INVESTORS } from "../../lib/investors/list.ts";
import { isSmallStockPicker, medianPrices, quarterReturn, trackStats, type Holdings } from "../../lib/investors/performance.ts";
import { companyMatcher, resolveCusips } from "./lib-cusip.ts";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const DIR = arg("dir");
const DRY = process.argv.includes("--dry");
const TOP = Number(arg("top") ?? 25);
const SPY = "78462F103";
if (!DIR) { console.error("--dir=<13F zip klasörü> gerekli"); process.exit(1); }

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const isoDate = (d: string) => { const [day, mon, y] = d.split("-"); return `${y}-${MONTHS[mon]}-${day.padStart(2, "0")}`; };
// Filers that are not portfolio managers in the sense meant here (banks, insurers, lessors, endowments).
const NOT_A_MANAGER = /\b(BANK|BANCORP|BANCSHARES|INSURANCE|ASSURANCE|LEASING|TRUST CO(MPANY)?|FOUNDATION|ENDOWMENT|PENSION|RETIREMENT|UNIVERSITY|COLLEGE)\b/i;
const FUND_NAME = /\b(ETF|ISHARES|SPDR|VANGUARD|PROSHARES|SELECT SECTOR|WISDOMTREE|GLOBAL X|DIREXION|INVESCO QQQ|SCHWAB STRATEGIC|INDEX FD|ETF TR)\b/i;

async function* rows(zip: string, file: string) {
  // Some data sets keep the files in a sub-folder: find the member by name in the archive listing.
  const member = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split(/\r?\n/).find((m) => m === file || m.endsWith(`/${file}`));
  if (!member) throw new Error(`${zip}: ${file} bulunamadı`);
  const p = spawn("unzip", ["-p", zip, member]);
  const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const line of rl) {
    const cols = line.split("\t");
    if (!header) { header = cols; continue; }
    yield { header, cols };
  }
}
const col = (header: string[], name: string) => { const i = header.indexOf(name); if (i < 0) throw new Error(`${name} sütunu yok`); return i; };

type Pos = { value: number; shares: number; issuer: string };
type FilingResult = { acc: string; filed: string; name: string; total: number; positions: number; holdings: Map<string, Pos> };

const zips = readdirSync(DIR).filter((f) => f.endsWith("_form13f.zip")).map((f) => `${DIR}/${f}`);
const meta = new Map<string, { cik: number; period: string; filed: string; name?: string; amend?: boolean }>();
const samples = new Map<string, Map<string, number[]>>();        // period -> cusip -> value/share samples
const results = new Map<string, FilingResult>();                  // `${cik}|${period}` -> latest original filing
let scanned = 0;

for (const zip of zips) {
  const t0 = Date.now();
  const before = scanned;
  for await (const { header, cols } of rows(zip, "SUBMISSION.tsv")) {
    if (cols[col(header, "SUBMISSIONTYPE")] !== "13F-HR") continue;
    meta.set(cols[col(header, "ACCESSION_NUMBER")], { cik: Number(cols[col(header, "CIK")]), period: isoDate(cols[col(header, "PERIODOFREPORT")]), filed: isoDate(cols[col(header, "FILING_DATE")]) });
  }
  for await (const { header, cols } of rows(zip, "COVERPAGE.tsv")) {
    const m = meta.get(cols[col(header, "ACCESSION_NUMBER")]);
    if (m) { m.name = cols[col(header, "FILINGMANAGER_NAME")]; m.amend = cols[col(header, "ISAMENDMENT")] === "Y"; }
  }

  // INFOTABLE is grouped by accession: aggregate one filing at a time.
  let cur: string | null = null;
  let acc = new Map<string, Pos>();
  const finish = () => {
    if (!cur) return;
    const m = meta.get(cur);
    if (!m || m.amend || !acc.size) return;
    scanned++;
    const per = [...acc.values()].filter((p) => p.shares > 0).map((p) => p.value / p.shares).sort((a, b) => a - b);
    const scale = per.length && per[Math.floor(per.length / 2)] < 1 ? 1000 : 1; // filed in thousands
    let total = 0;
    const ps = samples.get(m.period) ?? samples.set(m.period, new Map()).get(m.period)!;
    for (const [cusip, p] of acc) {
      p.value *= scale;
      total += p.value;
      if (p.shares > 0 && p.value > 0) {
        const xs = ps.get(cusip) ?? ps.set(cusip, []).get(cusip)!;
        if (xs.length < 40) xs.push(p.value / p.shares);
      }
    }
    // Keep holdings only for plausible candidates (loose bounds; the strict filter runs at the end).
    if (total < 50e6 || total > 6e9 || acc.size < 3 || acc.size > 80) return;
    const key = `${m.cik}|${m.period}`;
    const prev = results.get(key);
    if (prev && prev.filed >= m.filed) return;
    results.set(key, { acc: cur, filed: m.filed, name: m.name ?? String(m.cik), total, positions: acc.size, holdings: acc });
  };
  let h: { acc: number; cusip: number; name: number; value: number; shares: number; type: number; putcall: number } | null = null;
  for await (const { header, cols } of rows(zip, "INFOTABLE.tsv")) {
    h ??= { acc: col(header, "ACCESSION_NUMBER"), cusip: col(header, "CUSIP"), name: col(header, "NAMEOFISSUER"), value: col(header, "VALUE"),
      shares: col(header, "SSHPRNAMT"), type: col(header, "SSHPRNAMTTYPE"), putcall: col(header, "PUTCALL") };
    const a = cols[h.acc];
    if (a !== cur) { finish(); cur = a; acc = new Map(); }
    if (cols[h.putcall] || cols[h.type] !== "SH") continue; // options and bonds are not stock positions
    const cusip = cols[h.cusip].toUpperCase();
    const p = acc.get(cusip) ?? acc.set(cusip, { value: 0, shares: 0, issuer: cols[h.name] }).get(cusip)!;
    p.value += Number(cols[h.value]) || 0;
    p.shares += Number(cols[h.shares]) || 0;
  }
  finish();
  if (scanned === before) throw new Error(`${zip}: hiç bildirim okunamadı (dosya yapısı farklı olabilir)`);
  console.log(`${zip.split("/").pop()}: ${Math.round((Date.now() - t0) / 1000)} sn, toplam taranan bildirim ${scanned}`);
}

// Quarter ends covered by every data set, newest last.
const periods = [...samples.keys()].filter((p) => (samples.get(p)?.size ?? 0) > 5000).sort().slice(-9);
const prices = new Map(periods.map((p) => [p, medianPrices(samples.get(p)!, 3)]));
const benchSeries = periods.slice(0, -1).map((p, i) => {
  const a = prices.get(p)!.get(SPY), b = prices.get(periods[i + 1])!.get(SPY);
  return a && b ? b / a - 1 : null;
});
if (benchSeries.some((b) => b == null)) throw new Error("SPY fiyatı bazı çeyreklerde bulunamadı");
console.log("dönemler:", periods.join(", "), "| SPY çeyreklik:", benchSeries.map((b) => (b! * 100).toFixed(1) + "%").join(" "));

const latest = periods.at(-1)!;
const famous = new Set(INVESTORS.map((i) => i.cik));
const ranked = [];
for (const [key, last] of results) {
  const [cikStr, period] = key.split("|");
  if (period !== latest) continue;
  const cik = Number(cikStr);
  if (famous.has(cik)) continue;
  const returns: number[] = [], bench: number[] = [], series: { period: string; r: number; bench: number }[] = [];
  let coverageSum = 0, worstCoverage = 1, quartersWithHoldings = 0, outlier = false;
  for (let i = 0; i < periods.length; i++) {
    const r0 = results.get(`${cik}|${periods[i]}`);
    if (r0) quartersWithHoldings++;
    if (!r0 || i === periods.length - 1) continue;
    const start: Holdings = new Map([...r0.holdings].map(([c, p]) => [c, p.value]));
    const q = quarterReturn(start, prices.get(periods[i])!, prices.get(periods[i + 1])!);
    if (!q) continue;
    if (Math.abs(q.r) > 1) outlier = true; // more than ±100% in a quarter: almost always a data error
    returns.push(q.r); bench.push(benchSeries[i]!); coverageSum += q.coverage; worstCoverage = Math.min(worstCoverage, q.coverage);
    series.push({ period: periods[i + 1], r: q.r, bench: benchSeries[i]! });
  }
  // A full record, and quarter-end snapshots that stand for the quarter: a fund that replaces most
  // of its book every quarter (high turnover) is not measured fairly by 13F-implied returns.
  if (outlier || returns.length < periods.length - 1 || worstCoverage < 0.7 || NOT_A_MANAGER.test(last.name)) continue;
  const newShares: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    const a = results.get(`${cik}|${periods[i - 1]}`), b = results.get(`${cik}|${periods[i]}`);
    if (!a || !b) continue;
    newShares.push([...b.holdings].filter(([c]) => !a.holdings.has(c)).reduce((s, [, p]) => s + p.value, 0) / b.total);
  }
  const turnover = newShares.length ? newShares.reduce((x, y) => x + y, 0) / newShares.length : 1;
  if (turnover > 0.5) continue;
  const total = last.total;
  const vals = [...last.holdings.values()];
  const maxWeight = Math.max(...vals.map((p) => p.value)) / total;
  const fundShare = vals.filter((p) => FUND_NAME.test(p.issuer)).reduce((s, p) => s + p.value, 0) / total;
  if (!isSmallStockPicker({ totalValue: total, positions: last.positions, maxWeight, fundShare, quarters: quartersWithHoldings, coverage: coverageSum / returns.length }, periods.length - 1)) continue;
  const stats = trackStats({ returns, bench });
  if (stats.excess == null || stats.excess <= 0 || stats.beat < returns.length / 2) continue;
  ranked.push({ cik, name: last.name, total, positions: last.positions, maxWeight, turnover, stats, series });
}
ranked.sort((a, b) => b.stats.excess! - a.stats.excess!);
const top = ranked.slice(0, TOP);
console.log(`aday: ${ranked.length}, seçilen: ${top.length}`);
for (const f of top) console.log(`${f.name.padEnd(42).slice(0, 42)} ${(f.total / 1e6).toFixed(0).padStart(5)} Mn$ ${String(f.positions).padStart(3)} poz  yıllık %${(f.stats.annual! * 100).toFixed(1)}  SPY %${(f.stats.benchAnnual! * 100).toFixed(1)}  ${f.stats.beat}/${f.stats.quarters}  yeni poz. payı %${(f.turnover * 100).toFixed(0)}`);
writeFileSync(`${DIR}/small-funds-result.json`, JSON.stringify(top.map((f) => ({ ...f, holdings: undefined })), null, 1));
if (DRY) process.exit(0);

// ---- Write: ranking, plus the last three quarters of holdings for the selected funds ----
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) { console.error("Supabase anahtarları gerekli (.env.local)."); process.exit(1); }
const db = createClient(url, secret, { auth: { persistSession: false } });
const { data: run } = await db.from("ingest_runs").insert({ source: "small_funds" }).select("id").single();
try {
  const keep = periods.slice(-3);
  const names = new Map<string, Set<string>>();
  for (const f of top) for (const p of keep) for (const [c, pos] of results.get(`${f.cik}|${p}`)?.holdings ?? []) (names.get(c) ?? names.set(c, new Set()).get(c)!).add(pos.issuer);
  const { cache } = await resolveCusips(db, names, await companyMatcher(db));

  // Drop funds that fell out of the ranking (their holdings too), then write the new ranking.
  const { data: old } = await db.from("small_funds").select("cik");
  const gone = (old ?? []).map((o) => o.cik as number).filter((c) => !top.some((t) => t.cik === c) && !famous.has(c));
  if (gone.length) {
    await db.from("investor_holdings").delete().in("cik", gone);
    await db.from("investor_filings").delete().in("cik", gone);
    await db.from("small_funds").delete().in("cik", gone);
  }
  const { error: se } = await db.from("small_funds").upsert(top.map((f, i) => ({
    cik: f.cik, name: f.name, rank: i + 1, latest_period: latest, total_value: f.total, positions: f.positions, top_weight: f.maxWeight, turnover: f.turnover,
    annual: f.stats.annual, bench_annual: f.stats.benchAnnual, excess: f.stats.excess, vol: f.stats.vol, max_drawdown: f.stats.maxDrawdown,
    beat: f.stats.beat, quarters: f.stats.quarters, series: f.series, updated_at: new Date().toISOString(),
  })), { onConflict: "cik" });
  if (se) throw se;

  let written = 0;
  for (const f of top) {
    await db.from("investor_holdings").delete().eq("cik", f.cik);
    await db.from("investor_filings").delete().eq("cik", f.cik);
    for (const p of keep) {
      const r = results.get(`${f.cik}|${p}`);
      if (!r) continue;
      const { error: fe } = await db.from("investor_filings").insert({ accession: r.acc, cik: f.cik, period: p, filed_at: r.filed, total_value: r.total, positions: r.positions });
      if (fe) throw fe;
      const hold = [...r.holdings].map(([cusip, pos]) => ({ cik: f.cik, period: p, cusip, put_call: "", issuer: pos.issuer, title: null, ticker: cache.get(cusip) ?? null, value: pos.value, shares: pos.shares }));
      const { error: he } = await db.from("investor_holdings").insert(hold);
      if (he) throw he;
      written += hold.length;
    }
  }
  const detail = { scanned, periods, candidates: ranked.length, selected: top.length, holdings: written };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
