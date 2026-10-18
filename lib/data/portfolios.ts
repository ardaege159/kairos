import "server-only";
import { connection } from "next/server";
import { classifyEtf } from "@/lib/etf";
import { assessRisk, holdings, valueHistory, type AssetInfo, type Position, type Series } from "@/lib/portfolio/analytics";
import { createClient, getOwner } from "@/lib/supabase/server";
import { getPrices, getStocks, type StockRow } from "./stocks";

export type Portfolio = { id: string; name: string; note: string | null; created_at: string; positions: (Position & { id: string })[] };

async function db() {
  await connection();
  const owner = await getOwner();
  if (!owner) throw new Error("Yetkisiz erişim");
  return { supabase: await createClient(), owner };
}

const SELECT = "id,name,note,created_at,portfolio_positions(id,ticker,shares,buy_price,buy_date)";
type Raw = Omit<Portfolio, "positions"> & { portfolio_positions: (Position & { id: string })[] };
const toPortfolio = ({ portfolio_positions, ...p }: Raw): Portfolio => ({
  ...p,
  positions: portfolio_positions.map((x) => ({ ...x, shares: Number(x.shares), buy_price: Number(x.buy_price) })).sort((a, b) => a.buy_date.localeCompare(b.buy_date)),
});

export async function listPortfolios(): Promise<Portfolio[]> {
  const { supabase } = await db();
  const { data, error } = await supabase.from("portfolios").select(SELECT).order("created_at");
  if (error) throw error;
  return (data as unknown as Raw[]).map(toPortfolio);
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { supabase } = await db();
  const { data, error } = await supabase.from("portfolios").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toPortfolio(data as unknown as Raw) : null;
}

/** Speculative = leveraged/inverse or crypto ETF, or a loss-making company. */
export function assetInfo(s: StockRow): AssetInfo {
  const cat = s.asset_type === "etf" ? classifyEtf(s.name)?.key : null;
  return {
    sector: s.sector,
    asset_type: s.asset_type,
    speculative: cat === "kaldirac" || cat === "kripto" || (s.asset_type === "stock" && (s.metrics.net_margin ?? 0) < 0),
  };
}

/** Everything a portfolio page needs: holdings with live prices, value history and the risk report. */
export async function analyze(positions: Position[]) {
  const tickers = [...new Set(positions.map((p) => p.ticker))];
  const stocks = await getStocks(tickers);
  const byTicker = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const [series, spy] = await Promise.all([
    Promise.all(stocks.map((s) => getPrices(s.ticker, s.core))).then((all) => Object.fromEntries(stocks.map((s, i) => [s.ticker, all[i] as Series]))),
    getPrices("SPY", false),
  ]);
  const h = holdings(positions, Object.fromEntries(stocks.map((s) => [s.ticker, s.price])));
  const weights: Record<string, number> = {};
  for (const r of h.rows) weights[r.ticker] = (weights[r.ticker] ?? 0) + r.weight;
  const risk = tickers.length
    ? assessRisk({ weights, series, benchmark: spy, info: Object.fromEntries(stocks.map((s) => [s.ticker, assetInfo(s)])) })
    : null;
  return { stocks: byTicker, holdings: h, history: valueHistory(positions, series), risk, spy };
}
