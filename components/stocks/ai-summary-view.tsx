"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { AiSummaryState } from "@/lib/data/ai";

const POLL_MS = 3000;
const GIVE_UP_MS = 180_000;

/** Shows the stored summary and, while a rewrite runs in the background, polls until the new text lands. */
export function AiSummaryView({ ticker, initial }: { ticker: string; initial: AiSummaryState }) {
  const [s, setS] = useState(initial);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!initial.pending) return;
    const started = Date.now();
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (Date.now() - started > GIVE_UP_MS) return setTimedOut(true);
      try {
        const r = await fetch(`/api/ai-ozet?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as Omit<AiSummaryState, "pending">;
          if (j.text && j.at !== initial.at) {
            if (!stop) setS({ ...j, pending: false });
            return;
          }
        }
      } catch {
        // Network hiccup: try again on the next tick.
      }
      setTimeout(tick, POLL_MS);
    };
    const first = setTimeout(tick, POLL_MS);
    return () => { stop = true; clearTimeout(first); };
  }, [ticker, initial]);

  const pending = s.pending && !timedOut;
  return (
    <div className="mt-4 rounded-[var(--radius-control)] border border-primary/15 bg-primary-soft/40 p-4" aria-live="polite">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
        <Sparkles size={14} aria-hidden /> Yapay zekâ özeti
        {pending ? <span className="font-normal text-ink-muted">· {s.text ? "güncel veriyle yeniden yazılıyor" : "hazırlanıyor"}</span> : null}
      </p>
      {s.text ? (
        <>
          <p className="text-sm leading-relaxed">{s.text}</p>
          <p className="mt-2 text-[11px] text-ink-muted">
            {s.model ?? "Model"} ile, yalnızca bu bölümdeki verilerden yazıldı ·{" "}
            {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(s.at!))}.
            Hata yapabilir; rakamları aşağıdaki bölümlerden doğrula.
          </p>
        </>
      ) : pending ? (
        <div className="space-y-2" aria-label="Özet yazılıyor">
          <p className="text-sm text-ink-muted">Özet yazılıyor, birkaç saniye içinde burada görünecek.</p>
          <div className="h-3 w-full animate-pulse rounded bg-primary-soft/60" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-primary-soft/60" />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Yapay zekâ servisi şu an yanıt vermedi. Sayfayı daha sonra yenilediğinde tekrar denenecek.</p>
      )}
    </div>
  );
}
