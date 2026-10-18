"use client";

import { useActionState } from "react";
import { createPortfolio, type ActionState } from "@/app/(app)/portfoy/actions";

export function CreatePortfolioForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPortfolio, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-sm">
        <span className="text-ink-muted">Yeni portföy adı</span>
        <input name="name" required maxLength={80} placeholder="ör. Uzun vade, Teknoloji sepeti"
          className="mt-1 w-full rounded-[var(--radius-control)] border border-outline-soft bg-white/70 px-3 py-2 outline-none focus:border-primary focus:bg-white" />
      </label>
      <button type="submit" disabled={pending}
        className="rounded-[var(--radius-control)] bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Oluşturuluyor…" : "Portföy oluştur"}
      </button>
      {state.error ? <p role="status" className="w-full text-sm text-loss">{state.error}</p> : null}
    </form>
  );
}
