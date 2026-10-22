import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ChangeBadge, FilingDate, isStale, quarterLabel } from "@/components/investors/bits";
import { QuarterPairs } from "@/components/investors/perf";
import { NewsList } from "@/components/news/news-list";
import { TickerLogo } from "@/components/ticker-logo";
import { getInvestorPortfolio, sectorMix } from "@/lib/data/investors";
import { getNewsMentioning, requestTime } from "@/lib/data/news";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Yatırımcı portföyü" };

const pctOf = (v: number) => `%${(v * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;

async function Detail({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const p = await getInvestorPortfolio(key);
  if (!p) notFound();
  const [news, now, mix] = await Promise.all([getNewsMentioning(p.investor.news, 8), requestTime(), sectorMix(p.holdings)]);
  const perf = p.investor.perf;
  const stocks = p.holdings.filter((h) => !h.putCall);
  const options = p.holdings.filter((h) => h.putCall);
  const top10 = stocks.slice(0, 10).reduce((s, h) => s + h.weight, 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[65ch]">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{p.investor.person}</h1>
            {p.investor.fund !== p.investor.person ? <p className="text-ink-muted">{p.investor.fund}</p> : <p className="text-ink-muted">Küçük fon · sıralamada {perf?.rank}. sırada</p>}
            <p className="mt-3 text-sm leading-relaxed">{p.investor.style}</p>
          </div>
          {p.filing ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-ink-muted">Bildirilen portföy</dt><dd className="text-xl font-bold num">{formatMoney(p.filing.total_value)}</dd></div>
              <div><dt className="text-ink-muted">Pozisyon</dt><dd className="text-xl font-bold num">{p.filing.positions}</dd></div>
              <div><dt className="text-ink-muted">İlk 10 pozisyonun payı</dt><dd className="font-semibold num">{pctOf(top10)}</dd></div>
              <div><dt className="text-ink-muted">Dönem</dt><dd className="font-semibold">{quarterLabel(p.filing.period)}</dd></div>
            </dl>
          ) : null}
        </div>
        {p.filing ? (
          <p className={`mt-3 text-xs ${isStale(p.filing.filed_at, now) ? "font-medium text-loss" : "text-ink-muted"}`}>
            <FilingDate period={p.filing.period} filedAt={p.filing.filed_at} />.
            {isStale(p.filing.filed_at, now) ? " Bu yatırımcının daha yeni bir bildirimi yok; portföy güncel olmayabilir." : " Pozisyonlar çeyrek sonu itibarıyladır; sonrasında değişmiş olabilir."}
          </p>
        ) : null}
      </header>

      {perf || mix.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {perf ? (
            <section className="glass-card p-5 lg:col-span-2" aria-labelledby="perf-title">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="perf-title" className="font-semibold">Çeyrek çeyrek getiri ve S&amp;P 500</h2>
                <p className="text-sm num">
                  Yıllık <b className="text-gain">%{Math.round(perf.annual * 100)}</b> · S&amp;P 500 %{Math.round(perf.bench_annual * 100)} ·{" "}
                  {perf.beat}/{perf.quarters} çeyrek önde · {(perf.max_drawdown ?? 0) > -0.005 ? "eksi çeyrek yok" : `en derin düşüş %${Math.round(Math.abs(perf.max_drawdown ?? 0) * 100)}`}
                </p>
              </div>
              <QuarterPairs series={perf.series} />
              <p className="mt-3 text-xs text-ink-muted">
                Getiri, her çeyrek başında bildirilen pozisyonların çeyrek sonuna kadarki fiyat değişiminden hesaplanır (13F&apos;ten türetilmiş). Çeyrek içi
                işlemler, temettü ve ücretler dahil değildir. Ortalama olarak portföyün %{Math.round((perf.turnover ?? 0) * 100)}&apos;ı her çeyrek yeni pozisyonlardan oluştu.
              </p>
            </section>
          ) : null}
          {mix.length ? (
            <section className={`glass-card p-5 ${perf ? "" : "lg:col-span-3"}`} aria-labelledby="mix-title">
              <h2 id="mix-title" className="mb-3 font-semibold">Sektör dağılımı</h2>
              <ul className="space-y-2 text-sm">
                {mix.slice(0, 8).map((m) => (
                  <li key={m.sector}>
                    <div className="mb-1 flex justify-between"><span>{m.sector}</span><span className="text-ink-muted num">%{(m.weight * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span></div>
                    <span className="block h-1.5 rounded-full bg-surface-high" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, m.weight * 100)}%` }} /></span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {p.filing ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="glass-card overflow-hidden lg:col-span-2" aria-labelledby="hold-title">
            <h2 id="hold-title" className="px-5 pt-5 font-semibold">
              Pozisyonlar {p.previous ? <span className="font-normal text-ink-muted">· {quarterLabel(p.previous.period)} ile karşılaştırmalı</span> : null}
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th scope="col" className="px-5 py-2 font-medium">Hisse</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Portföydeki payı</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Değer</th>
                    <th scope="col" className="py-2 pr-5 text-right font-medium">Son çeyrek</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {stocks.slice(0, 60).map((h) => (
                    <tr key={h.cusip} className="border-t border-outline-soft/40">
                      <td className="px-5 py-2">
                        {h.ticker ? (
                          <Link href={`/hisseler/${h.ticker}`} className="flex items-center gap-2 hover:text-primary">
                            <TickerLogo ticker={h.ticker} size={22} />
                            <span className="font-semibold">{h.ticker}</span>
                            <span className="max-w-[12rem] truncate text-xs text-ink-muted">{h.issuer}</span>
                          </Link>
                        ) : <span className="text-ink-muted">{h.issuer}</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="block h-1.5 w-24 rounded-full bg-surface-high" aria-hidden>
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (h.weight / (stocks[0]?.weight || 1)) * 100)}%` }} />
                          </span>
                          {pctOf(h.weight)}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right">{formatMoney(h.value)}</td>
                      <td className="py-2 pr-5 text-right"><ChangeBadge change={h.change} sharesChange={h.sharesChange} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stocks.length > 60 ? <p className="px-5 py-3 text-xs text-ink-muted">En büyük 60 pozisyon gösteriliyor ({stocks.length} pozisyondan).</p> : <div className="h-3" />}
          </section>

          <div className="flex flex-col gap-4">
            {p.sold.length ? (
              <section className="glass-card p-5" aria-labelledby="sold-title">
                <h2 id="sold-title" className="mb-3 font-semibold">Tamamen sattıkları</h2>
                <ul className="space-y-1.5 text-sm">
                  {p.sold.slice(0, 15).map((s) => (
                    <li key={s.issuer} className="flex items-center justify-between gap-2">
                      {s.ticker ? <Link href={`/hisseler/${s.ticker}`} className="font-semibold hover:text-primary">{s.ticker}</Link> : <span className="truncate text-ink-muted">{s.issuer}</span>}
                      <span className="text-xs text-ink-muted num">önceki değer {formatMoney(s.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {options.length ? (
              <section className="glass-card p-5" aria-labelledby="opt-title">
                <h2 id="opt-title" className="mb-1 font-semibold">Opsiyonlar</h2>
                <p className="mb-3 text-xs text-ink-muted">Alım (call) yükselişe, satım (put) düşüşe ya da korunmaya yönelik pozisyondur. Değer, dayanak hissenin değeridir.</p>
                <ul className="space-y-1.5 text-sm">
                  {options.slice(0, 10).map((o) => (
                    <li key={`${o.cusip}-${o.putCall}`} className="flex items-center justify-between gap-2">
                      <span><b>{o.ticker ?? o.issuer}</b> <span className="text-xs text-ink-muted">{o.putCall === "PUT" ? "satım (put)" : "alım (call)"}</span></span>
                      <span className="text-xs num">{formatMoney(o.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="glass-card p-5" aria-labelledby="news-title">
              <h2 id="news-title" className="mb-3 font-semibold">Adının geçtiği haberler</h2>
              <NewsList now={now} items={news} emptyText="Son haberlerde bu yatırımcıdan söz edilmiyor." />
            </section>
          </div>
        </div>
      ) : null}
      <p className="text-xs text-ink-muted">Kaynak: SEC 13F bildirimleri. Yatırım tavsiyesi değildir; bu kişilerin hisseleri bugün hâlâ tuttuğu kesin değildir.</p>
    </div>
  );
}

export default function InvestorPage({ params }: PageProps<"/yatirimcilar/[key]">) {
  return (
    <>
      <Link href="/yatirimcilar" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Yatırımcılar
      </Link>
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Portföy yükleniyor" />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}
