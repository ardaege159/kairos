import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import { INVESTORS, INVESTOR_BY_CIK, type Investor } from "@/lib/investors/list";
import { compareQuarters, type Change } from "@/lib/investors/thirteenf";

export type Holding = { cusip: string; putCall: string; issuer: string; ticker: string | null; value: number; shares: number; weight: number; change: Change; sharesChange: number | null };
export type Filing = { period: string; filed_at: string; total_value: number; positions: number };
export type InvestorPortfolio = { investor: Investor; filing: Filing | null; previous: Filing | null; holdings: Holding[]; sold: { issuer: string; ticker: string | null; value: number }[] };

async function db() {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  return createClient();
}

type Row = { cik: number; period: string; cusip: string; put_call: string; issuer: string; ticker: string | null; value: number; shares: number };

async function loadAll() {
  const supabase = await db();
  const [{ data: filings, error: fe }, holdings] = await Promise.all([
    supabase.from("investor_filings").select("cik,period,filed_at,total_value,positions").order("period", { ascending: false }),
    (async () => {
      const out: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("investor_holdings").select("cik,period,cusip,put_call,issuer,ticker,value,shares").range(from, from + 999);
        if (error) throw error;
        out.push(...((data ?? []) as Row[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    })(),
  ]);
  if (fe) throw fe;
  return { filings: (filings ?? []).map((f) => ({ ...f, total_value: Number(f.total_value) })), holdings: holdings.map((h) => ({ ...h, value: Number(h.value), shares: Number(h.shares) })) };
}

function portfolio(inv: Investor, filings: (Filing & { cik: number })[], holdings: Row[]): InvestorPortfolio {
  const fs = filings.filter((f) => f.cik === inv.cik);
  const [filing, previous] = [fs[0] ?? null, fs[1] ?? null];
  if (!filing) return { investor: inv, filing: null, previous: null, holdings: [], sold: [] };
  const cur = holdings.filter((h) => h.cik === inv.cik && h.period === filing.period).map((h) => ({ ...h, putCall: h.put_call }));
  const prev = previous ? holdings.filter((h) => h.cik === inv.cik && h.period === previous.period).map((h) => ({ ...h, putCall: h.put_call })) : null;
  const { rows, sold } = compareQuarters(cur, prev);
  const total = filing.total_value || 1;
  return {
    investor: inv, filing, previous,
    holdings: rows.map((r) => ({ cusip: r.cusip, putCall: r.putCall, issuer: r.issuer, ticker: r.ticker, value: r.value, shares: r.shares, weight: r.value / total, change: r.change, sharesChange: r.sharesChange }))
      .sort((a, b) => b.value - a.value),
    sold: sold.map((s) => ({ issuer: s.issuer, ticker: s.ticker, value: s.value })).sort((a, b) => b.value - a.value),
  };
}

/** Every investor's latest portfolio with changes against the previous quarter. */
export async function getInvestorPortfolios(): Promise<InvestorPortfolio[]> {
  const { filings, holdings } = await loadAll();
  return INVESTORS.map((inv) => portfolio(inv, filings, holdings));
}

export async function getInvestorPortfolio(key: string): Promise<InvestorPortfolio | null> {
  const inv = INVESTORS.find((i) => i.key === key);
  if (!inv) return null;
  const supabase = await db();
  const [{ data: filings, error: fe }, { data: rows, error: he }] = await Promise.all([
    supabase.from("investor_filings").select("cik,period,filed_at,total_value,positions").eq("cik", inv.cik).order("period", { ascending: false }),
    supabase.from("investor_holdings").select("cik,period,cusip,put_call,issuer,ticker,value,shares").eq("cik", inv.cik).limit(5000),
  ]);
  if (fe) throw fe;
  if (he) throw he;
  return portfolio(inv, (filings ?? []).map((f) => ({ ...f, total_value: Number(f.total_value) })), ((rows ?? []) as Row[]).map((h) => ({ ...h, value: Number(h.value), shares: Number(h.shares) })));
}

export type HolderOf = { investor: Investor; period: string; value: number; weight: number; change: Change; sharesChange: number | null };

/** Famous investors holding a ticker (common stock, not options) in their latest filing. */
export async function getHoldersOf(ticker: string): Promise<HolderOf[]> {
  const supabase = await db();
  const [{ data: rows, error }, { data: filings, error: fe }] = await Promise.all([
    supabase.from("investor_holdings").select("cik,period,cusip,put_call,shares,value").eq("ticker", ticker).eq("put_call", ""),
    supabase.from("investor_filings").select("cik,period,total_value").order("period", { ascending: false }),
  ]);
  if (error) throw error;
  if (fe) throw fe;
  const out: HolderOf[] = [];
  for (const inv of INVESTORS) {
    const fs = (filings ?? []).filter((f) => f.cik === inv.cik);
    if (!fs.length) continue;
    const [latest, prev] = fs;
    const cur = (rows ?? []).filter((r) => r.cik === inv.cik && r.period === latest.period);
    if (!cur.length) continue;
    const shares = cur.reduce((s, r) => s + Number(r.shares), 0);
    const value = cur.reduce((s, r) => s + Number(r.value), 0);
    const before = prev ? (rows ?? []).filter((r) => r.cik === inv.cik && r.period === prev.period).reduce((s, r) => s + Number(r.shares), 0) : null;
    const ch = before == null ? null : before === 0 ? null : shares / before - 1;
    const change: Change = !prev ? "ayni" : !before ? "yeni" : ch! > 0.01 ? "artirdi" : ch! < -0.01 ? "azaltti" : "ayni";
    out.push({ investor: inv, period: latest.period, value, weight: value / Number(latest.total_value || 1), change, sharesChange: ch });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

export { INVESTOR_BY_CIK };
