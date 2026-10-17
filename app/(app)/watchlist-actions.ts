"use server";

import { refresh } from "next/cache";
import { setWatched } from "@/lib/data/watchlist";

export async function toggleWatch(ticker: string, watched: boolean): Promise<void> {
  if (!/^[A-Z0-9.\-]{1,10}$/i.test(ticker)) throw new Error("Geçersiz hisse kodu");
  await setWatched(ticker, watched); // authorises the owner itself
  refresh();
}
