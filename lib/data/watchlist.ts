import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";

/** Tickers on the owner's watchlist, newest first. RLS limits rows to the signed-in owner. */
export async function getWatchlist(): Promise<string[]> {
  await connection();
  if (!(await getOwner())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("watchlist").select("ticker").order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.ticker);
}

export async function setWatched(ticker: string, watched: boolean): Promise<void> {
  const owner = await getOwner();
  if (!owner) throw new Error("Yetkisiz erişim");
  const supabase = await createClient();
  const t = ticker.toUpperCase();
  const { error } = watched
    ? await supabase.from("watchlist").upsert({ user_id: owner.id, ticker: t }, { onConflict: "user_id,ticker", ignoreDuplicates: true })
    : await supabase.from("watchlist").delete().eq("user_id", owner.id).eq("ticker", t);
  if (error) throw error;
}
