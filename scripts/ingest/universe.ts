// Build public.companies: every exchange-listed US stock and ETF tradable on Alpaca (no OTC, no
// warrants/units/rights/preferreds, no mutual funds), plus the core list (S&P 500 + owner extras).
//   node --env-file=.env.local scripts/ingest/universe.ts
// SIC codes come from SEC submissions and are cached in the table, so only new CIKs are looked up.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "../lib-csv.mjs";
import { sicToSector } from "../../lib/sectors.ts";

const { ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!ALPACA_API_KEY_ID || !ALPACA_API_SECRET_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Alpaca ve Supabase anahtarları gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } });
const SEC = { headers: { "User-Agent": "Kairos personal research (non-commercial)", "Accept-Encoding": "gzip, deflate" } };
const EXCHANGES = new Set(["NASDAQ", "NYSE", "ARCA", "BATS", "AMEX"]);
const EXCLUDE_NAME = /\b(warrants?|rights?|units?|preferred|depositary shares? representing|notes due|debentures|subordinated)\b/i;
const ETF_NAME = /\b(ETF|ETN|ETP|fund|trust|iShares|SPDR|ProShares|Direxion|Invesco QQQ|Vanguard|WisdomTree|VanEck|Global X|Grayscale|Bitcoin|Ether)\b/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Asset = { symbol: string; name: string; exchange: string; tradable: boolean; status: string };
type Row = {
  ticker: string; cik: number | null; name: string; sector: string | null; sub_industry: string | null; added_to_index: string | null;
  in_sp500: boolean; core: boolean; asset_type: "stock" | "etf"; exchange: string; sic: number | null; updated_at: string;
};

const readList = (file: string) => parseCsv(readFileSync(new URL(`../../data/${file}`, import.meta.url), "utf8")) as Record<string, string>[];
const sp500 = readList("sp500-constituents.csv");
const extras = readList("extra-tickers.csv");
const coreRows = new Map<string, Record<string, string>>([...extras, ...sp500].map((c) => [c.Symbol, c]));
const sp500Set = new Set(sp500.map((c) => c.Symbol));

const { data: run } = await db.from("ingest_runs").insert({ source: "universe" }).select("id").single();
try {
  const assetsRes = await fetch("https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity", {
    headers: { "APCA-API-KEY-ID": ALPACA_API_KEY_ID.trim(), "APCA-API-SECRET-KEY": ALPACA_API_SECRET_KEY.trim() },
  });
  if (!assetsRes.ok) throw new Error(`Alpaca assets HTTP ${assetsRes.status}`);
  const assets = ((await assetsRes.json()) as Asset[]).filter(
    (a) => a.tradable && EXCHANGES.has(a.exchange) && !EXCLUDE_NAME.test(a.name ?? "") && (coreRows.has(a.symbol) || !/[./]/.test(a.symbol)),
  );

  const secJson = (await (await fetch("https://www.sec.gov/files/company_tickers_exchange.json", SEC)).json()) as { fields: string[]; data: unknown[][] };
  const cikByTicker = new Map<string, number>();
  for (const r of secJson.data) {
    const rec = Object.fromEntries(secJson.fields.map((f, i) => [f, r[i]])) as { cik: number; ticker: string };
    cikByTicker.set(String(rec.ticker).replace("-", "."), rec.cik);
  }

  // Existing SIC cache.
  const sicCache = new Map<number, number | null>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("cik,sic").not("cik", "is", null).range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) if (r.sic != null) sicCache.set(r.cik, r.sic);
    if (!data || data.length < 1000) break;
  }

  const now = new Date().toISOString();
  const rows: Row[] = [];
  for (const a of assets) {
    const core = coreRows.get(a.symbol);
    const cik = core ? Number(core.CIK) : cikByTicker.get(a.symbol) ?? null;
    const etf = !core && (ETF_NAME.test(a.name) || (!cik && (a.exchange === "ARCA" || a.exchange === "BATS")));
    rows.push({
      ticker: a.symbol, cik: etf ? null : cik, name: core?.Security ?? a.name, sector: core?.["GICS Sector"] ?? null,
      sub_industry: core?.["GICS Sub-Industry"] || null, added_to_index: core && /^\d{4}-\d{2}-\d{2}/.test(core["Date added"] ?? "") ? core["Date added"].slice(0, 10) : null,
      in_sp500: sp500Set.has(a.symbol), core: !!core, asset_type: etf ? "etf" : "stock", exchange: a.exchange, sic: null, updated_at: now,
    });
  }
  // Core tickers Alpaca did not list (rare) are kept from the CSV.
  for (const [ticker, c] of coreRows) {
    if (!rows.some((r) => r.ticker === ticker)) {
      rows.push({ ticker, cik: Number(c.CIK), name: c.Security, sector: c["GICS Sector"], sub_industry: c["GICS Sub-Industry"] || null,
        added_to_index: null, in_sp500: sp500Set.has(ticker), core: true, asset_type: "stock", exchange: "", sic: null, updated_at: now });
    }
  }

  // Look up SIC for stocks with a CIK we have not seen before (~8 requests/s).
  const toFetch = [...new Set(rows.filter((r) => r.cik && !sicCache.has(r.cik)).map((r) => r.cik!))];
  console.log(`evren: ${rows.length} (${rows.filter((r) => r.asset_type === "etf").length} ETF), SIC sorgusu: ${toFetch.length}`);
  for (let i = 0; i < toFetch.length; i++) {
    const cik = toFetch[i];
    for (let attempt = 1; attempt <= 3; attempt++) {
      await sleep(125);
      try {
        const r = await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`, SEC);
        if (r.status === 404) { sicCache.set(cik, null); break; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { sic?: string };
        sicCache.set(cik, j.sic ? Number(j.sic) : null);
        break;
      } catch (e) {
        if (attempt === 3) console.warn(`SIC alınamadı CIK ${cik}: ${(e as Error).message}`);
        await sleep(1000 * attempt);
      }
    }
    if ((i + 1) % 500 === 0) console.log(`  SIC ${i + 1}/${toFetch.length}`);
  }
  for (const r of rows) {
    r.sic = r.cik ? sicCache.get(r.cik) ?? null : null;
    if (!r.core && r.asset_type === "stock") r.sector = sicToSector(r.sic);
  }

  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from("companies").upsert(rows.slice(i, i + 1000), { onConflict: "ticker" });
    if (error) throw error;
  }
  // Drop tickers that left the universe (delisted, moved to OTC); cascades to their prices/metrics.
  const keep = new Set(rows.map((r) => r.ticker));
  const existing: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker").range(from, from + 999);
    if (error) throw error;
    existing.push(...(data ?? []).map((r) => r.ticker));
    if (!data || data.length < 1000) break;
  }
  const stale = existing.filter((t) => !keep.has(t));
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await db.from("companies").delete().in("ticker", stale.slice(i, i + 200));
    if (error) throw error;
  }

  const detail = {
    total: rows.length, core: rows.filter((r) => r.core).length, etf: rows.filter((r) => r.asset_type === "etf").length,
    stocksWithSector: rows.filter((r) => r.asset_type === "stock" && r.sector).length,
    stocksWithoutCik: rows.filter((r) => r.asset_type === "stock" && !r.cik).length, removed: stale.length, sicFetched: toFetch.length,
  };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
