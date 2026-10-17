// Federal contract spending (USAspending API v2, no key) linked to listed companies.
//   node --env-file=.env.local scripts/ingest/spending.ts [--recipients=500] [--actions=500]
//  1. Top contract recipients of the last 12 months, each resolved to its parent company (cached in
//     spending_recipients) and matched to a ticker -> spending_by_company.
//  2. Largest contract actions of the last 30 days -> spending_actions.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildMatcher } from "../../lib/spending/match.ts";

const arg = (name: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? d);
const N_RECIPIENTS = arg("recipients", 500);
const N_ACTIONS = arg("actions", 500);
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

  // --- 1. Top recipients, trailing 12 months ---
  const start = day(-365), end = day(0);
  type Rec = { name: string; amount: number; recipient_id: string | null };
  const recipients: Rec[] = [];
  for (let page = 1; recipients.length < N_RECIPIENTS; page++) {
    const j = await call<{ results: Rec[]; page_metadata: { hasNext: boolean } }>("/search/spending_by_category/recipient/", {
      filters: { award_type_codes: CONTRACTS, time_period: [{ start_date: start, end_date: end }] }, limit: 100, page,
    });
    recipients.push(...j.results);
    if (!j.page_metadata.hasNext) break;
  }

  const { data: cached } = await db.from("spending_recipients").select("recipient_id,name,parent_name");
  const cache = new Map((cached ?? []).map((c) => [c.recipient_id, c]));
  const recipientRows: { recipient_id: string; name: string; parent_name: string | null; ticker: string | null; match_method: string; updated_at: string }[] = [];
  let lookups = 0;
  for (const r of recipients) {
    if (!r.recipient_id) continue;
    let parent = cache.get(r.recipient_id)?.parent_name ?? null;
    if (!cache.has(r.recipient_id)) {
      const d = await call<{ parent_name?: string | null }>(`/recipient/${r.recipient_id}/`).catch(() => ({ parent_name: null }));
      parent = d.parent_name ?? null;
      lookups++;
      await sleep(150);
    }
    const m = (parent ? match(parent) : null) ?? match(r.name);
    recipientRows.push({ recipient_id: r.recipient_id, name: r.name, parent_name: parent, ticker: m?.ticker ?? null, match_method: m?.method ?? "none", updated_at: new Date().toISOString() });
  }
  for (let i = 0; i < recipientRows.length; i += 500) {
    const { error } = await db.from("spending_recipients").upsert(recipientRows.slice(i, i + 500), { onConflict: "recipient_id" });
    if (error) throw error;
  }

  const byTicker = new Map<string, { amount: number; names: Set<string> }>();
  recipients.forEach((r) => {
    const row = recipientRows.find((x) => x.recipient_id === r.recipient_id);
    if (!row?.ticker) return;
    const agg = byTicker.get(row.ticker) ?? { amount: 0, names: new Set<string>() };
    agg.amount += r.amount;
    agg.names.add(r.name);
    byTicker.set(row.ticker, agg);
  });
  const { error: delErr } = await db.from("spending_by_company").delete().neq("ticker", "");
  if (delErr) throw delErr;
  const companyRows = [...byTicker].map(([ticker, a]) => ({
    ticker, amount: a.amount, recipients: [...a.names], period_start: start, period_end: end, updated_at: new Date().toISOString(),
  }));
  if (companyRows.length) {
    const { error } = await db.from("spending_by_company").upsert(companyRows, { onConflict: "ticker" });
    if (error) throw error;
  }

  // --- 2. Largest contract actions, last 30 days ---
  const nameToTicker = new Map(recipientRows.filter((r) => r.ticker).map((r) => [r.name, r.ticker!]));
  type Tx = Record<string, string | number | null>;
  const actions: Tx[] = [];
  for (let page = 1; actions.length < N_ACTIONS; page++) {
    const j = await call<{ results: Tx[]; page_metadata: { hasNext: boolean } }>("/search/spending_by_transaction/", {
      filters: { award_type_codes: CONTRACTS, time_period: [{ start_date: day(-30), end_date: end }] },
      fields: ["Award ID", "Recipient Name", "Action Date", "Transaction Amount", "Awarding Agency", "Awarding Sub Agency", "Transaction Description"],
      limit: 100, page, sort: "Transaction Amount", order: "desc",
    });
    actions.push(...j.results);
    if (!j.page_metadata.hasNext) break;
  }
  const actionRows = actions
    .filter((a) => Number(a["Transaction Amount"]) > 0 && a["Action Date"])
    .map((a) => {
      const name = String(a["Recipient Name"] ?? "");
      const ticker = nameToTicker.get(name) ?? match(name)?.ticker ?? null;
      const gid = String(a.generated_internal_id ?? a["Award ID"] ?? "");
      return {
        id: createHash("sha1").update(`${gid}|${a["Action Date"]}|${a["Transaction Amount"]}`).digest("hex"),
        action_date: String(a["Action Date"]), award_id: a["Award ID"] ? String(a["Award ID"]) : null, recipient_name: name, ticker,
        amount: Number(a["Transaction Amount"]), agency: (a["Awarding Agency"] as string) ?? null, sub_agency: (a["Awarding Sub Agency"] as string) ?? null,
        description: a["Transaction Description"] ? String(a["Transaction Description"]).slice(0, 300) : null,
        award_url: a.generated_internal_id ? `https://www.usaspending.gov/award/${a.generated_internal_id}` : null,
        fetched_at: new Date().toISOString(),
      };
    });
  const uniqActions = [...new Map(actionRows.map((a) => [a.id, a])).values()];
  const { error: oldErr } = await db.from("spending_actions").delete().lt("action_date", day(-45));
  if (oldErr) throw oldErr;
  for (let i = 0; i < uniqActions.length; i += 500) {
    const { error } = await db.from("spending_actions").upsert(uniqActions.slice(i, i + 500), { onConflict: "id" });
    if (error) throw error;
  }

  const matchedAmount = companyRows.reduce((s, r) => s + r.amount, 0);
  const totalAmount = recipients.reduce((s, r) => s + r.amount, 0);
  const detail = {
    recipients: recipients.length, parentLookups: lookups, matchedRecipients: recipientRows.filter((r) => r.ticker).length,
    companies: companyRows.length, matchedShare: Math.round((matchedAmount / totalAmount) * 100) / 100,
    actions: uniqActions.length, actionsMatched: uniqActions.filter((a) => a.ticker).length,
  };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
