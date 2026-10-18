import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import { fiscalQuarterOf } from "@/lib/spending/trends";

export type CompanySpending = {
  ticker: string; name: string; sector: string | null; amount: number; recipients: string[]; period_start: string; period_end: string;
  amount_lagged: number | null; amount_prev: number | null;
};
export type SpendingAction = {
  id: string; action_date: string; recipient_name: string; ticker: string | null; amount: number; agency: string | null;
  sub_agency: string | null; description: string | null; award_url: string | null; company_name: string | null;
  modification: string | null; award_type: string | null; naics_code: string | null; naics_desc: string | null; psc_code: string | null;
  psc_desc: string | null; total_obligation: number | null; potential_value: number | null; pop_start: string | null; pop_end: string | null;
  place_state: string | null; competition: string | null; offers: number | null;
};
export type SpendingTheme = {
  key: string; quarters: { fy: number; q: number; amount: number }[]; amount_12m: number | null; amount_prev_12m: number | null;
  top_recipients: { name: string; amount: number; ticker: string | null }[]; updated_at: string;
};
export type SpendingIndustry = { naics_code: string; name: string; amount_12m: number | null; amount_prev_12m: number | null };

async function db() {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  return createClient();
}

/** Trailing-12-month federal contract obligations per listed company, largest first. */
export async function getCompanySpending(opts: { sector?: string; tickers?: string[]; limit?: number } = {}): Promise<CompanySpending[]> {
  const supabase = await db();
  let q = supabase
    .from("spending_by_company")
    .select("ticker,amount,amount_lagged,amount_prev,recipients,period_start,period_end,companies!inner(name,sector)")
    .order("amount", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.sector) q = q.eq("companies.sector", opts.sector);
  if (opts.tickers) q = q.in("ticker", opts.tickers);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = Omit<CompanySpending, "name" | "sector"> & { companies: { name: string; sector: string | null } };
  const n = (v: unknown) => (v == null ? null : Number(v));
  return (data as unknown as Raw[]).map((r) => ({ ticker: r.ticker, name: r.companies.name, sector: r.companies.sector, amount: Number(r.amount),
    recipients: r.recipients, period_start: r.period_start, period_end: r.period_end, amount_lagged: n(r.amount_lagged), amount_prev: n(r.amount_prev) }));
}

/** Federal contract totals per sector (matched companies only). */
export async function getSectorSpending(): Promise<Record<string, number>> {
  return (await getSpendingSummary()).bySector;
}

export async function getSpendingSummary(): Promise<{ bySector: Record<string, number>; companies: number; total: number }> {
  const rows = await getCompanySpending({ limit: 1000 });
  const bySector: Record<string, number> = {};
  for (const r of rows) if (r.sector) bySector[r.sector] = (bySector[r.sector] ?? 0) + r.amount;
  return { bySector, companies: rows.length, total: rows.reduce((a, r) => a + r.amount, 0) };
}

const ACTION_SELECT = "id,action_date,recipient_name,ticker,amount,agency,sub_agency,description,award_url,modification,award_type,naics_code,naics_desc,psc_code,psc_desc,total_obligation,potential_value,pop_start,pop_end,place_state,competition,offers,companies(name)";
type RawAction = Omit<SpendingAction, "company_name"> & { companies: { name: string } | null };
const toAction = ({ companies, ...r }: RawAction): SpendingAction => ({
  ...r, amount: Number(r.amount), company_name: companies?.name ?? null,
  total_obligation: r.total_obligation == null ? null : Number(r.total_obligation), potential_value: r.potential_value == null ? null : Number(r.potential_value),
});

export async function getSpendingActions(opts: { ticker?: string; matchedOnly?: boolean; limit?: number; sort?: "date" | "amount"; days?: number } = {}): Promise<SpendingAction[]> {
  const supabase = await db();
  let q = supabase.from("spending_actions").select(ACTION_SELECT);
  q = opts.sort === "date"
    ? q.order("action_date", { ascending: false }).order("amount", { ascending: false })
    : q.order("amount", { ascending: false });
  q = q.limit(opts.limit ?? 40);
  if (opts.ticker) q = q.eq("ticker", opts.ticker);
  if (opts.matchedOnly) q = q.not("ticker", "is", null);
  if (opts.days) q = q.gte("action_date", new Date(Date.now() - opts.days * 864e5).toISOString().slice(0, 10));
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as RawAction[]).map(toAction);
}

export async function getSpendingAction(id: string): Promise<SpendingAction | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("spending_actions").select(ACTION_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toAction(data as unknown as RawAction) : null;
}

export async function getSpendingThemes(): Promise<SpendingTheme[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("spending_themes").select("key,quarters,amount_12m,amount_prev_12m,top_recipients,updated_at");
  if (error) throw error;
  // Drop the fiscal quarter that was still in progress when the data was loaded (it is nearly empty).
  return (data ?? []).map((t) => {
    const now = fiscalQuarterOf(String(t.updated_at).slice(0, 10));
    return { ...t, quarters: (t.quarters as { fy: number; q: number }[]).filter((x) => !(x.fy === now.fy && x.q === now.q)) };
  }).map((t) => ({ ...t, amount_12m: t.amount_12m == null ? null : Number(t.amount_12m), amount_prev_12m: t.amount_prev_12m == null ? null : Number(t.amount_prev_12m) })) as SpendingTheme[];
}

export async function getSpendingIndustries(): Promise<SpendingIndustry[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("spending_industries").select("naics_code,name,amount_12m,amount_prev_12m").order("amount_12m", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, amount_12m: r.amount_12m == null ? null : Number(r.amount_12m), amount_prev_12m: r.amount_prev_12m == null ? null : Number(r.amount_prev_12m) }));
}
