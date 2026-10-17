"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

const inputClass =
  "rounded-[var(--radius-control)] border border-outline-soft bg-white/70 px-3 py-2.5 outline-none focus:border-primary focus:bg-white";

export function LoginForm({ linkError }: { linkError?: boolean }) {
  const [state, action, pending] = useActionState(login, initial);
  const message =
    state.message ?? (linkError ? "Giriş bağlantısı geçersiz ya da süresi dolmuş. Yeni bağlantı iste." : null);
  const isError = state.status === "error" || (state.status === "idle" && linkError);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        E-posta
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        className={inputClass}
      />
      <label htmlFor="password" className="mt-1 text-sm font-medium">
        Şifre
      </label>
      <input id="password" name="password" type="password" autoComplete="current-password" className={inputClass} />
      <button
        type="submit"
        name="intent"
        value="giris"
        disabled={pending}
        className="mt-1 rounded-[var(--radius-control)] bg-gradient-to-r from-primary to-secondary px-4 py-2.5 font-semibold text-white shadow-[0_10px_30px_rgb(99_102_241/0.25)] disabled:opacity-60"
      >
        {pending ? "Bekle…" : "Giriş yap"}
      </button>
      <button
        type="submit"
        name="intent"
        value="baglanti"
        formNoValidate
        disabled={pending}
        className="text-sm text-primary underline-offset-4 hover:underline disabled:opacity-60"
      >
        Şifre yok ya da unuttum: e-postama giriş bağlantısı gönder
      </button>
      {message ? (
        <p role="status" className={`text-sm ${isError ? "text-loss" : "text-gain"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
