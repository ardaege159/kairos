import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export type PricePoint = { date: string; close: number };

/**
 * One year of daily closes straight from Alpaca, for tickers whose bars are not stored in the
 * database (everything outside the core list). Cached for hours; callers must check the owner first.
 */
export async function alpacaDailyCloses(ticker: string): Promise<PricePoint[]> {
  return alpacaCloses(ticker, 380);
}

/** Daily closes for the last `days` calendar days (e.g. ~3 years for valuation history). Cached. */
export async function alpacaCloses(ticker: string, days: number): Promise<PricePoint[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(`prices:${ticker}`);

  const id = process.env.ALPACA_API_KEY_ID?.trim();
  const secret = process.env.ALPACA_API_SECRET_KEY?.trim();
  if (!id || !secret) return [];
  const start = new Date(Date.now() - days * 864e5).toISOString();
  const end = new Date(Date.now() - 20 * 60e3).toISOString(); // free plan: nothing from the last 15 minutes
  const u = new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(ticker)}/bars`);
  u.search = new URLSearchParams({ timeframe: "1Day", start, end, limit: "10000", feed: "sip", adjustment: "split,spin-off" }).toString();
  const r = await fetch(u, { headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret } });
  if (!r.ok) return [];
  const j = (await r.json()) as { bars?: { t: string; c: number }[] };
  return (j.bars ?? []).map((b) => ({ date: b.t.slice(0, 10), close: b.c }));
}
