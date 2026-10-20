import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InfoTip } from "@/components/info-tip";
import { FilingDate, isStale } from "@/components/investors/bits";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { getInvestorPortfolios, type InvestorPortfolio } from "@/lib/data/investors";
import { requestTime } from "@/lib/data/news";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Ünlü yatırımcılar" };

/** Tickers across portfolios: how many investors hold each, and how many bought or sold it last quarter. */
function crowd(ports: InvestorPortfolio[], now: number) {
  const by = new Map<string, { ticker: string; issuer: string; holders: string[]; buyers: string[]; sellers: string[] }>();
  const get = (ticker: string, issuer: string) => by.get(ticker) ?? by.set(ticker, { ticker, issuer, holders: [], buyers: [], sellers: [] }).get(ticker)!;
  for (const p of ports) {
    if (!p.filing || isStale(p.filing.filed_at, now)) continue;
    const name = p.investor.person;
    const seen = new Set<string>();
    for (const h of p.holdings) {
      if (!h.ticker || h.putCall || seen.has(h.ticker)) continue;
      seen.add(h.ticker);
      const e = get(h.ticker, h.issuer);
      e.holders.push(name);
      if (h.change === "yeni" || h.change === "artirdi") e.buyers.push(name);
      if (h.change === "azaltti") e.sellers.push(name);
    }
    for (const s of p.sold) if (s.ticker) get(s.ticker, s.issuer).sellers.push(name);
  }
  const all = [...by.values()];
  return {
    popular: all.filter((e) => e.holders.length >= 2).sort((a, b) => b.holders.length - a.holders.length).slice(0, 10),
    bought: all.filter((e) => e.buyers.length >= 2).sort((a, b) => b.buyers.length - a.buyers.length || a.sellers.length - b.sellers.length).slice(0, 10),
    sold: all.filter((e) => e.sellers.length >= 2).sort((a, b) => b.sellers.length - a.sellers.length).slice(0, 10),
  };
}

function CrowdList({ title, tip, items, field, empty }: {
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

async function Investors() {
  const [ports, now] = await Promise.all([getInvestorPortfolios(), requestTime()]);
  if (!ports.some((p) => p.filing)) {
    return (
      <section className="glass-card max-w-[65ch] p-6">
        <h2 className="font-semibold">Portföy verisi henüz yüklenmedi</h2>
        <p className="mt-2 text-sm text-ink-muted">Terminalde <code>npm run veri:yatirimci</code> komutunu çalıştır (ilk sefer ~10 dakika).</p>
      </section>
    );
  }
  const c = crowd(ports, now);
  const ordered = [...ports].sort((a, b) => Number(!!b.filing && !isStale(b.filing.filed_at, now)) - Number(!!a.filing && !isStale(a.filing.filed_at, now)) || (b.filing?.total_value ?? 0) - (a.filing?.total_value ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <CrowdList title="En çok tutulan hisseler" field="holders" items={c.popular} empty="Ortak hisse yok."
          tip="Güncel bildirimi olan yatırımcıların kaçının portföyünde bu hisse var. Sağdaki sayı yatırımcı sayısıdır." />
        <CrowdList title="Son çeyrekte en çok alınanlar" field="buyers" items={c.bought} empty="En az iki yatırımcının birlikte aldığı hisse yok."
          tip="Bir önceki çeyreğe göre yeni pozisyon açan ya da hisse sayısını artıran yatırımcılar." />
        <CrowdList title="Son çeyrekte en çok satılanlar" field="sellers" items={c.sold} empty="En az iki yatırımcının birlikte sattığı hisse yok."
          tip="Pozisyonu azaltan ya da tamamen satan yatırımcılar." />
      </div>

      <section aria-labelledby="inv-title">
        <h2 id="inv-title" className="mb-3 font-semibold">Yatırımcılar</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((p) => {
            const stale = p.filing ? isStale(p.filing.filed_at, now) : true;
            const counts = { yeni: p.holdings.filter((h) => h.change === "yeni").length, satti: p.sold.length };
            return (
              <Link key={p.investor.key} href={`/yatirimcilar/${p.investor.key}`}
                className={`glass-card flex flex-col gap-3 p-5 transition-colors hover:border-primary/40 ${stale ? "opacity-70" : ""}`}>
                <div>
                  <p className="text-lg font-semibold">{p.investor.person}</p>
                  <p className="text-sm text-ink-muted">{p.investor.fund}</p>
                </div>
                {p.filing ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xl font-bold num">{formatMoney(p.filing.total_value)}</p>
                      <p className="text-xs text-ink-muted num">{p.filing.positions} pozisyon</p>
                    </div>
                    <ul className="space-y-1.5">
                      {p.holdings.filter((h) => !h.putCall).slice(0, 5).map((h) => (
                        <li key={h.cusip} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
                          <span className="truncate font-semibold">{h.ticker ?? h.issuer}</span>
                          <span className="block h-1.5 rounded-full bg-surface-high" aria-hidden>
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, h.weight * 100)}%` }} />
                          </span>
                          <span className="text-right num">%{(h.weight * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-ink-muted">
                      <FilingDate period={p.filing.period} filedAt={p.filing.filed_at} />
                      {p.previous ? <> · {counts.yeni} yeni, {counts.satti} satış</> : null}
                    </p>
                    {stale ? <p className="text-xs font-medium text-loss">Bu yatırımcının yeni bildirimi yok; veriler eski.</p> : null}
                  </>
                ) : <p className="text-sm text-ink-muted">Bildirim bulunamadı.</p>}
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Kaynak: SEC 13F bildirimleri. 100 milyon $&apos;dan fazla hisse yöneten fonlar her çeyrek sonundan en geç 45 gün sonra ABD hisse
        pozisyonlarını bildirir. Açığa satışlar, ABD dışı hisseler ve nakit dahil değildir; portföyler çeyrek sonu itibarıyladır ve o tarihten
        sonra değişmiş olabilir. Bu bilgiler yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

export default function YatirimcilarPage() {
  return (
    <>
      <PageHeader title="Ünlü yatırımcılar" description="Tanınmış yatırımcıların SEC'e bildirdiği ABD hisse portföyleri: neyi tutuyorlar, son çeyrekte neyi alıp sattılar." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Portföyler yükleniyor" />}>
        <Investors />
      </Suspense>
    </>
  );
}
