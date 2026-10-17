import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export type PricePoint = { date: string; close: number };

/**
 * One year of daily closes straight from Alpaca, for tickers whose bars are not stored in the
 * database (everything outside the core list). Cached for hours; callers must check the owner first.
 */
export async function alpacaDailyCloses(ticker: string): Promise<PricePoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`prices:${ticker}`);

  const id = process.env.ALPACA_API_KEY_ID?.trim();
  const secret = process.env.ALPACA_API_SECRET_KEY?.trim();
  if (!id || !secret) return [];
  const start = new Date(Date.now() - 380 * 864e5).toISOString();
  const end = new Date(Date.now() - 20 * 60e3).toISOString(); // free plan: nothing from the last 15 minutes
  const u = new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(ticker)}/bars`);
  u.search = new URLSearchParams({ timeframe: "1Day", start, end, limit: "10000", feed: "sip", adjustment: "split" }).toString();
  const r = await fetch(u, { headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret } });
  if (!r.ok) return [];
  const j = (await r.json()) as { bars?: { t: string; c: number }[] };
  return (j.bars ?? []).map((b) => ({ date: b.t.slice(0, 10), close: b.c }));
}
