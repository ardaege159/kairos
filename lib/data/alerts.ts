import "server-only";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import type { AlertKind } from "@/lib/alerts/evaluate";

export type AlertRow = { id: string; ticker: string; kind: AlertKind; threshold: number; note: string | null; active: boolean; created_at: string; triggered_at: string | null };
export type NotificationRow = { id: string; ticker: string | null; kind: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null };

async function db() {
  await connection();
  if (!(await getOwner())) return null;
  return createClient();
}

export async function getAlerts(ticker?: string): Promise<AlertRow[]> {
  const supabase = await db();
  if (!supabase) return [];
  let q = supabase.from("alerts").select("id,ticker,kind,threshold,note,active,created_at,triggered_at").order("active", { ascending: false }).order("created_at", { ascending: false });
  if (ticker) q = q.eq("ticker", ticker);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, threshold: Number(a.threshold) })) as AlertRow[];
}

export async function getNotifications(limit = 100): Promise<NotificationRow[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data, error } = await supabase.from("notifications").select("id,ticker,kind,title,body,link,created_at,read_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await db();
  if (!supabase) return 0;
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}
