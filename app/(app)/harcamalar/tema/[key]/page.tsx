import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { GrowthBadge, QuarterBars } from "@/components/spending/quarter-bars";
import { TickerLogo } from "@/components/ticker-logo";
import { getSpendingActions, getSpendingThemes } from "@/lib/data/spending";
import { formatDate, formatMoney } from "@/lib/format";
import { THEME_BY_KEY } from "@/lib/spending/themes";
import { growth } from "@/lib/spending/trends";

export const metadata: Metadata = { title: "Harcama teması" };

async function Theme({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const def = THEME_BY_KEY[key];
  if (!def) notFound();
  const [themes, actions] = await Promise.all([getSpendingThemes(), getSpendingActions({ limit: 1000, sort: "date", days: 90 })]);
  const t = themes.find((x) => x.key === key);
  const g = growth(t?.amount_12m, t?.amount_prev_12m);
  const matching = actions.filter((a) => def.match.test([a.description, a.psc_desc, a.naics_desc].filter(Boolean).join(" "))).slice(0, 25);
  const listed = (t?.top_recipients ?? []).filter((r) => r.ticker);
  const maxR = Math.max(1, ...(t?.top_recipients ?? []).map((r) => r.amount));

  return (
    <div className="flex flex-col gap-4">
      <header className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[65ch]">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{def.name}</h1>
            <p className="mt-2 text-ink-muted">{def.why}</p>
            <p className="mt-2 text-xs text-ink-muted">Aranan kelimeler: {def.keywords.map((k) => `"${k}"`).join(", ")}</p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-sm text-ink-muted">
              Yıllık değişim
              <InfoTip title="Nasıl hesaplanıyor?" align="end">
                3 ay önce biten 12 ayın toplamı, ondan önceki 12 ayla karşılaştırılır. Son 3 ay dahil edilmez, çünkü savunma sözleşmeleri
                USAspending&apos;e yaklaşık 90 gün gecikmeyle girer.
              </InfoTip>
            </p>
            <p className="mt-1 text-2xl"><GrowthBadge value={g} /></p>
            <p className="mt-1 text-sm text-ink-muted num">{formatMoney(t?.amount_12m)} / 12 ay</p>
          </div>
        </div>
      </header>

      {t?.quarters.length ? (
        <section className="glass-card p-5" aria-labelledby="series-title">
          <h2 id="series-title" className="mb-1 font-semibold">Çeyreklik federal harcama</h2>
          <p className="mb-4 text-xs text-ink-muted">
            ABD federal mali yılı 1 Ekim&apos;de başlar (MY26 = Ekim 2025 – Eylül 2026). Mali yılın son çeyreğinde (Temmuz–Eylül) harcama
            doğal olarak yükselir; bu yüzden aynı çeyrekleri yıllar arasında karşılaştır. Soluk çubuk: raporlaması süren son çeyrek.
          </p>
          <QuarterBars quarters={t.quarters} height={160} labels />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-card p-5" aria-labelledby="rec-title">
          <h2 id="rec-title" className="font-semibold">Bu temada en çok alan şirketler (son 12 ay)</h2>
          <p className="mb-3 text-xs text-ink-muted">{listed.length} tanesi borsada. Borsada olanlar hisse sayfasına bağlanır.</p>
          <ul className="space-y-2.5">
            {(t?.top_recipients ?? []).map((r) => (
              <li key={r.name} className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3 text-sm">
                <div className="min-w-0">
                  {r.ticker ? (
                    <Link href={`/hisseler/${r.ticker}`} className="flex items-center gap-2 hover:text-primary">
                      <TickerLogo ticker={r.ticker} size={20} /><span className="font-semibold">{r.ticker}</span>
                      <span className="truncate text-xs text-ink-muted">{r.name}</span>
                    </Link>
                  ) : <span className="block truncate text-ink-muted">{r.name}</span>}
                  <span className="mt-1 block h-1.5 rounded-full bg-surface-high" aria-hidden>
                    <span className={`block h-full rounded-full ${r.ticker ? "bg-primary" : "bg-outline"}`} style={{ width: `${(r.amount / maxR) * 100}%` }} />
                  </span>
                </div>
                <span className="text-right font-medium num">{formatMoney(r.amount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-card p-5" aria-labelledby="act-title">
          <h2 id="act-title" className="font-semibold">Bu temadaki son büyük işlemler</h2>
          <p className="mb-3 text-xs text-ink-muted">Son 90 günde Kairos&apos;un kaydettiği en büyük işlemler arasından.</p>
          {matching.length ? (
            <ul className="space-y-2 text-sm">
              {matching.map((a) => (
                <li key={a.id}>
                  <Link href={`/harcamalar/islem/${a.id}`} className="grid grid-cols-[5rem_minmax(0,1fr)_5.5rem] gap-3 hover:text-primary">
                    <span className="text-ink-muted num">{formatDate(a.action_date)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.ticker ?? a.recipient_name}</span>
                      <span className="block truncate text-xs text-ink-muted">{(a.psc_desc ?? a.description ?? "").toLowerCase()}</span>
                    </span>
                    <span className="text-right font-medium num">{formatMoney(a.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-muted">Son 90 günün kayıtlı büyük işlemleri arasında bu temaya uyan yok.</p>}
        </section>
      </div>
    </div>
  );
}

export default function ThemePage({ params }: PageProps<"/harcamalar/tema/[key]">) {
  return (
    <>
      <Link href="/harcamalar" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Federal harcamalar
      </Link>
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Tema yükleniyor" />}>
        <Theme params={params} />
      </Suspense>
    </>
  );
}
