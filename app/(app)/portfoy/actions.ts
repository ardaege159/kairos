"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getOwner } from "@/lib/supabase/server";

async function client() {
  const owner = await getOwner();
  if (!owner) throw new Error("Yetkisiz erişim");
  return { supabase: await createClient(), owner };
}

export type ActionState = { error?: string; ok?: boolean };

export async function createPortfolio(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Portföye bir ad ver." };
  if (name.length > 80) return { error: "Ad en fazla 80 karakter olabilir." };
  const { supabase, owner } = await client();
  const { data, error } = await supabase.from("portfolios").insert({ name, user_id: owner.id }).select("id").single();
  if (error) return { error: `Portföy oluşturulamadı: ${error.message}` };
  redirect(`/portfoy/${data.id}`);
}

export async function deletePortfolio(id: string): Promise<void> {
  const { supabase } = await client();
  const { error } = await supabase.from("portfolios").delete().eq("id", id);
  if (error) throw error;
  redirect("/portfoy");
}

export async function addPosition(portfolioId: string, input: { ticker: string; shares: number; buy_price: number; buy_date: string }): Promise<ActionState> {
  const ticker = input.ticker.toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) return { error: "Geçersiz hisse kodu." };
  if (!(input.shares > 0)) return { error: "Adet sıfırdan büyük olmalı." };
  if (!(input.buy_price > 0)) return { error: "Alış fiyatı sıfırdan büyük olmalı." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.buy_date)) return { error: "Alış tarihini seç." };
  if (input.buy_date > new Date().toISOString().slice(0, 10)) return { error: "Alış tarihi gelecekte olamaz." };
  const { supabase } = await client();
  const { error } = await supabase.from("portfolio_positions").insert({ portfolio_id: portfolioId, ticker, shares: input.shares, buy_price: input.buy_price, buy_date: input.buy_date });
  if (error) return { error: error.code === "23503" ? "Bu hisse kodu listede yok." : `Eklenemedi: ${error.message}` };
  refresh();
  return { ok: true };
}

export async function removePosition(id: string): Promise<void> {
  const { supabase } = await client();
  const { error } = await supabase.from("portfolio_positions").delete().eq("id", id);
  if (error) throw error;
  refresh();
}

/** Copy a model portfolio: an equal dollar amount in each ticker at the latest price, bought today. */
export async function copyModel(name: string, picks: { ticker: string; price: number }[], budget = 10000): Promise<void> {
  const { supabase, owner } = await client();
  const valid = picks.filter((p) => p.price > 0);
  if (!valid.length) throw new Error("Kopyalanacak hisse yok.");
  const { data, error } = await supabase.from("portfolios").insert({ name: name.slice(0, 80), user_id: owner.id, note: "Örnek portföyden kopyalandı" }).select("id").single();
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  const each = budget / valid.length;
  const { error: pe } = await supabase.from("portfolio_positions").insert(
    valid.map((p) => ({ portfolio_id: data.id, ticker: p.ticker, shares: Math.round((each / p.price) * 10000) / 10000, buy_price: p.price, buy_date: today })),
  );
  if (pe) throw pe;
  redirect(`/portfoy/${data.id}`);
}
