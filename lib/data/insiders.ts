import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import type { InsiderTrade } from "@/lib/insiders/parse";

export type InsiderRow = InsiderTrade & { id: string; ticker: string; filed_at: string; accession: string };

async function db() {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  return createClient();
}
const SELECT = "id,accession,ticker,filed_at,trade_date,owner,role,code,acquired,shares,price,value,owned_after,plan";
type Raw = Omit<InsiderRow, "date"> & { trade_date: string };
const toRow = ({ trade_date, ...r }: Raw): InsiderRow => ({
  ...r, date: trade_date, shares: Number(r.shares), price: r.price == null ? null : Number(r.price),
  value: r.value == null ? null : Number(r.value), owned_after: r.owned_after == null ? null : Number(r.owned_after),
});
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/** Every Form 4 transaction for a ticker in the last `days` days, newest first. */
export async function getInsiderTrades(ticker: string, days = 180): Promise<InsiderRow[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("insider_trades").select(SELECT).eq("ticker", ticker).gte("trade_date", daysAgo(days))
    .order("trade_date", { ascending: false }).limit(300);
  if (error) throw error;
  return (data as Raw[]).map(toRow);
}

/** Open-market insider purchases across the universe, largest first. */
export async function getRecentInsiderBuys(days = 30, minValue = 100_000, limit = 15): Promise<InsiderRow[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("insider_trades").select(SELECT).eq("code", "P").gte("trade_date", daysAgo(days)).gte("value", minValue)
    .order("value", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as Raw[]).map(toRow);
}
