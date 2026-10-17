"use server";

import { createClient, getOwner } from "@/lib/supabase/server";

export type PasswordState = { status: "idle" | "ok" | "error"; message?: string };

export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  if (!(await getOwner())) return { status: "error", message: "Önce giriş yapmalısın." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { status: "error", message: "Şifre en az 10 karakter olmalı." };
  if (password !== confirm) return { status: "error", message: "İki şifre aynı değil." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: `Şifre kaydedilemedi: ${error.message}` };
  return { status: "ok", message: "Şifre kaydedildi. Bundan sonra e-posta ve şifreyle giriş yapabilirsin." };
}
