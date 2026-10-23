import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwner } from "@/lib/supabase/server";

/**
 * Market data (prices, metrics, news, filings…) is the same for every request and changes only when the
 * scheduled loaders run, so reads are split in two: the exported function verifies the owner on every
 * request, then calls a "use cache" reader that queries with the server-side client. User data
 * (watchlist, portfolios, alerts) never goes through this path.
 */
export async function ownerOnly() {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
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
