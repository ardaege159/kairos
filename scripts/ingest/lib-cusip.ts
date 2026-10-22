// CUSIP -> ticker for 13F positions, shared by the famous-investor and small-fund loaders.
// Order: cusip_map cache, OpenFIGI (free, no key: 25 requests a minute, 10 CUSIPs each), then every
// issuer spelling seen for the CUSIP against our company names. Results are cached in cusip_map.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanIssuer, cleanListingName } from "../../lib/investors/thirteenf.ts";
import { buildMatcher } from "../../lib/spending/match.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** OpenFIGI: CUSIP -> US-listed equity ticker ("BRK/B" -> "BRK.B"). Unknown CUSIPs map to null; failed requests are absent. */
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
    await sleep(2600);
  }
  return out;
}

export async function companyMatcher(db: SupabaseClient) {
  const companies: { ticker: string; name: string; in_sp500: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker,name,in_sp500").range(from, from + 999);
    if (error) throw error;
    companies.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  companies.sort((a, b) => Number(b.in_sp500) - Number(a.in_sp500));
  // Listing names carry the security type ("… Common Stock"); 13F names are abbreviated ("… HLDG NV").
  return { known: new Set(companies.map((c) => c.ticker)), match: buildMatcher(companies.map((c) => ({ ticker: c.ticker, name: cleanListingName(c.name) }))) };
}

/** Resolve every CUSIP in `names` (cusip -> issuer spellings). Returns cusip -> ticker (null when unknown). */
export async function resolveCusips(db: SupabaseClient, names: Map<string, Set<string>>, ctx: Awaited<ReturnType<typeof companyMatcher>>) {
  const cusips = [...names.keys()];
  const cache = new Map<string, string | null>();
  const figiUnknown = new Set<string>(); // OpenFIGI already answered "not found": only retry the name match
  for (let i = 0; i < cusips.length; i += 500) {
    const { data, error } = await db.from("cusip_map").select("cusip,ticker,source").in("cusip", cusips.slice(i, i + 500));
    if (error) throw error;
    for (const c of data ?? []) {
      if (c.ticker) cache.set(c.cusip, c.ticker);
      else if (c.source === "none") figiUnknown.add(c.cusip);
    }
  }
  const missing = cusips.filter((c) => !cache.has(c));
  const mapped = await figi(missing.filter((c) => !figiUnknown.has(c)));
  const byName = (c: string) => { for (const n of names.get(c) ?? []) { const m = ctx.match(cleanIssuer(n)); if (m) return m; } return null; };
  const rows = missing.flatMap((c) => {
    const m = mapped.get(c);
    let ticker = m?.ticker && ctx.known.has(m.ticker) ? m.ticker : null;
    let source = ticker ? "openfigi" : null;
    if (!ticker) {
      const hit = byName(c);
      if (hit) { ticker = hit.ticker; source = "name"; }
    }
    cache.set(c, ticker);
    if (!ticker && !m && !figiUnknown.has(c)) return []; // failed request: try again next run
    return [{ cusip: c, ticker, name: m?.name ?? [...(names.get(c) ?? [])][0] ?? null, source: source ?? "none", updated_at: new Date().toISOString() }];
  });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("cusip_map").upsert(rows.slice(i, i + 500), { onConflict: "cusip" });
    if (error) throw error;
  }
  return { cache, newlyMapped: rows.filter((r) => r.ticker) as { cusip: string; ticker: string }[], looked: missing.length };
}
