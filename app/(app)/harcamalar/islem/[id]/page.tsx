import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, CircleMinus, ExternalLink, Info } from "lucide-react";
import { TickerLogo } from "@/components/ticker-logo";
import { getCompanySpending, getSpendingAction, getSpendingActions } from "@/lib/data/spending";
import { getStock } from "@/lib/data/stocks";
import { formatDate, formatMoney } from "@/lib/format";
import { explainAction, type Point } from "@/lib/spending/explain";
import { naicsSector } from "@/lib/spending/trends";

export const metadata: Metadata = { title: "Sözleşme ayrıntısı" };

const TONE = {
  positive: { Icon: CircleCheck, cls: "text-gain" },
  negative: { Icon: CircleMinus, cls: "text-loss" },
  neutral: { Icon: Info, cls: "text-primary" },
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-t border-outline-soft/40 py-2 text-sm first:border-t-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Points({ points }: { points: Point[] }) {
  return (
    <ul className="space-y-3">
      {points.map((p) => {
        const { Icon, cls } = TONE[p.tone];
        return (
          <li key={p.title} className="flex gap-3">
            <Icon size={18} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-ink-muted">{p.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{40}$/.test(id)) notFound();
  const a = await getSpendingAction(id);
  if (!a) notFound();
  const [stock, fed, related] = await Promise.all([
    a.ticker ? getStock(a.ticker) : Promise.resolve(null),
    a.ticker ? getCompanySpending({ tickers: [a.ticker], limit: 1 }) : Promise.resolve([]),
    a.ticker ? getSpendingActions({ ticker: a.ticker, limit: 6, sort: "date" }) : Promise.resolve([]),
  ]);
  // Revenue isn't stored directly: market cap ÷ (price/sales) recovers trailing-12-month revenue.
  const m = stock?.metrics;
  const revenue = m?.market_cap && m?.ps ? m.market_cap / m.ps : null;
  const { themes, points } = explainAction(a, stock ? { name: stock.name, revenue, federal12m: fed[0]?.amount ?? null } : null);
  const what = a.psc_desc ?? a.naics_desc;

  return (
    <div className="flex flex-col gap-4">
      <header className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">{formatDate(a.action_date)} · {a.agency}{a.sub_agency && a.sub_agency !== a.agency ? ` / ${a.sub_agency}` : ""}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{what ? what.charAt(0) + what.slice(1).toLowerCase() : "Federal sözleşme işlemi"}</h1>
            <p className="mt-1 text-sm text-ink-muted">{a.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {a.ticker ? (
                <Link href={`/hisseler/${a.ticker}`} className="inline-flex items-center gap-2 rounded-full bg-elevated/70 px-3 py-1.5 text-sm hover:bg-elevated">
                  <TickerLogo ticker={a.ticker} size={20} />
                  <span className="font-semibold">{a.ticker}</span>
                  <span className="text-ink-muted">{stock?.name ?? a.recipient_name}</span>
                </Link>
              ) : (
                <span className="rounded-full bg-elevated/70 px-3 py-1.5 text-sm">{a.recipient_name} <span className="text-ink-muted">(borsada değil)</span></span>
              )}
              {themes.map((t) => (
                <Link key={t.key} href={`/harcamalar/tema/${t.key}`} className="rounded-full bg-primary-soft/70 px-2.5 py-1 text-xs font-semibold text-primary-strong hover:underline">
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-ink-muted">Bu işlemin tutarı</p>
            <p className="text-3xl font-bold num">{formatMoney(a.amount)}</p>
            {a.potential_value ? <p className="text-sm text-ink-muted num">opsiyonlarla toplam değer {formatMoney(a.potential_value)}</p> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="glass-card p-5 lg:col-span-3" aria-labelledby="meaning-title">
          <h2 id="meaning-title" className="mb-4 font-semibold">Ne anlama geliyor?</h2>
          <Points points={points} />
          {themes.length ? (
            <div className="mt-5 rounded-[var(--radius-control)] bg-primary-soft/40 p-4">
              <p className="text-sm font-semibold">Hangi eğilimin parçası?</p>
              {themes.map((t) => (
                <p key={t.key} className="mt-1 text-sm text-ink-muted">
                  <Link href={`/harcamalar/tema/${t.key}`} className="font-medium text-primary hover:underline">{t.name}</Link>: {t.why}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-5 text-xs text-ink-muted">
            Bu yorum USAspending verisinden kurallarla üretilir. Sözleşmenin şirketin beklentilerine zaten dahil olup olmadığını bilemez;
            yatırım tavsiyesi değildir.
          </p>
        </section>

        <section className="glass-card p-5 lg:col-span-2" aria-labelledby="facts-title">
          <h2 id="facts-title" className="mb-2 font-semibold">Sözleşme bilgileri</h2>
          <dl>
            <Row label="Alıcı">{a.recipient_name}</Row>
            <Row label="Sözleşme türü">{a.award_type && a.award_type !== "—" ? a.award_type.toLowerCase() : "—"}</Row>
            <Row label="İşlem">{a.modification === "0" ? "İlk kayıt (yeni)" : a.modification ? `Değişiklik ${a.modification}` : "—"}</Row>
            <Row label="Bugüne kadar ayrılan">{formatMoney(a.total_obligation)}</Row>
            <Row label="Potansiyel toplam">{formatMoney(a.potential_value)}</Row>
            <Row label="İş süresi">{a.pop_start && a.pop_end ? `${formatDate(a.pop_start)} – ${formatDate(a.pop_end)}` : "—"}</Row>
            <Row label="Rekabet">{a.competition ? a.competition.toLowerCase() : "—"}{a.offers ? ` (${a.offers} teklif)` : ""}</Row>
            <Row label="Faaliyet alanı">{a.naics_desc ? <>{a.naics_desc.toLowerCase()} <span className="text-ink-muted">({naicsSector(a.naics_code ?? "")})</span></> : "—"}</Row>
            <Row label="Ürün/hizmet kodu">{a.psc_code ? `${a.psc_code} · ${(a.psc_desc ?? "").toLowerCase()}` : "—"}</Row>
            <Row label="Yapılacağı yer">{a.place_state ? a.place_state.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : "—"}</Row>
          </dl>
          {a.award_url ? (
            <a href={a.award_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              USAspending&apos;de aç <ExternalLink size={13} aria-label="(yeni sekmede açılır)" />
            </a>
          ) : null}
          {!a.award_type ? <p className="mt-3 text-xs text-ink-muted">Sözleşme ayrıntıları bir sonraki harcama güncellemesinde yüklenecek.</p> : null}
        </section>
      </div>

      {related.filter((r) => r.id !== a.id).length ? (
        <section className="glass-card p-5" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-3 font-semibold">{a.ticker} için son diğer işlemler</h2>
          <ul className="space-y-1.5 text-sm">
            {related.filter((r) => r.id !== a.id).map((r) => (
              <li key={r.id}>
                <Link href={`/harcamalar/islem/${r.id}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] gap-3 hover:text-primary">
                  <span className="text-ink-muted num">{formatDate(r.action_date)}</span>
                  <span className="truncate">{(r.psc_desc ?? r.description ?? r.agency ?? "").toLowerCase()}</span>
                  <span className="text-right font-medium num">{formatMoney(r.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function ActionPage({ params }: PageProps<"/harcamalar/islem/[id]">) {
  return (
    <>
      <Link href="/harcamalar" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Federal harcamalar
      </Link>
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Sözleşme yükleniyor" />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}
