"use client";

import { useActionState } from "react";
import { setPassword, type PasswordState } from "./actions";

const initial: PasswordState = { status: "idle" };
const inputClass =
  "rounded-[var(--radius-control)] border border-outline-soft bg-elevated/70 px-3 py-2 outline-none focus:border-primary focus:bg-elevated";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, initial);
  return (
    <form action={action} className="mt-4 flex max-w-sm flex-col gap-2">
      <label htmlFor="password" className="text-sm font-medium">
        Yeni şifre
      </label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      <label htmlFor="confirm" className="text-sm font-medium">
        Yeni şifre (tekrar)
      </label>
      <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Kaydediliyor…" : "Şifreyi kaydet"}
      </button>
      {state.message ? (
        <p role="status" className={`text-sm ${state.status === "error" ? "text-loss" : "text-gain"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
