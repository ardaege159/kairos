import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { isStale } from "@/components/investors/bits";
import { TickerLogo } from "@/components/ticker-logo";
import type { InvestorPortfolio } from "@/lib/data/investors";

/** Tickers across portfolios: how many investors hold each, and how many bought or sold it last quarter. */
export function crowd(ports: InvestorPortfolio[], now: number) {
  const by = new Map<string, { ticker: string; issuer: string; holders: string[]; buyers: string[]; sellers: string[] }>();
  const get = (ticker: string, issuer: string) => by.get(ticker) ?? by.set(ticker, { ticker, issuer, holders: [], buyers: [], sellers: [] }).get(ticker)!;
  // Buys and sells only from investors who have filed the latest quarter, so the lists compare the same period.
  const latest = ports.reduce((m, p) => (p.filing && p.filing.period > m ? p.filing.period : m), "");
  for (const p of ports) {
    if (!p.filing || isStale(p.filing.filed_at, now)) continue;
    const name = p.investor.person;
    const current = p.filing.period === latest;
    const seen = new Set<string>();
    for (const h of p.holdings) {
      if (!h.ticker || h.putCall || seen.has(h.ticker)) continue;
      seen.add(h.ticker);
      const e = get(h.ticker, h.issuer);
      e.holders.push(name);
      if (current && (h.change === "yeni" || h.change === "artirdi")) e.buyers.push(name);
      if (current && h.change === "azaltti") e.sellers.push(name);
    }
    if (current) for (const s of p.sold) if (s.ticker) get(s.ticker, s.issuer).sellers.push(name);
  }
  const all = [...by.values()];
  return {
    latest,
    popular: all.filter((e) => e.holders.length >= 2).sort((a, b) => b.holders.length - a.holders.length).slice(0, 10),
    bought: all.filter((e) => e.buyers.length >= 2).sort((a, b) => b.buyers.length - a.buyers.length || a.sellers.length - b.sellers.length).slice(0, 10),
    sold: all.filter((e) => e.sellers.length >= 2).sort((a, b) => b.sellers.length - a.sellers.length).slice(0, 10),
  };
}

export function CrowdList({ title, tip, items, field, empty }: {
  title: string; tip: string; empty: string;
  items: { ticker: string; issuer: string; holders: string[]; buyers: string[]; sellers: string[] }[];
  field: "holders" | "buyers" | "sellers";
}) {
  return (
    <section className="glass-card p-5" aria-label={title}>
      <h2 className="mb-3 flex items-center gap-1 font-semibold">{title}<InfoTip title={title}>{tip}</InfoTip></h2>
      {items.length ? (
        <ul className="space-y-2.5">
          {items.map((e) => (
            <li key={e.ticker} className="flex items-start gap-2 text-sm">
              <TickerLogo ticker={e.ticker} size={22} />
              <div className="min-w-0 flex-1">
                <Link href={`/hisseler/${e.ticker}`} className="font-semibold hover:text-primary">{e.ticker}</Link>
                <p className="truncate text-xs text-ink-muted" title={e[field].join(", ")}>{e[field].join(", ")}</p>
              </div>
              <span className="shrink-0 font-semibold num">{e[field].length}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-muted">{empty}</p>}
    </section>
  );
}
