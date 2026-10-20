import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for background work that runs outside the request (Next.js `after()`), where the
 * owner's cookies cannot be read. Server-only; callers must already have verified the owner.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
