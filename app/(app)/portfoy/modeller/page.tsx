import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { CopyModelButton } from "@/components/portfolio/buttons";
import { RiskBadge, RiskCard } from "@/components/portfolio/risk-card";
import { TickerLogo } from "@/components/ticker-logo";
import { assetInfo } from "@/lib/data/portfolios";
import { getAllSectorStats, getPrices, listSp500 } from "@/lib/data/stocks";
import { formatPercent } from "@/lib/format";
import { assessRisk, weightedReturns, type Series } from "@/lib/portfolio/analytics";
import { buildModels } from "@/lib/portfolio/models";
import { sectorName } from "@/lib/sectors";

export const metadata: Metadata = { title: "Örnek portföyler" };

async function Models() {
  const [members, stats] = await Promise.all([listSp500(), getAllSectorStats()]);
  const models = buildModels(
    members.map((s) => ({ ticker: s.ticker, name: s.name, sector: s.sector, price: s.price, score: s.score, metrics: s.metrics, pct: s.sector_pct })),
    Object.fromEntries(Object.entries(stats).map(([sec, m]) => [sec, m.pe?.median ?? null])),
  );
  const tickers = [...new Set(models.flatMap((m) => m.picks.map((p) => p.ticker)))];
  const bySymbol = Object.fromEntries(members.map((s) => [s.ticker, s]));
  const [prices, spy] = await Promise.all([
    Promise.all(tickers.map((t) => getPrices(t, true))).then((all) => Object.fromEntries(tickers.map((t, i) => [t, all[i] as Series]))),
    getPrices("SPY", false),
  ]);
  const growth = (rs: { r: number }[]) => rs.reduce((v, x) => v * (1 + x.r), 1) - 1;
  const spyReturn = growth(weightedReturns({ SPY: 1 }, { SPY: spy }));

  return (
    <div className="flex flex-col gap-6">
      <p className="glass-card px-5 py-3 text-sm text-ink-muted">
        Bu portföyler, aşağıda yazan kurallarla güncel verilerden otomatik seçilir ve her veri güncellemesinde değişebilir. Eğitim ve
        karşılaştırma amaçlıdır; yatırım tavsiyesi değildir. Geçmiş getiri, eşit ağırlıkla bir yıl önce kurulup günlük yeniden dengelenmiş
        gibi hesaplanan varsayımsal bir sonuçtur.
      </p>
      {models.map((m) => {
        const weights = Object.fromEntries(m.picks.map((p) => [p.ticker, 1]));
        const series = Object.fromEntries(m.picks.map((p) => [p.ticker, prices[p.ticker] ?? []]));
        const ret = growth(weightedReturns(weights, series));
        const risk = m.picks.length
          ? assessRisk({ weights, series, benchmark: spy, info: Object.fromEntries(m.picks.map((p) => [p.ticker, assetInfo(bySymbol[p.ticker])])) })
          : null;
        return (
          <section key={m.key} className="glass-card p-5" aria-labelledby={`m-${m.key}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-[65ch]">
                <h2 id={`m-${m.key}`} className="flex items-center gap-2 text-lg font-semibold">
                  {m.name}
                  {risk ? <RiskBadge level={risk.level} /> : null}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">{m.summary}</p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-1 text-xs text-ink-muted">
                  Son 1 yıl (varsayımsal)
                  <InfoTip title="Varsayımsal getiri" align="end">
                    Bugünkü seçimin bir yıl önce eşit ağırlıkla alınıp her gün eşit ağırlığa dengelendiği varsayımıyla hesaplanır. Seçim
                    bugünün verisiyle yapıldığı için geçmişe dönük iyimser bir sonuç verebilir (geriye dönük seçim yanlılığı).
                  </InfoTip>
                </p>
                <p className={`text-2xl font-bold num ${ret >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(ret, true)}</p>
                <p className="text-xs text-ink-muted num">S&amp;P 500 (SPY): {formatPercent(spyReturn, true)}</p>
                <p className="mt-1 max-w-[16rem] text-xs text-ink-muted">Hisseler bugünün verisiyle seçildiği için bu rakam iyimserdir; gelecekteki getiriyi göstermez.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {m.picks.map((p) => (
                    <li key={p.ticker} className="flex items-center gap-2 text-sm">
                      <TickerLogo ticker={p.ticker} size={22} />
                      <Link href={`/hisseler/${p.ticker}`} className="font-semibold hover:text-primary">{p.ticker}</Link>
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{p.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">{sectorName(p.sector)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-ink-muted">Seçim kuralları</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">
                    {m.rules.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
                <div className="mt-4">
                  <CopyModelButton name={`${m.name} (örnek)`} picks={m.picks.map((p) => ({ ticker: p.ticker, price: p.price ?? 0 }))} />
                </div>
              </div>
              {risk ? <RiskCard risk={risk} title="Risk" /> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function ModelsPage() {
  return (
    <>
      <Link href="/portfoy" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Portföyler
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">Örnek portföyler</h1>
        <p className="mt-1 max-w-[65ch] text-ink-muted">Farklı yatırım yaklaşımlarını gösteren, S&amp;P 500 verilerinden kurallarla kurulan sepetler.</p>
      </header>
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Örnek portföyler hazırlanıyor" />}>
        <Models />
      </Suspense>
    </>
  );
}
