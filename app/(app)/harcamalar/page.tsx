import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { GrowthBadge, QuarterBars } from "@/components/spending/quarter-bars";
import { TickerLogo } from "@/components/ticker-logo";
import { getCompanySpending, getSpendingActions, getSpendingIndustries, getSpendingSummary, getSpendingThemes } from "@/lib/data/spending";
import { formatDate, formatMoney } from "@/lib/format";
import { sectorName, sectorSlug } from "@/lib/sectors";
import { THEME_BY_KEY, themesOf } from "@/lib/spending/themes";
import { growth, naicsSector } from "@/lib/spending/trends";

export const metadata: Metadata = { title: "Federal harcamalar" };

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-2.5 rounded-full bg-surface-high" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </span>
  );
}

const LAG_NOTE =
  "Büyüme, raporlaması tamamlanmış iki dönemi karşılaştırır: 3 ay önce biten 12 ay ile ondan önceki 12 ay. Savunma Bakanlığı sözleşmeleri USAspending'e yaklaşık 90 gün gecikmeyle girdiği için son aylar dahil edilmez.";

async function Spending({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const showAll = sp.tum === "1";
  const sortByAmount = sp.sirala === "tutar";
  const [companies, { bySector, companies: companyCount, total }, actions, themes, industries] = await Promise.all([
    getCompanySpending({ limit: 25 }),
    getSpendingSummary(),
    getSpendingActions({ matchedOnly: !showAll, limit: 60, sort: sortByAmount ? "amount" : "date", days: 30 }),
    getSpendingThemes(),
    getSpendingIndustries(),
  ]);
  if (!companies.length) {
    return (
      <section className="glass-card max-w-[65ch] p-6">
        <h2 className="font-semibold">Harcama verisi henüz yüklenmedi</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Yüklemek için terminalde <code>npm run veri:harcama</code> komutunu çalıştır (ilk sefer ~10 dakika).
        </p>
      </section>
    );
  }
  const sectors = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
  const period = companies[0];
  const rankedThemes = themes
    .filter((t) => THEME_BY_KEY[t.key])
    .map((t) => ({ ...t, def: THEME_BY_KEY[t.key], g: growth(t.amount_12m, t.amount_prev_12m) }))
    .sort((a, b) => (b.g ?? -9) - (a.g ?? -9));
  const movers = industries
    .map((i) => ({ ...i, g: growth(i.amount_12m, i.amount_prev_12m) }))
    .filter((i) => i.g != null && (i.amount_12m ?? 0) >= 1e9 && (i.amount_prev_12m ?? 0) >= 5e8);
  const rising = [...movers].sort((a, b) => b.g! - a.g!).slice(0, 10);
  const falling = [...movers].sort((a, b) => a.g! - b.g!).slice(0, 5);
  const growers = companies.filter((c) => growth(c.amount_lagged, c.amount_prev) != null);
  const qs = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ tum: showAll ? "1" : undefined, sirala: sortByAmount ? "tutar" : undefined, ...p }).filter((e): e is [string, string] => !!e[1]));
    return s.size ? `/harcamalar?${s}` : "/harcamalar";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <section className="glass-card p-5">
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            Borsadaki şirketlere giden tutar
            <InfoTip title="Bu tutar neyi kapsıyor?">
              {formatDate(period.period_start)} – {formatDate(period.period_end)} arasında federal kurumların sözleşme yükümlülükleri (obligation).
              Yalnızca en büyük 500 alıcıdan halka açık bir şirkete ya da onun yan kuruluşuna bağlanabilenler sayılır.
            </InfoTip>
          </p>
          <p className="mt-1 text-3xl font-bold num">{formatMoney(total)}</p>
          <p className="mt-1 text-sm text-ink-muted">son 12 ay · {companyCount} şirket</p>
        </section>
        <section className="glass-card p-5">
          <p className="text-sm text-ink-muted">En çok alan sektör</p>
          <p className="mt-1 text-2xl font-bold">{sectorName(sectors[0]?.[0])}</p>
          <p className="mt-1 text-sm text-ink-muted num">toplamın %{Math.round(((sectors[0]?.[1] ?? 0) / total) * 100)}&apos;i</p>
        </section>
        <section className="glass-card p-5">
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            En hızlı büyüyen tema
            <InfoTip title="Tema büyümesi">{LAG_NOTE}</InfoTip>
          </p>
          {rankedThemes[0] ? (
            <>
              <Link href={`/harcamalar/tema/${rankedThemes[0].key}`} className="mt-1 block text-2xl font-bold hover:text-primary">{rankedThemes[0].def.name}</Link>
              <p className="mt-1 text-sm text-ink-muted">yıllık <GrowthBadge value={rankedThemes[0].g} /></p>
            </>
          ) : <p className="mt-1 text-sm text-ink-muted">Tema verisi yüklenmedi.</p>}
        </section>
      </div>

      {rankedThemes.length ? (
        <section aria-labelledby="themes-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="themes-title" className="flex items-center gap-1 font-semibold">
              Temalara göre federal para nereye akıyor?
              <InfoTip title="Temalar nasıl hesaplanıyor?">
                Her tema, USAspending&apos;de sözleşme metinlerinde geçen anahtar kelimelerle (ör. &quot;artificial intelligence&quot;, &quot;hypersonic&quot;)
                aranır. Kelime araması geniş olduğu için tutarlar yaklaşıktır; yönü (artıyor mu, azalıyor mu) görmek için kullan. {LAG_NOTE}
              </InfoTip>
            </h2>
            <p className="text-xs text-ink-muted">Büyümeye göre sıralı · çubuklar mali yıl çeyrekleri (koyu mor: yeni mali yılın ilk çeyreği)</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rankedThemes.map((t) => (
              <Link key={t.key} href={`/harcamalar/tema/${t.key}`} className="glass-card flex flex-col gap-3 p-4 transition-shadow hover:shadow-[0_10px_30px_rgb(99_102_241/0.16)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t.def.name}</p>
                    <p className="text-xs text-ink-muted num">{t.amount_12m != null ? `${formatMoney(t.amount_12m)} / 12 ay` : "—"}</p>
                  </div>
                  <GrowthBadge value={t.g} />
                </div>
                <QuarterBars quarters={t.quarters.slice(-12)} height={44} />
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(t.top_recipients.filter((r) => r.ticker).map((r) => r.ticker!))].slice(0, 4).map((tk) => (
                    <span key={tk} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
                      <TickerLogo ticker={tk} size={14} /> {tk}
                    </span>
                  ))}
                  {!t.top_recipients.some((r) => r.ticker) ? <span className="text-xs text-ink-muted">En büyük alıcılar borsada değil</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-5 lg:col-span-2" aria-labelledby="top-title">
          <h2 id="top-title" className="flex items-center gap-1 font-semibold">
            En çok federal sözleşme alan şirketler
            <InfoTip title="Ana şirkete toplama ve büyüme">
              USAspending&apos;de sözleşmeler çoğu zaman yan kuruluş adıyla geçer (ör. Electric Boat → General Dynamics). Kairos her alıcıyı
              USAspending&apos;in ana şirket bilgisiyle borsadaki şirkete bağlar. {LAG_NOTE}
            </InfoTip>
          </h2>
          <div className="mt-4 grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5.5rem_4rem] gap-3 text-xs text-ink-muted">
            <span>Şirket</span><span /><span className="text-right">12 ay</span><span className="text-right">Yıllık</span>
          </div>
          <ul className="mt-2 space-y-3">
            {companies.map((c) => (
              <li key={c.ticker} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5.5rem_4rem] items-center gap-3 text-sm">
                <Link href={`/hisseler/${c.ticker}`} className="flex min-w-0 items-center gap-2 hover:text-primary" title={c.recipients.join(", ")}>
                  <TickerLogo ticker={c.ticker} size={24} />
                  <span className="font-semibold">{c.ticker}</span>
                  <span className="truncate text-ink-muted">{c.name}</span>
                </Link>
                <Bar value={c.amount} max={companies[0].amount} />
                <span className="text-right font-medium num">{formatMoney(c.amount)}</span>
                <span className="text-right"><GrowthBadge value={growth(c.amount_lagged, c.amount_prev)} /></span>
              </li>
            ))}
          </ul>
          {growers.length ? null : <p className="mt-3 text-xs text-ink-muted">Büyüme verisi bir sonraki harcama güncellemesinde gelir.</p>}
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

      {rising.length ? (
        <section className="glass-card p-5" aria-labelledby="ind-title">
          <h2 id="ind-title" className="flex items-center gap-1 font-semibold">
            Federal harcaması en hızlı değişen faaliyet alanları
            <InfoTip title="Faaliyet alanı (NAICS)">
              Sözleşmeler, işin türünü gösteren NAICS koduyla sınıflanır (ör. 336414: güdümlü füze üretimi). Burada yıllık tutarı en az 1 milyar
              $ olan alanların değişimi gösterilir. {LAG_NOTE}
            </InfoTip>
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="mb-2 text-sm font-medium text-gain">En çok artanlar</p>
              <IndustryList items={rising} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-loss">En çok azalanlar</p>
              <IndustryList items={falling} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="glass-card p-5" aria-labelledby="actions-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="actions-title" className="flex items-center gap-1 font-semibold">
            Son 30 günün büyük sözleşme işlemleri
            <InfoTip title="Sözleşme işlemi">
              Federal kurumların son 30 günde kaydettiği en büyük tekil sözleşme işlemleri (yeni sözleşme, ek ödeme ya da değişiklik). Tutar o
              işlemin değeridir; sözleşmenin tamamı değildir. Ayrıntı ve yorum için bir satıra tıkla.
            </InfoTip>
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div role="group" aria-label="Sıralama" className="flex rounded-[var(--radius-control)] bg-surface-container/70 p-1 text-xs">
              <Link href={qs({ sirala: undefined })} aria-current={!sortByAmount ? "true" : undefined}
                className={`rounded-md px-3 py-1 font-medium ${!sortByAmount ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>En yeni</Link>
              <Link href={qs({ sirala: "tutar" })} aria-current={sortByAmount ? "true" : undefined}
                className={`rounded-md px-3 py-1 font-medium ${sortByAmount ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>En büyük</Link>
            </div>
            <Link href={qs({ tum: showAll ? undefined : "1" })} className="text-primary hover:underline">
              {showAll ? "Sadece borsadaki şirketler" : "Özel şirketler dahil tümü"}
            </Link>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Tarih</th>
                <th scope="col" className="py-2 pr-4 font-medium">Alıcı</th>
                <th scope="col" className="py-2 pr-4 font-medium">Kurum</th>
                <th scope="col" className="py-2 pr-4 font-medium">Ne alındı?</th>
                <th scope="col" className="py-2 text-right font-medium">Tutar</th>
                <th scope="col" className="py-2"><span className="sr-only">Ayrıntı</span></th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const tags = themesOf([a.description, a.psc_desc, a.naics_desc].filter(Boolean).join(" "));
                const href = `/harcamalar/islem/${a.id}`;
                return (
                  <tr key={a.id} className="group relative border-t border-outline-soft/40 align-top hover:bg-white/50">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-ink-muted num">{formatDate(a.action_date)}</td>
                    <td className="py-2.5 pr-4">
                      {a.ticker ? (
                        <span className="flex items-center gap-2">
                          <TickerLogo ticker={a.ticker} size={20} />
                          <span className="font-semibold">{a.ticker}</span>
                        </span>
                      ) : null}
                      <span className="block max-w-[14rem] truncate text-xs text-ink-muted" title={a.recipient_name}>{a.recipient_name}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-ink-muted">
                      {a.agency}
                      {a.sub_agency && a.sub_agency !== a.agency ? <span className="block text-xs">{a.sub_agency}</span> : null}
                    </td>
                    <td className="max-w-[24rem] py-2.5 pr-4 text-xs">
                      <Link href={href} className="after:absolute after:inset-0 hover:text-primary">
                        <span className="block font-medium text-ink">{a.psc_desc ? a.psc_desc.toLowerCase() : a.naics_desc?.toLowerCase() ?? "—"}</span>
                        <span className="block truncate text-ink-muted">{a.description ?? ""}</span>
                      </Link>
                      {tags.length || a.modification === "0" ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {a.modification === "0" ? <span className="rounded-full bg-gain-soft/50 px-1.5 text-[10px] font-semibold text-gain">yeni</span> : null}
                          {tags.map((t) => <span key={t.key} className="rounded-full bg-primary-soft/70 px-1.5 text-[10px] font-semibold text-primary-strong">{t.name}</span>)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap num">{formatMoney(a.amount)}</td>
                    <td className="py-2.5 pl-2 text-ink-muted group-hover:text-primary"><ChevronRight size={16} aria-hidden /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function IndustryList({ items }: { items: { naics_code: string; name: string; amount_12m: number | null; g: number | null }[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.naics_code} className="grid grid-cols-[minmax(0,1fr)_5.5rem_4rem] items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate" title={i.name}>{i.name}</span>
            <span className="block text-xs text-ink-muted">{naicsSector(i.naics_code)} · NAICS {i.naics_code}</span>
          </span>
          <span className="text-right text-ink-muted num">{formatMoney(i.amount_12m)}</span>
          <span className="text-right"><GrowthBadge value={i.g} /></span>
        </li>
      ))}
    </ul>
  );
}

export default function HarcamalarPage({ searchParams }: PageProps<"/harcamalar">) {
  return (
    <>
      <PageHeader
        title="Federal harcamalar"
        description="ABD devletinin parasını nereye yönelttiği: yükselen temalar ve faaliyet alanları, en çok pay alan borsa şirketleri ve son büyük sözleşmeler (kaynak: USAspending.gov)."
      />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Harcamalar yükleniyor" />}>
        <Spending searchParams={searchParams} />
      </Suspense>
    </>
  );
}
