"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

function checkOwner(email: string): string | null {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return "E-posta adresini yaz.";
  if (!owner) return "Sunucuda OWNER_EMAIL tanımlı değil.";
  if (email !== owner) return "Bu e-posta adresinin Kairos'a erişimi yok.";
  return null;
}

/** Form action: "giris" signs in with the password, "baglanti" emails a one-time link. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const intent = formData.get("intent") === "baglanti" ? "baglanti" : "giris";

  const ownerError = checkOwner(email);
  if (ownerError) return { status: "error", message: ownerError, email };

  const supabase = await createClient();

  if (intent === "giris") {
    const password = String(formData.get("password") ?? "");
    if (!password) return { status: "error", message: "Şifreni yaz.", email };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        status: "error",
        email,
        message:
          error.code === "invalid_credentials"
            ? "E-posta ya da şifre yanlış. Henüz şifre belirlemediysen giriş bağlantısı iste."
            : `Giriş yapılamadı: ${error.message}`,
      };
    }
    redirect("/");
  }

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    return {
      status: "error",
      email,
      message:
        error.status === 429
          ? "Kısa sürede çok fazla bağlantı istendi. Birkaç dakika sonra tekrar dene."
          : `Giriş bağlantısı gönderilemedi: ${error.message}`,
    };
  }
  return { status: "sent", email, message: `Giriş bağlantısı ${email} adresine gönderildi. Bağlantıyı bu tarayıcıda aç.` };
}
