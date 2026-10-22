import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OpinionCard } from "@/components/investors/opinion-card";
import { InvestorTabs } from "@/components/investors/subnav";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { getOpinions, tally } from "@/lib/data/opinions";
import { SOURCES } from "@/lib/opinions/sources";

export const metadata: Metadata = { title: "Hisse görüşleri" };

async function Opinions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const source = typeof sp.kaynak === "string" && SOURCES.some((s) => s.key === sp.kaynak) ? sp.kaynak : undefined;
  const [ops, recent] = await Promise.all([getOpinions({ source, limit: 60 }), getOpinions({ days: 45, limit: 400 })]);
  const top = tally(recent).slice(0, 12);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="flex flex-col gap-3 lg:col-span-2" aria-label="Son görüşler">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Link href="/yatirimcilar/gorusler" className={`rounded-full px-2.5 py-1 ${!source ? "bg-primary text-white" : "bg-elevated/70 text-ink-muted hover:text-ink"}`}>Tümü</Link>
          {SOURCES.map((s) => (
            <Link key={s.key} href={`/yatirimcilar/gorusler?kaynak=${s.key}`} title={s.focus}
              className={`rounded-full px-2.5 py-1 ${source === s.key ? "bg-primary text-white" : "bg-elevated/70 text-ink-muted hover:text-ink"}`}>{s.name}</Link>
          ))}
        </div>
        {ops.length ? ops.map((o) => <OpinionCard key={`${o.post.id}-${o.ticker}`} o={o} />) : (
          <p className="glass-card p-5 text-sm text-ink-muted">Henüz görüş yok. Yazılar her güncellemede okunur (<code>npm run veri:gorus</code>).</p>
        )}
      </section>
      <aside className="flex flex-col gap-4">
        <section className="glass-card p-5" aria-labelledby="talk-title">
          <h2 id="talk-title" className="mb-3 font-semibold">Son 45 günde en çok konuşulanlar</h2>
          <ul className="space-y-2">
            {top.map((t) => (
              <li key={t.ticker} className="flex items-center gap-2 text-sm">
                <TickerLogo ticker={t.ticker} size={22} />
                <Link href={`/hisseler/${t.ticker}`} className="font-semibold hover:text-primary">{t.ticker}</Link>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-muted" title={[...t.sources].join(", ")}>{[...t.sources].join(", ")}</span>
                <span className="flex gap-1.5 text-xs num" aria-label={`${t.olumlu} olumlu, ${t.olumsuz} olumsuz, ${t.notr} nötr görüş`}>
                  {t.olumlu ? <span className="text-gain">{t.olumlu}↑</span> : null}
                  {t.olumsuz ? <span className="text-loss">{t.olumsuz}↓</span> : null}
                  {t.notr ? <span className="text-ink-muted">{t.notr}~</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass-card p-5 text-sm" aria-labelledby="src-title">
          <h2 id="src-title" className="mb-2 font-semibold">Kaynaklar</h2>
          <ul className="space-y-2">
            {SOURCES.map((s) => (
              <li key={s.key}><b>{s.name}</b> <span className="text-ink-muted">· {s.focus}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Bunlar tek tek şirketleri gerekçesiyle analiz eden bağımsız yatırımcı ve analistlerin herkese açık yazıları. Özetler yazının açık kısmından
            yapay zekâ ile Türkçeye çıkarılır; ayrıntı ve bağlam için her zaman orijinal yazıyı oku. Görüşler yazarlarına aittir, yatırım tavsiyesi değildir.
          </p>
        </section>
      </aside>
    </div>
  );
}

export default function GoruslerPage({ searchParams }: PageProps<"/yatirimcilar/gorusler">) {
  return (
    <>
      <PageHeader title="Yatırımcılar" description="Bağımsız yatırımcıların tek tek hisseler hakkında ne düşündüğü: görüş, ana gerekçeler ve orijinal yazı." />
      <InvestorTabs active="gorusler" />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Görüşler yükleniyor" />}>
        <Opinions searchParams={searchParams} />
      </Suspense>
    </>
  );
}
