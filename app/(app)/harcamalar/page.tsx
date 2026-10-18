import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { getCompanySpending, getSpendingActions, getSpendingSummary } from "@/lib/data/spending";
import { formatDate, formatMoney } from "@/lib/format";
import { sectorName, sectorSlug } from "@/lib/sectors";

export const metadata: Metadata = { title: "Federal harcamalar" };

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-2.5 rounded-full bg-surface-high" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </span>
  );
}

async function Spending({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const showAll = sp.tum === "1";
  const [companies, { bySector, companies: companyCount, total }, actions] = await Promise.all([
    getCompanySpending({ limit: 20 }),
    getSpendingSummary(),
    getSpendingActions({ matchedOnly: !showAll, limit: 40 }),
  ]);
  if (!companies.length) {
    return (
      <section className="glass-card max-w-[65ch] p-6">
        <h2 className="font-semibold">Harcama verisi henüz yüklenmedi</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Yüklemek için terminalde <code>node --env-file=.env.local scripts/ingest/spending.ts</code> komutunu çalıştır (ilk sefer ~10 dakika).
        </p>
      </section>
    );
  }
  const sectors = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
  const period = companies[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <section className="glass-card p-5">
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            Borsadaki şirketlere giden tutar
            <InfoTip title="Bu tutar neyi kapsıyor?">
              {formatDate(period.period_start)} – {formatDate(period.period_end)} arasında federal kurumların sözleşme yükümlülükleri (obligation).
              Yalnızca en büyük 500 alıcıdan halka açık bir şirkete ya da onun yan kuruluşuna bağlanabilenler sayılır; özel şirketler
              (ör. sağlık sigortası yüklenicileri) dahil değildir.
            </InfoTip>
          </p>
          <p className="mt-1 text-3xl font-bold num">{formatMoney(total)}</p>
          <p className="mt-1 text-sm text-ink-muted">son 12 ay</p>
        </section>
        <section className="glass-card p-5">
          <p className="text-sm text-ink-muted">Eşleşen şirket sayısı</p>
          <p className="mt-1 text-3xl font-bold num">{companyCount}</p>
          <p className="mt-1 text-sm text-ink-muted">en büyük 500 federal alıcı arasında</p>
        </section>
        <section className="glass-card p-5">
          <p className="text-sm text-ink-muted">En çok alan sektör</p>
          <p className="mt-1 text-2xl font-bold">{sectorName(sectors[0]?.[0])}</p>
          <p className="mt-1 text-sm text-ink-muted num">toplamın %{Math.round(((sectors[0]?.[1] ?? 0) / total) * 100)}&apos;i</p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-5 lg:col-span-2" aria-labelledby="top-title">
          <h2 id="top-title" className="flex items-center gap-1 font-semibold">
            En çok federal sözleşme alan şirketler
            <InfoTip title="Ana şirkete toplama">
              USAspending&apos;de sözleşmeler çoğu zaman yan kuruluş adıyla geçer (ör. Electric Boat → General Dynamics, Optum Public Sector →
              UnitedHealth). Kairos her alıcıyı USAspending&apos;in kendi ana şirket bilgisiyle borsadaki şirkete bağlar.
            </InfoTip>
          </h2>
          <ul className="mt-4 space-y-3">
            {companies.map((c) => (
              <li key={c.ticker} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm">
                <Link href={`/hisseler/${c.ticker}`} className="flex min-w-0 items-center gap-2 hover:text-primary" title={c.recipients.join(", ")}>
                  <TickerLogo ticker={c.ticker} size={24} />
                  <span className="font-semibold">{c.ticker}</span>
                  <span className="truncate text-ink-muted">{c.name}</span>
                </Link>
                <Bar value={c.amount} max={companies[0].amount} />
                <span className="text-right font-medium num">{formatMoney(c.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass-card p-5" aria-labelledby="sector-title">
          <h2 id="sector-title" className="mb-4 font-semibold">Sektörlere göre</h2>
          <ul className="space-y-3">
            {sectors.map(([sec, amount]) => (
              <li key={sec} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <Link href={`/sektorler/${sectorSlug(sec)}`} className="hover:text-primary">{sectorName(sec)}</Link>
                  <span className="text-ink-muted num">{formatMoney(amount)}</span>
                </div>
                <Bar value={amount} max={sectors[0][1]} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="glass-card p-5" aria-labelledby="actions-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="actions-title" className="flex items-center gap-1 font-semibold">
            Son 30 günün en büyük sözleşme ödemeleri
            <InfoTip title="Sözleşme işlemi">
              Federal kurumların son 30 günde kaydettiği tekil sözleşme işlemleri (yeni sözleşme, ek ödeme ya da değişiklik). Tutar o işlemin
              değeridir; sözleşmenin tamamı değildir. Negatif düzeltmeler gösterilmez.
            </InfoTip>
          </h2>
          <Link href={showAll ? "/harcamalar" : "/harcamalar?tum=1"} className="text-sm text-primary hover:underline">
            {showAll ? "Sadece borsadaki şirketler" : "Özel şirketler dahil tümü"}
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Tarih</th>
                <th scope="col" className="py-2 pr-4 font-medium">Alıcı</th>
                <th scope="col" className="py-2 pr-4 font-medium">Kurum</th>
                <th scope="col" className="py-2 pr-4 font-medium">Açıklama</th>
                <th scope="col" className="py-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-t border-outline-soft/40 align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-ink-muted num">{formatDate(a.action_date)}</td>
                  <td className="py-2.5 pr-4">
                    {a.ticker ? (
                      <Link href={`/hisseler/${a.ticker}`} className="flex items-center gap-2 hover:text-primary">
                        <TickerLogo ticker={a.ticker} size={20} />
                        <span className="font-semibold">{a.ticker}</span>
                      </Link>
                    ) : null}
                    <span className="block max-w-[14rem] truncate text-xs text-ink-muted" title={a.recipient_name}>{a.recipient_name}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-ink-muted">
                    {a.agency}
                    {a.sub_agency && a.sub_agency !== a.agency ? <span className="block text-xs">{a.sub_agency}</span> : null}
                  </td>
                  <td className="max-w-[22rem] py-2.5 pr-4 text-xs text-ink-muted">
                    {a.description ?? "—"}
                    {a.award_url ? (
                      <a href={a.award_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline">
                        USAspending <ExternalLink size={11} aria-label="(yeni sekmede açılır)" />
                      </a>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right font-medium whitespace-nowrap num">{formatMoney(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function HarcamalarPage({ searchParams }: PageProps<"/harcamalar">) {
  return (
    <>
      <PageHeader
        title="Federal harcamalar"
        description="ABD federal sözleşmelerinden en çok pay alan borsadaki şirketler ve son büyük ödemeler (kaynak: USAspending.gov)."
      />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Harcamalar yükleniyor" />}>
        <Spending searchParams={searchParams} />
      </Suspense>
    </>
  );
}
