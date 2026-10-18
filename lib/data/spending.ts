import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";

export type CompanySpending = { ticker: string; name: string; sector: string | null; amount: number; recipients: string[]; period_start: string; period_end: string };
export type SpendingAction = {
  id: string; action_date: string; recipient_name: string; ticker: string | null; amount: number; agency: string | null;
  sub_agency: string | null; description: string | null; award_url: string | null; company_name: string | null;
};

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
    .select("ticker,amount,recipients,period_start,period_end,companies!inner(name,sector)")
    .order("amount", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.sector) q = q.eq("companies.sector", opts.sector);
  if (opts.tickers) q = q.in("ticker", opts.tickers);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = { ticker: string; amount: number; recipients: string[]; period_start: string; period_end: string; companies: { name: string; sector: string | null } };
  return (data as unknown as Raw[]).map((r) => ({ ticker: r.ticker, name: r.companies.name, sector: r.companies.sector, amount: Number(r.amount),
    recipients: r.recipients, period_start: r.period_start, period_end: r.period_end }));
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

export async function getSpendingActions(opts: { ticker?: string; matchedOnly?: boolean; limit?: number } = {}): Promise<SpendingAction[]> {
  const supabase = await db();
  let q = supabase
    .from("spending_actions")
    .select("id,action_date,recipient_name,ticker,amount,agency,sub_agency,description,award_url,companies(name)")
    .order("amount", { ascending: false })
    .limit(opts.limit ?? 40);
  if (opts.ticker) q = q.eq("ticker", opts.ticker);
  if (opts.matchedOnly) q = q.not("ticker", "is", null);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = Omit<SpendingAction, "company_name"> & { companies: { name: string } | null };
  return (data as unknown as Raw[]).map(({ companies, ...r }) => ({ ...r, amount: Number(r.amount), company_name: companies?.name ?? null }));
}
