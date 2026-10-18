"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { copyModel, deletePortfolio, removePosition } from "@/app/(app)/portfoy/actions";

export function RemovePositionButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => removePosition(id))} aria-label={`${label} pozisyonunu sil`}
      className="rounded-full p-1.5 text-outline hover:bg-loss/10 hover:text-loss disabled:opacity-50">
      <Trash2 size={15} aria-hidden />
    </button>
  );
}

/** Two-step delete (no browser confirm dialogs). */
export function DeletePortfolioButton({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="text-sm text-ink-muted hover:text-loss">Portföyü sil</button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-loss">Tüm pozisyonlarla birlikte silinsin mi?</span>
      <button type="button" disabled={pending} onClick={() => start(() => deletePortfolio(id))} className="rounded-md bg-loss px-2.5 py-1 font-medium text-white disabled:opacity-60">Sil</button>
      <button type="button" onClick={() => setArmed(false)} className="text-ink-muted hover:text-ink">Vazgeç</button>
    </span>
  );
}

export function CopyModelButton({ name, picks }: { name: string; picks: { ticker: string; price: number }[] }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => copyModel(name, picks))}
      className="rounded-[var(--radius-control)] border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-white/70 disabled:opacity-60">
      {pending ? "Kopyalanıyor…" : "Portföylerime kopyala (10.000 $)"}
    </button>
  );
}
