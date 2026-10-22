import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TickerLogo } from "@/components/ticker-logo";
import { formatDate } from "@/lib/format";
import type { Opinion } from "@/lib/data/opinions";

export const STANCE: Record<Opinion["stance"], { label: string; cls: string }> = {
  olumlu: { label: "Olumlu", cls: "bg-gain-soft/60 text-gain" },
  olumsuz: { label: "Olumsuz", cls: "bg-loss-soft/70 text-loss" },
  notr: { label: "Nötr", cls: "bg-surface-container text-ink-muted" },
};

/** One author's view on one stock: stance, AI summary of their argument, and the link to the original. */
export function OpinionCard({ o, showTicker = true }: { o: Opinion; showTicker?: boolean }) {
  const s = STANCE[o.stance];
  return (
    <article className="glass-card flex flex-col gap-2 p-4">
      <header className="flex flex-wrap items-center gap-2">
        {showTicker ? (
          <Link href={`/hisseler/${o.ticker}`} className="flex items-center gap-2 font-semibold hover:text-primary">
            <TickerLogo ticker={o.ticker} size={22} /> {o.ticker}
          </Link>
        ) : null}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
        {o.focus === "yan" ? <span className="rounded-full border border-outline-soft px-2 py-0.5 text-[11px] text-ink-muted">yazıda değinilmiş</span> : null}
        <span className="ml-auto text-xs text-ink-muted">{formatDate(o.post.published_at.slice(0, 10))}</span>
      </header>
      <p className="text-sm leading-relaxed">{o.summary}</p>
      {o.points.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
          {o.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      ) : null}
      <footer className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span><b className="text-ink">{o.post.source?.author ?? "?"}</b> · {o.post.source?.name}</span>
        <a href={o.post.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
          <span className="truncate">{o.post.title}</span> <ExternalLink size={12} aria-label="(yeni sekmede açılır)" />
        </a>
      </footer>
    </article>
  );
}
