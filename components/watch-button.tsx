"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleWatch } from "@/app/(app)/watchlist-actions";

/** Star toggle for the watchlist; updates instantly and rolls back if the server action fails. */
export function WatchButton({ ticker, watched, compact = false }: { ticker: string; watched: boolean; compact?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(watched);
  const [pending, start] = useTransition();
  const label = optimistic ? `${ticker} izleme listesinden çıkar` : `${ticker} izleme listesine ekle`;
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setOptimistic(!optimistic);
      await toggleWatch(ticker, !optimistic);
    });
  };
  if (compact) {
    return (
      <button type="button" onClick={onClick} disabled={pending} aria-label={label} aria-pressed={optimistic} title={label}
        className="rounded-full p-1 text-outline hover:text-secondary disabled:opacity-60">
        <Star size={16} strokeWidth={1.75} className={optimistic ? "fill-secondary text-secondary" : ""} aria-hidden />
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} aria-pressed={optimistic}
      className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-semibold disabled:opacity-70 ${
        optimistic ? "border border-secondary/40 bg-white/70 text-secondary" : "bg-gradient-to-r from-primary to-secondary text-white shadow-[0_10px_30px_rgb(99_102_241/0.25)]"
      }`}>
      <Star size={16} className={optimistic ? "fill-secondary" : ""} aria-hidden />
      {optimistic ? "İzleniyor" : "İzleme listesine ekle"}
    </button>
  );
}
