import "server-only";
import { marketCache, publicRead, sharedDb } from "./shared";
import { INVESTORS, INVESTOR_BY_CIK, type Investor } from "@/lib/investors/list";
import { compareQuarters, type Change } from "@/lib/investors/thirteenf";
import { sectorName } from "@/lib/sectors";

export type SmallFund = {
  cik: number; name: string; rank: number; latest_period: string; total_value: number; positions: number; top_weight: number | null; turnover: number | null;
  annual: number; bench_annual: number; excess: number; vol: number | null; max_drawdown: number | null; beat: number; quarters: number;
  series: { period: string; r: number; bench: number }[];
};
/** A famous investor from lib/investors/list.ts, or a small fund found by scripts/ingest/small-funds.ts. */
export type AnyInvestor = Investor & { kind: "famous" | "small"; perf?: SmallFund };
export type Holding = { cusip: string; putCall: string; issuer: string; ticker: string | null; value: number; shares: number; weight: number; change: Change; sharesChange: number | null };
export type Filing = { period: string; filed_at: string; total_value: number; positions: number };
export type InvestorPortfolio = { investor: AnyInvestor; filing: Filing | null; previous: Filing | null; holdings: Holding[]; sold: { issuer: string; ticker: string | null; value: number }[] };


const pct = (v: number) => `%${Math.round(v * 100)}`;
/** "MADISON AVENUE PARTNERS, LP" -> "Madison Avenue Partners, LP" (filer names come in capitals). */
function prettyName(name: string) {
  if (name !== name.toUpperCase()) return name.trim();
  return name.trim().toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/\b(Llc|Lp|L\.p\.|Ltd|Inc|Sam|Pte|Hk|Ii|Iii|Llp)\b/g, (w) => w.toUpperCase());
}
function asInvestor(f: SmallFund): AnyInvestor {
  const name = prettyName(f.name);
  return {
    key: `f-${f.cik}`, cik: f.cik, person: name, fund: name, kind: "small", perf: f,
    news: [name.replace(/,?\s+(LLC|LP|L\.P\.|LTD|INC|Pte|HK|SAM)\b.*$/i, "").trim()],
    style: `Son ${f.quarters} çeyrekte bildirdiği pozisyonlarla yıllık yaklaşık ${pct(f.annual)} getiri (aynı yöntemle S&P 500: ${pct(f.bench_annual)}); ${f.beat}/${f.quarters} çeyrekte endeksi geçti. ${f.positions} pozisyonla yoğunlaşmış, yaklaşık ${(f.total_value / 1e6).toFixed(0)} milyon $ büyüklüğünde bir fon.`,
  };
}

const num = (v: unknown) => (v == null ? null : Number(v));
export async function getSmallFunds(): Promise<AnyInvestor[]> {
  await publicRead();
  return getSmallFundsCached();
}

async function getSmallFundsCached(): Promise<AnyInvestor[]> {
  "use cache: remote";
  marketCache();
  const supabase = sharedDb();
  const { data, error } = await supabase.from("small_funds").select("*").order("rank");
  if (error) throw error;
  return (data ?? []).map((r) => asInvestor({
    ...r, total_value: Number(r.total_value), top_weight: num(r.top_weight), turnover: num(r.turnover), annual: Number(r.annual),
    bench_annual: Number(r.bench_annual), excess: Number(r.excess), vol: num(r.vol), max_drawdown: num(r.max_drawdown),
  } as SmallFund));
}
const famous = (): AnyInvestor[] => INVESTORS.map((i) => ({ ...i, kind: "famous" as const }));

type Row = { cik: number; period: string; cusip: string; put_call: string; issuer: string; ticker: string | null; value: number; shares: number };

async function loadHoldings(ciks: number[]) {
  await publicRead();
  return loadHoldingsCached(ciks);
}

async function loadHoldingsCached(ciks: number[]) {
  "use cache: remote";
  marketCache();
  const supabase = sharedDb();
  const [{ data: filings, error: fe }, holdings] = await Promise.all([
    supabase.from("investor_filings").select("cik,period,filed_at,total_value,positions").in("cik", ciks).order("period", { ascending: false }),
    (async () => {
      const out: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("investor_holdings").select("cik,period,cusip,put_call,issuer,ticker,value,shares").in("cik", ciks).range(from, from + 999);
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

function portfolio(inv: AnyInvestor, filings: (Filing & { cik: number })[], holdings: Row[]): InvestorPortfolio {
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

/** Latest portfolios with changes against the previous quarter: famous investors or small funds. */
export async function getInvestorPortfolios(kind: "famous" | "small" = "famous"): Promise<InvestorPortfolio[]> {
  const list = kind === "famous" ? famous() : await getSmallFunds();
  const { filings, holdings } = await loadHoldings(list.map((i) => i.cik));
  return list.map((inv) => portfolio(inv, filings, holdings));
}

export async function getInvestorPortfolio(key: string): Promise<InvestorPortfolio | null> {
  const inv = key.startsWith("f-") ? (await getSmallFunds()).find((f) => f.key === key) : famous().find((i) => i.key === key);
  if (!inv) return null;
  const { filings, holdings } = await loadHoldings([inv.cik]);
  return portfolio(inv, filings, holdings);
}

/** Share of a portfolio per sector (by ticker; unmatched and non-stock positions are "Diğer"). */
export async function sectorMix(holdings: Holding[]): Promise<{ sector: string; weight: number }[]> {
  await publicRead();
  return sectorMixCached(holdings);
}

async function sectorMixCached(holdings: Holding[]): Promise<{ sector: string; weight: number }[]> {
  "use cache: remote";
  marketCache();
  const tickers = [...new Set(holdings.map((h) => h.ticker).filter((t): t is string => !!t))];
  const supabase = sharedDb();
  const sectors = new Map<string, string | null>();
  for (let i = 0; i < tickers.length; i += 300) {
    const { data, error } = await supabase.from("companies").select("ticker,sector,asset_type").in("ticker", tickers.slice(i, i + 300));
    if (error) throw error;
    for (const c of data ?? []) sectors.set(c.ticker, c.asset_type === "etf" ? "ETF" : c.sector);
  }
  const by = new Map<string, number>();
  for (const h of holdings) {
    if (h.putCall) continue;
    const s = h.ticker ? sectors.get(h.ticker) : null;
    const label = s === "ETF" ? "ETF'ler" : s ? sectorName(s) : "Diğer";
    by.set(label, (by.get(label) ?? 0) + h.weight);
  }
  return [...by].map(([sector, weight]) => ({ sector, weight })).sort((a, b) => b.weight - a.weight);
}

export type HolderOf = { investor: AnyInvestor; period: string; value: number; weight: number; change: Change; sharesChange: number | null };

/** Famous investors and ranked small funds holding a ticker (common stock) in their latest filing. */
export async function getHoldersOf(ticker: string): Promise<HolderOf[]> {
  await publicRead();
  return getHoldersOfCached(ticker);
}

async function getHoldersOfCached(ticker: string): Promise<HolderOf[]> {
  "use cache: remote";
  marketCache();
  const supabase = sharedDb();
  const [{ data: rows, error }, { data: filings, error: fe }, small] = await Promise.all([
    supabase.from("investor_holdings").select("cik,period,cusip,put_call,shares,value").eq("ticker", ticker).eq("put_call", ""),
    supabase.from("investor_filings").select("cik,period,total_value").order("period", { ascending: false }),
    getSmallFundsCached(),
  ]);
  if (error) throw error;
  if (fe) throw fe;
  const out: HolderOf[] = [];
  for (const inv of [...famous(), ...small]) {
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
