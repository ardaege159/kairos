"use server";

import { refresh } from "next/cache";
import { createClient, getOwner } from "@/lib/supabase/server";
import { ALERT_LABEL, type AlertKind } from "@/lib/alerts/evaluate";

async function client() {
  const owner = await getOwner();
  if (!owner) throw new Error("Yetkisiz erişim");
  return { supabase: await createClient(), owner };
}

export type AlertState = { error?: string; ok?: string };

export async function createAlert(input: { ticker: string; kind: string; threshold: number; note?: string }): Promise<AlertState> {
  const ticker = input.ticker.toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) return { error: "Geçersiz hisse kodu." };
  if (!(input.kind in ALERT_LABEL)) return { error: "Alarm türünü seç." };
  if (!Number.isFinite(input.threshold) || input.threshold <= 0) return { error: "Eşik sıfırdan büyük bir sayı olmalı." };
  if (input.kind.startsWith("score") && input.threshold > 100) return { error: "Kairos Skoru 0–100 arasındadır." };
  const note = input.note?.trim().slice(0, 140) || null;
  const { supabase, owner } = await client();
  const { error } = await supabase.from("alerts").insert({ user_id: owner.id, ticker, kind: input.kind as AlertKind, threshold: input.threshold, note });
  if (error) return { error: `Alarm kaydedilemedi: ${error.message}` };
  refresh();
  return { ok: `${ticker} için alarm kuruldu. Veriler her güncellendiğinde kontrol edilir.` };
}

export async function deleteAlert(id: string): Promise<void> {
  const { supabase } = await client();
  const { error } = await supabase.from("alerts").delete().eq("id", id);
  if (error) throw error;
  refresh();
}

export async function markAllRead(): Promise<void> {
  const { supabase } = await client();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
  refresh();
}

export async function clearRead(): Promise<void> {
  const { supabase } = await client();
  const { error } = await supabase.from("notifications").delete().not("read_at", "is", null);
  if (error) throw error;
  refresh();
}
