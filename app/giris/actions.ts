"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();

  if (!email) return { status: "error", message: "E-posta adresini yaz.", email };
  if (!owner) return { status: "error", message: "Sunucuda OWNER_EMAIL tanımlı değil.", email };
  if (email !== owner) return { status: "error", message: "Bu e-posta adresinin Kairos'a erişimi yok.", email };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const rateLimited = error.status === 429;
    return {
      status: "error",
      email,
      message: rateLimited
        ? "Kısa sürede çok fazla bağlantı istendi. Birkaç dakika sonra tekrar dene."
        : `Giriş bağlantısı gönderilemedi: ${error.message}`,
    };
  }
  return { status: "sent", message: `Giriş bağlantısı ${email} adresine gönderildi. Bağlantıyı bu tarayıcıda aç.` };
}
