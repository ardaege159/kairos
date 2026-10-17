import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TickerLogo } from "@/components/ticker-logo";
import { TOPIC_LABEL } from "@/lib/news/topics";
import type { NewsItem } from "@/lib/data/news";

/** "3 saat önce" style relative time; absolute date after a week. Rendered at request time. */
export function timeAgo(iso: string, now: number): string {
  const mins = Math.round((now - Date.parse(iso)) / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));
}

function Sentiment({ v }: { v: number | null }) {
  if (v == null) return null;
  const label = v > 0.15 ? "olumlu" : v < -0.15 ? "olumsuz" : "nötr";
  const cls = v > 0.15 ? "text-gain" : v < -0.15 ? "text-loss" : "text-ink-muted";
  return <span className={`text-[10px] ${cls}`}>{label}</span>;
}

export function NewsList({ items, emptyText, now, showTickers = true }: { items: NewsItem[]; emptyText: string; now: number; showTickers?: boolean }) {
  if (!items.length) return <p className="text-sm text-ink-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-outline-soft/40">
      {items.map((n) => (
        <li key={n.id} className="py-3 first:pt-0 last:pb-0">
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 font-medium leading-snug hover:text-primary">
            <span>{n.title}</span>
            <ExternalLink size={13} className="mt-1 shrink-0 text-outline group-hover:text-primary" aria-label="(yeni sekmede açılır)" />
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>{n.source_domain}</span>
            <time dateTime={n.published_at}>{timeAgo(n.published_at, now)}</time>
            {n.topic ? <span className="rounded-full bg-surface-container px-2 py-0.5">{TOPIC_LABEL[n.topic] ?? n.topic}</span> : null}
            {showTickers
              ? n.tickers.slice(0, 6).map((t) => (
                  <Link key={t.ticker} href={`/hisseler/${t.ticker}`} className="inline-flex items-center gap-1 rounded-full bg-primary-soft/60 px-2 py-0.5 font-medium text-primary-strong hover:bg-primary-soft">
                    <TickerLogo ticker={t.ticker} size={14} />
                    {t.ticker} <Sentiment v={t.sentiment} />
                  </Link>
                ))
              : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
