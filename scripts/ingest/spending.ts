// Federal contract spending (USAspending API v2, no key) linked to listed companies.
//   node --env-file=.env.local scripts/ingest/spending.ts [--recipients=500] [--actions=500] [--details=300]
//  1. Top contract recipients of the last 12 months, each resolved to its parent company (cached in
//     spending_recipients) and matched to a ticker -> spending_by_company. Two older, fully reported
//     windows give the year-over-year growth (DoD reports ~90 days late, so recent months look low).
//  2. Largest contract actions of the last 30 days, with award details -> spending_actions.
//  3. Theme trends (keyword search, fiscal quarters) -> spending_themes.
//  4. Industry (NAICS) totals for the same two windows -> spending_industries.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildMatcher } from "../../lib/spending/match.ts";
import { THEMES } from "../../lib/spending/themes.ts";

const arg = (name: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? d);
const N_RECIPIENTS = arg("recipients", 500);
const N_ACTIONS = arg("actions", 500);
const N_DETAILS = arg("details", 300);
const { NEXT_PUBLIC_SUPABASE_URL: url } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.error("Supabase anahtarları gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const API = "https://api.usaspending.gov/api/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const CONTRACTS = ["A", "B", "C", "D"];
const LAG = 90; // days of reporting lag excluded from growth windows

async function call<T>(path: string, body?: unknown): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`${API}${path}`, body
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : undefined);
      if (r.ok) return (await r.json()) as T;
      if (r.status < 500 && r.status !== 429) throw new Error(`USAspending HTTP ${r.status} ${path}`);
    } catch (e) {
      if (attempt === 4) throw e;
    }
    await sleep(1500 * attempt);
  }
  throw new Error("USAspending: tekrar denemeler tükendi");
}

type Rec = { name: string; amount: number; recipient_id: string | null };
async function topRecipients(start: string, end: string, n: number, keywords?: string[]): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let page = 1; out.length < n; page++) {
    const j = await call<{ results: Rec[]; page_metadata: { hasNext: boolean } }>("/search/spending_by_category/recipient/", {
      filters: { award_type_codes: CONTRACTS, time_period: [{ start_date: start, end_date: end }], ...(keywords ? { keywords } : {}) },
      limit: Math.min(100, n), page,
    });
    out.push(...j.results);
    if (!j.page_metadata.hasNext) break;
  }
  return out.slice(0, n);
}

const { data: run } = await db.from("ingest_runs").insert({ source: "usaspending" }).select("id").single();
try {
  const companies: { ticker: string; name: string; in_sp500: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker,name,in_sp500").eq("asset_type", "stock").range(from, from + 999);
    if (error) throw error;
    companies.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // S&P 500 names first so share-class duplicates and big parents win ties.
  companies.sort((a, b) => Number(b.in_sp500) - Number(a.in_sp500));
  const match = buildMatcher(companies);

  // Recipient -> parent -> ticker, with parents cached across runs.
  const { data: cached } = await db.from("spending_recipients").select("recipient_id,name,parent_name");
  const cache = new Map((cached ?? []).map((c) => [c.recipient_id, c.parent_name as string | null]));
  const resolved = new Map<string, { recipient_id: string; name: string; parent_name: string | null; ticker: string | null; match_method: string; updated_at: string }>();
  let lookups = 0;
  async function tickerOf(r: Rec): Promise<string | null> {
    if (!r.recipient_id) return match(r.name)?.ticker ?? null;
    const hit = resolved.get(r.recipient_id);
    if (hit) return hit.ticker;
    let parent = cache.get(r.recipient_id) ?? null;
    if (!cache.has(r.recipient_id)) {
      const d = await call<{ parent_name?: string | null }>(`/recipient/${r.recipient_id}/`).catch(() => ({ parent_name: null }));
      parent = d.parent_name ?? null;
      cache.set(r.recipient_id, parent);
      lookups++;
      await sleep(150);
    }
    const m = (parent ? match(parent) : null) ?? match(r.name);
    resolved.set(r.recipient_id, { recipient_id: r.recipient_id, name: r.name, parent_name: parent, ticker: m?.ticker ?? null, match_method: m?.method ?? "none", updated_at: new Date().toISOString() });
    return m?.ticker ?? null;
  }
  async function byTicker(recs: Rec[]) {
    const out = new Map<string, { amount: number; names: Set<string> }>();
    for (const r of recs) {
      const t = await tickerOf(r);
      if (!t) continue;
      const agg = out.get(t) ?? { amount: 0, names: new Set<string>() };
      agg.amount += r.amount;
      agg.names.add(r.name);
      out.set(t, agg);
    }
    return out;
  }

  // --- 1. Companies: last 12 months, plus two fully reported windows for growth ---
  const start = day(-365), end = day(0);
  const lagStart = day(-365 - LAG), lagEnd = day(-LAG), prevStart = day(-730 - LAG), prevEnd = day(-365 - LAG - 1);
  const recipients = await topRecipients(start, end, N_RECIPIENTS);
  const current = await byTicker(recipients);
  const lagged = await byTicker(await topRecipients(lagStart, lagEnd, N_RECIPIENTS));
  const previous = await byTicker(await topRecipients(prevStart, prevEnd, N_RECIPIENTS));

  const { error: delErr } = await db.from("spending_by_company").delete().neq("ticker", "");
  if (delErr) throw delErr;
  const companyRows = [...current].map(([ticker, a]) => ({
    ticker, amount: a.amount, recipients: [...a.names], period_start: start, period_end: end,
    amount_lagged: lagged.get(ticker)?.amount ?? null, amount_prev: previous.get(ticker)?.amount ?? null, prev_start: prevStart, prev_end: prevEnd,
    updated_at: new Date().toISOString(),
  }));
  if (companyRows.length) {
    const { error } = await db.from("spending_by_company").upsert(companyRows, { onConflict: "ticker" });
    if (error) throw error;
  }

  // --- 2. Largest contract actions, last 30 days, with award details ---
  const nameToTicker = new Map([...resolved.values()].filter((r) => r.ticker).map((r) => [r.name, r.ticker!]));
  type Tx = Record<string, string | number | null>;
  const actions: Tx[] = [];
  for (let page = 1; actions.length < N_ACTIONS; page++) {
    const j = await call<{ results: Tx[]; page_metadata: { hasNext: boolean } }>("/search/spending_by_transaction/", {
      filters: { award_type_codes: CONTRACTS, time_period: [{ start_date: day(-30), end_date: end }] },
      fields: ["Award ID", "Recipient Name", "Action Date", "Transaction Amount", "Awarding Agency", "Awarding Sub Agency", "Transaction Description",
        "Mod", "naics_code", "naics_description", "product_or_service_code", "product_or_service_description"],
      limit: 100, page, sort: "Transaction Amount", order: "desc",
    });
    actions.push(...j.results);
    if (!j.page_metadata.hasNext) break;
  }
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  const actionRows = actions
    .filter((a) => Number(a["Transaction Amount"]) > 0 && a["Action Date"])
    .map((a) => {
      const name = String(a["Recipient Name"] ?? "");
      const ticker = nameToTicker.get(name) ?? match(name)?.ticker ?? null;
      const gid = String(a.generated_internal_id ?? a["Award ID"] ?? "");
      return {
        id: createHash("sha1").update(`${gid}|${a["Action Date"]}|${a["Transaction Amount"]}`).digest("hex"),
        action_date: String(a["Action Date"]), award_id: str(a["Award ID"]), recipient_name: name, ticker,
        amount: Number(a["Transaction Amount"]), agency: str(a["Awarding Agency"]), sub_agency: str(a["Awarding Sub Agency"]),
        description: a["Transaction Description"] ? String(a["Transaction Description"]).slice(0, 300) : null,
        award_url: a.generated_internal_id ? `https://www.usaspending.gov/award/${a.generated_internal_id}` : null,
        generated_id: str(a.generated_internal_id), modification: str(a.Mod),
        naics_code: str(a.naics_code), naics_desc: str(a.naics_description), psc_code: str(a.product_or_service_code), psc_desc: str(a.product_or_service_description),
        fetched_at: new Date().toISOString(),
      };
    });
  const uniqActions = [...new Map(actionRows.map((a) => [a.id, a])).values()];

  // Award details (type, total and potential value, period, competition) for actions not yet detailed;
  // matched companies first. Cached on the row, so later runs only fetch new actions.
  const { data: detailed } = await db.from("spending_actions").select("id").not("award_type", "is", null);
  const done = new Set((detailed ?? []).map((d) => d.id));
  const need = uniqActions.filter((a) => a.generated_id && !done.has(a.id)).sort((a, b) => Number(!!b.ticker) - Number(!!a.ticker) || b.amount - a.amount).slice(0, N_DETAILS);
  type Award = {
    type_description?: string; total_obligation?: number; base_and_all_options?: number;
    period_of_performance?: { start_date?: string; end_date?: string; potential_end_date?: string };
    place_of_performance?: { state_name?: string; country_name?: string };
    latest_transaction_contract_data?: { extent_competed_description?: string; number_of_offers_received?: string | number | null };
  };
  const details = new Map<string, Record<string, unknown>>();
  for (const a of need) {
    const d = await call<Award>(`/awards/${a.generated_id}/`).catch(() => null);
    await sleep(120);
    if (!d) continue;
    const pop = d.period_of_performance ?? {};
    details.set(a.id, {
      award_type: d.type_description ?? "—", total_obligation: d.total_obligation ?? null, potential_value: d.base_and_all_options ?? null,
      pop_start: pop.start_date?.slice(0, 10) ?? null, pop_end: (pop.potential_end_date ?? pop.end_date)?.slice(0, 10) ?? null,
      place_state: d.place_of_performance?.state_name ?? d.place_of_performance?.country_name ?? null,
      competition: d.latest_transaction_contract_data?.extent_competed_description ?? null,
      offers: Number(d.latest_transaction_contract_data?.number_of_offers_received) || null,
    });
  }
  const withDetails = uniqActions.map((a) => ({ ...a, ...(details.get(a.id) ?? {}) }));
  const { error: oldErr } = await db.from("spending_actions").delete().lt("action_date", day(-90));
  if (oldErr) throw oldErr;
  for (let i = 0; i < withDetails.length; i += 200) {
    // Rows that already have details keep them: upsert only the columns we have for each row.
    const chunk = withDetails.slice(i, i + 200);
    const fresh = chunk.filter((a) => done.has(a.id) === false);
    const known = chunk.filter((a) => done.has(a.id)).map(({ id, ticker, fetched_at }) => ({ id, ticker, fetched_at }));
    if (fresh.length) {
      const { error } = await db.from("spending_actions").upsert(fresh, { onConflict: "id" });
      if (error) throw error;
    }
    for (const k of known) {
      const { error } = await db.from("spending_actions").update({ ticker: k.ticker, fetched_at: k.fetched_at }).eq("id", k.id);
      if (error) throw error;
    }
  }

  // --- 3. Themes: fiscal-quarter series and the largest recipients ---
  const now = new Date();
  const fy = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const seriesStart = `${fy - 3}-10-01`; // three full fiscal years back plus the current one
  const themeRows = [];
  for (const t of THEMES) {
    const s = await call<{ results: { aggregated_amount: number; time_period: { fiscal_year: string; quarter: string } }[] }>("/search/spending_over_time/", {
      group: "quarter", filters: { award_type_codes: CONTRACTS, keywords: t.keywords, time_period: [{ start_date: seriesStart, end_date: end }] },
    });
    const quarters = s.results.map((r) => ({ fy: Number(r.time_period.fiscal_year), q: Number(r.time_period.quarter), amount: r.aggregated_amount }))
      .sort((a, b) => a.fy - b.fy || a.q - b.q);
    const recs = await topRecipients(start, end, 12, t.keywords);
    const top = [];
    for (const r of recs) top.push({ name: r.name, amount: r.amount, ticker: await tickerOf(r) });
    const [amount12m, amountPrev] = await Promise.all([lagStart, prevStart].map((s0, i) =>
      call<{ results: { aggregated_amount: number }[] }>("/search/spending_over_time/", {
        group: "fiscal_year", filters: { award_type_codes: CONTRACTS, keywords: t.keywords, time_period: [{ start_date: s0, end_date: i === 0 ? lagEnd : prevEnd }] },
      }).then((j) => j.results.reduce((sum, x) => sum + x.aggregated_amount, 0))));
    themeRows.push({ key: t.key, quarters, amount_12m: amount12m, amount_prev_12m: amountPrev, top_recipients: top, updated_at: new Date().toISOString() });
    await sleep(300);
  }
  const { error: themeErr } = await db.from("spending_themes").upsert(themeRows, { onConflict: "key" });
  if (themeErr) throw themeErr;

  // --- 4. Industries (NAICS), same two fully reported windows ---
  type Cat = { code: string; name: string; amount: number };
  const naics = async (s0: string, e0: string) => {
    const out: Cat[] = [];
    for (let page = 1; page <= 2; page++) {
      const j = await call<{ results: Cat[]; page_metadata: { hasNext: boolean } }>("/search/spending_by_category/naics/", {
        filters: { award_type_codes: CONTRACTS, time_period: [{ start_date: s0, end_date: e0 }] }, limit: 100, page,
      });
      out.push(...j.results);
      if (!j.page_metadata.hasNext) break;
    }
    return out;
  };
  const [curNaics, prevNaics] = [await naics(lagStart, lagEnd), await naics(prevStart, prevEnd)];
  const prevMap = new Map(prevNaics.map((c) => [c.code, c.amount]));
  const industryRows = curNaics.filter((c) => c.code).map((c) => ({
    naics_code: c.code, name: c.name, amount_12m: c.amount, amount_prev_12m: prevMap.get(c.code) ?? null, updated_at: new Date().toISOString(),
  }));
  await db.from("spending_industries").delete().neq("naics_code", "");
  const { error: indErr } = await db.from("spending_industries").upsert(industryRows, { onConflict: "naics_code" });
  if (indErr) throw indErr;

  const recipientRows = [...resolved.values()];
  for (let i = 0; i < recipientRows.length; i += 500) {
    const { error } = await db.from("spending_recipients").upsert(recipientRows.slice(i, i + 500), { onConflict: "recipient_id" });
    if (error) throw error;
  }

  const matchedAmount = companyRows.reduce((s, r) => s + r.amount, 0);
  const totalAmount = recipients.reduce((s, r) => s + r.amount, 0);
  const detail = {
    recipients: recipients.length, parentLookups: lookups, matchedRecipients: recipientRows.filter((r) => r.ticker).length,
    companies: companyRows.length, withGrowth: companyRows.filter((r) => r.amount_lagged && r.amount_prev).length,
    matchedShare: Math.round((matchedAmount / totalAmount) * 100) / 100,
    actions: uniqActions.length, actionsMatched: uniqActions.filter((a) => a.ticker).length, awardDetails: details.size,
    themes: themeRows.length, industries: industryRows.length,
  };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
