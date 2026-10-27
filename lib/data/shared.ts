import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Market data (prices, metrics, news, filings…) is public and the same for every request; it changes only
 * when the scheduled loaders run. So reads are split in two: the exported function marks the request as
 * dynamic, then calls a "use cache: remote" reader (shared by every serverless instance) that queries with
 * the server-side client. User data (watchlist, portfolios, alerts) never goes through this path: it stays
 * owner-only, checked with getOwner() and row-level security.
 */
export async function publicRead() {
  await connection();
}

/** Call first inside a "use cache" reader: fresh for 5 minutes, refreshed in the background every 15. */
export function marketCache() {
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  cacheTag("market");
}

export function sharedDb() {
  const db = createAdminClient();
  if (!db) throw new Error("SUPABASE_SECRET_KEY eksik");
  return db;
}
