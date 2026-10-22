import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InfoTip } from "@/components/info-tip";
import { quarterLabel } from "@/components/investors/bits";
import { CrowdList, crowd } from "@/components/investors/crowd";
import { GrowthLines } from "@/components/investors/perf";
import { InvestorTabs } from "@/components/investors/subnav";
import { PageHeader } from "@/components/page-header";
import { getInvestorPortfolios, sectorMix } from "@/lib/data/investors";
import { requestTime } from "@/lib/data/news";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Yatırımcılar" };

const pct = (v: number | null | undefined, signed = false) =>
  v == null ? "—" : `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}%${Math.abs(v * 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

async function SmallFunds() {
  const [ports, now] = await Promise.all([getInvestorPortfolios("small"), requestTime()]);
  if (!ports.length) {
    return (
      <section className="glass-card max-w-[65ch] p-6">
        <h2 className="font-semibold">Sıralama henüz hesaplanmadı</h2>
        <p className="mt-2 text-sm text-ink-muted">
          SEC&apos;in çeyreklik 13F veri setleri indirilip <code>scripts/ingest/small-funds.ts</code> çalıştırılınca burada görünür.
        </p>
      </section>
    );
  }
  const mixes = await Promise.all(ports.map((p) => sectorMix(p.holdings)));
  const c = crowd(ports, now);
  const perf0 = ports[0].investor.perf!;
  const first = perf0.series[0]?.period, last = perf0.latest_period;

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card p-5 text-sm leading-relaxed" aria-label="Nasıl seçildi">
        <p>
          SEC&apos;e 13F bildirimi veren yaklaşık 9.000 yöneticinin <b>{first ? quarterLabel(first) : ""}–{quarterLabel(last)}</b> arasındaki her
          çeyrek bildirimi tarandı. Listeye yalnızca şu fonlar girdi: <b>100 milyon – 3 milyar $</b> büyüklükte, <b>5–40 pozisyonla</b> yoğunlaşmış,
          tek pozisyonu portföyün %40&apos;ını aşmayan, ağırlıklı olarak tek tek hisse seçen (ETF ağırlıklı değil), her çeyrek portföyünün yarısından
          fazlasını değiştirmeyen ve bu sürede S&amp;P 500&apos;ü geçen fonlar. Sıralama yıllık getirinin endeksi ne kadar aştığına göredir.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Getiri &quot;13F&apos;ten türetilmiş&quot;tir: her çeyrek başındaki pozisyonların çeyrek sonuna kadarki fiyat değişimi (fiyatlar bildirimlerin
          kendisinden). Çeyrek içi alım satımlar, temettü, açığa satış ve ücretler dahil değildir; fonun gerçek getirisinden farklı olabilir. Geçmiş
          getiri gelecekteki getiriyi göstermez; bu liste yatırım tavsiyesi değildir.
        </p>
      </section>

      <section aria-labelledby="funds-title">
        <h2 id="funds-title" className="mb-3 font-semibold">S&amp;P 500&apos;ü en çok geçen küçük fonlar</h2>
        <ol className="flex flex-col gap-3">
          {ports.map((p, i) => {
            const f = p.investor.perf!;
            const mix = mixes[i];
            return (
              <li key={p.investor.key}>
                <Link href={`/yatirimcilar/${p.investor.key}`}
                  className="glass-card grid gap-4 p-4 transition-colors hover:border-primary/40 md:grid-cols-[2.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
                  <span className="text-lg font-semibold text-ink-muted num">{f.rank}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.investor.fund}</p>
                    <p className="text-xs text-ink-muted num">
                      {formatMoney(f.total_value)} · {f.positions} pozisyon
                      {mix[0] ? <> · <span className="text-ink">{mix[0].sector} %{Math.round(mix[0].weight * 100)}</span></> : null}
                    </p>
                    <p className="mt-1 truncate text-xs">
                      {p.holdings.filter((h) => !h.putCall).slice(0, 4).map((h) => h.ticker ?? h.issuer).join(", ")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-sm num">
                    <span className="text-xs text-ink-muted">Yıllık</span><span className="text-xs text-ink-muted">S&amp;P 500</span>
                    <span className="text-lg font-bold text-gain">{pct(f.annual, true)}</span><span className="text-lg text-ink-muted">{pct(f.bench_annual, true)}</span>
                    <span className="col-span-2 text-xs text-ink-muted">{f.beat}/{f.quarters} çeyrek önde · {(f.max_drawdown ?? 0) > -0.005 ? "eksi çeyrek yok" : `en derin düşüş ${pct(f.max_drawdown)}`}</span>
                  </div>
                  <div className="hidden md:block"><GrowthLines series={f.series} /></div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <CrowdList title="Bu fonların ortak tercihleri" field="holders" items={c.popular} empty="Birden fazla fonun tuttuğu hisse yok."
          tip="Listedeki fonlardan kaçının son bildiriminde bu hisse var." />
        <CrowdList title="Son çeyrekte en çok alınanlar" field="buyers" items={c.bought} empty="En az iki fonun birlikte aldığı hisse yok."
          tip={`${quarterLabel(last)} bildiriminde yeni pozisyon açan ya da hisse sayısını artıran fonlar.`} />
        <CrowdList title="Son çeyrekte en çok satılanlar" field="sellers" items={c.sold} empty="En az iki fonun birlikte sattığı hisse yok."
          tip={`${quarterLabel(last)} bildiriminde pozisyonunu azaltan ya da tamamen satan fonlar.`} />
      </div>
      <p className="flex items-center gap-1 text-xs text-ink-muted">
        Grafikte mavi çizgi fonun, kesikli gri çizgi S&amp;P 500&apos;ün aynı yöntemle hesaplanan birikimli getirisidir.
        <InfoTip title="Neden küçük fonlar?">
          Küçük ve yoğunlaşmış fonların bir hisseye verdiği ağırlık, gerçekten inandıkları fikirleri gösterir; dev fonlarda ise pozisyonlar
          endekse benzer ve tek bir hissenin portföye etkisi küçüktür.
        </InfoTip>
      </p>
    </div>
  );
}

export default function YatirimcilarPage() {
  return (
    <>
      <PageHeader title="Yatırımcılar" description="Son iki yılda S&P 500'ü geçen küçük ve yoğunlaşmış fonlar, ne tuttukları ve son çeyrekte ne alıp sattıkları." />
      <InvestorTabs active="kucuk" />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Fonlar yükleniyor" />}>
        <SmallFunds />
      </Suspense>
    </>
  );
}
