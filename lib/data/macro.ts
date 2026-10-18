import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import { MACRO, macroView, type MacroView, type Obs } from "@/lib/macro/series";

/** One raw series (e.g. "USDTRY"), oldest first. */
export async function getSeries(id: string): Promise<{ date: string; close: number }[]> {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  const supabase = await createClient();
  const { data, error } = await supabase.from("macro_observations").select("date,value").eq("series_id", id).order("date").limit(5000);
  if (error) throw error;
  return (data ?? []).map((r) => ({ date: r.date, close: Number(r.value) }));
}

/** Every macro series with its transform, recent changes and reading applied. */
export async function getMacro(): Promise<MacroView[]> {
  await connection();
  if (!(await getOwner())) throw new Error("Yetkisiz erişim");
  const supabase = await createClient();
  const rows: { series_id: string; date: string; value: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("macro_observations").select("series_id,date,value").order("series_id").order("date").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const by = new Map<string, Obs[]>();
  for (const r of rows) by.set(r.series_id, [...(by.get(r.series_id) ?? []), { date: r.date, value: Number(r.value) }]);
  return MACRO.map((def) => macroView(def, by.get(def.id) ?? []));
}
