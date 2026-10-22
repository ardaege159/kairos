import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilingDate, isStale, quarterLabel } from "@/components/investors/bits";
import { PageHeader } from "@/components/page-header";
import { getInvestorPortfolios } from "@/lib/data/investors";
import { CrowdList, crowd } from "@/components/investors/crowd";
import { InvestorTabs } from "@/components/investors/subnav";
import { requestTime } from "@/lib/data/news";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Tanınmış yatırımcılar" };

async function Investors() {
  const [ports, now] = await Promise.all([getInvestorPortfolios("famous"), requestTime()]);
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
          tip={`${c.latest ? quarterLabel(c.latest) : "Son çeyrek"} bildirimini yapmış yatırımcılardan, bir önceki çeyreğe göre yeni pozisyon açan ya da hisse sayısını artıranlar.`} />
        <CrowdList title="Son çeyrekte en çok satılanlar" field="sellers" items={c.sold} empty="En az iki yatırımcının birlikte sattığı hisse yok."
          tip={`${c.latest ? quarterLabel(c.latest) : "Son çeyrek"} bildirimini yapmış yatırımcılardan pozisyonunu azaltan ya da tamamen satanlar.`} />
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

export default function TaninmisPage() {
  return (
    <>
      <PageHeader title="Yatırımcılar" description="Tanınmış büyük yatırımcıların SEC'e bildirdiği ABD hisse portföyleri. Ölçekleri çok büyük olduğu için birebir taklit etmek yerine fikir kaynağı olarak bakmak daha anlamlı." />
      <InvestorTabs active="taninmis" />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Portföyler yükleniyor" />}>
        <Investors />
      </Suspense>
    </>
  );
}
