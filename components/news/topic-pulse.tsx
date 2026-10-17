import Link from "next/link";
import { TOPIC_LABEL } from "@/lib/news/topics";
import type { NewsItem } from "@/lib/data/news";

/** Horizontal bars: how many of the recent headlines are about each topic. */
export function TopicPulse({ items, linkBase }: { items: NewsItem[]; linkBase?: string }) {
  const counts = new Map<string, number>();
  for (const n of items) if (n.topic && n.topic !== "markets" && n.topic !== "earnings") counts.set(n.topic, (counts.get(n.topic) ?? 0) + 1);
  const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-sm text-ink-muted">Son 24 saatte öne çıkan bir konu yok.</p>;
  return (
    <ul className="space-y-2" aria-label="Konulara göre haber sayısı">
      {rows.map(([topic, n]) => {
        const label = TOPIC_LABEL[topic] ?? topic;
        const bar = (
          <span className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
            <span className="truncate">{label}</span>
            <span className="h-2.5 rounded-full bg-surface-high">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="text-right text-ink-muted num">{n}</span>
          </span>
        );
        return (
          <li key={topic}>
            {linkBase ? (
              <Link href={`${linkBase}?konu=${topic}`} className="block rounded-md hover:bg-white/50" aria-label={`${label}: ${n} haber`}>
                {bar}
              </Link>
            ) : (
              bar
            )}
          </li>
        );
      })}
    </ul>
  );
}
