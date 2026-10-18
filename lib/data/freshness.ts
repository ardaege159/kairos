import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";

// ingest_runs.source values grouped into what the owner cares about.
const GROUPS = {
  prices: { label: "Fiyatlar", sources: ["alpaca_bars", "compute_metrics"] },
  fundamentals: { label: "Bilançolar", sources: ["sec_frames"] },
  news: { label: "Haberler", sources: ["news"] },
  calendar: { label: "Takvim", sources: ["calendars"] },
  spending: { label: "Federal harcamalar", sources: ["usaspending"] },
  macro: { label: "Makro", sources: ["macro"] },
} as const;
export type FreshnessKey = keyof typeof GROUPS;
export type Freshness = { key: FreshnessKey; label: string; at: string | null }[];

/** Last successful run per data group, newest first within each group. */
export async function getFreshness(): Promise<Freshness> {
  await connection();
  if (!(await getOwner())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("source,finished_at")
    .eq("status", "ok")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (Object.keys(GROUPS) as FreshnessKey[]).map((key) => {
    const g = GROUPS[key];
    const hit = (data ?? []).find((r) => (g.sources as readonly string[]).includes(r.source));
    return { key, label: g.label, at: hit?.finished_at ?? null };
  });
}
