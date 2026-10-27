import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { DeletePortfolioButton, RemovePositionButton } from "@/components/portfolio/buttons";
import { PositionForm } from "@/components/portfolio/position-form";
import { RiskCard } from "@/components/portfolio/risk-card";
import { ValueChart } from "@/components/portfolio/value-chart";
import { TickerLogo } from "@/components/ticker-logo";
import { requestTime } from "@/lib/data/news";
import { analyze, getPortfolio } from "@/lib/data/portfolios";
import { getOwner } from "@/lib/supabase/server";
import { getSeries } from "@/lib/data/macro";
import { benchmarkHistory, historyInTry, rateOn, tryBreakdown } from "@/lib/portfolio/currency";
import { formatDate, formatMoney, formatPercent, formatPrice } from "@/lib/format";
import { sectorName } from "@/lib/sectors";

export const metadata: Metadata = { title: "Portföy" };

function Bars({ title, rows }: { title: string; rows: { label: string; weight: number; href?: string }[] }) {
  return (
    <section className="glass-card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="text-sm">
            <div className="mb-1 flex justify-between gap-2">
              {r.href ? <Link href={r.href} className="truncate hover:text-primary">{r.label}</Link> : <span className="truncate">{r.label}</span>}
              <span className="text-ink-muted num">%{(r.weight * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span>
            </div>
            <span className="block h-2 rounded-full bg-surface-high" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, r.weight * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tl = sp.para === "tl";
  if (!(await getOwner())) notFound();
  const portfolio = await getPortfolio(id);
  if (!portfolio) notFound();
  const [a, now, rates] = await Promise.all([analyze(portfolio.positions), requestTime(), getSeries("USDTRY")]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(now));
  const { holdings: h } = a;
  const prices = Object.fromEntries(h.rows.map((r) => [r.ticker, r.price]));
  const fx = rates.length ? tryBreakdown(portfolio.positions, prices, rates, today) : null;
  const sym = tl && fx ? "₺" : "$";
  const bench = benchmarkHistory(portfolio.positions, a.history.map((p) => p.date), a.spy);
  const historyUsd = a.history.map((p, i) => ({ ...p, benchmark: bench[i] }));
  const history = sym === "₺"
    ? historyInTry(portfolio.positions, a.history, rates).map((p, i) => ({ ...p, benchmark: bench[i] == null ? null : bench[i]! * (rateOn(rates, p.date) ?? 0) }))
    : historyUsd;
  const value = sym === "₺" ? fx!.valueTry : h.value;
  const cost = sym === "₺" ? fx!.costTry : h.cost;
  const pnl = value - cost;
  const pnlPct = cost ? value / cost - 1 : null;
  const up = pnl >= 0;
  const lastBench = bench.at(-1);
  const spyPnlPct = lastBench != null && a.history.at(-1)?.invested ? lastBench / a.history.at(-1)!.invested - 1 : null;

  const byTicker = new Map<string, number>();
  const bySector = new Map<string, number>();
  for (const r of h.rows) {
    byTicker.set(r.ticker, (byTicker.get(r.ticker) ?? 0) + r.weight);
    const s = a.stocks[r.ticker];
    const key = s?.asset_type === "etf" ? "ETF'ler" : sectorName(s?.sector);
    bySector.set(key, (bySector.get(key) ?? 0) + r.weight);
  }
  const firstBuy = portfolio.positions[0]?.buy_date;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{portfolio.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {portfolio.positions.length} pozisyon{firstBuy ? ` · ilk alım ${formatDate(firstBuy)}` : ""}{portfolio.note ? ` · ${portfolio.note}` : ""}
          </p>
        </div>
        <div className="text-right">
          {fx ? (
            <div role="group" aria-label="Para birimi" className="mb-2 inline-flex rounded-[var(--radius-control)] bg-surface-container/70 p-1 text-xs">
              <Link href={`/portfoy/${portfolio.id}`} aria-current={sym === "$" ? "true" : undefined}
                className={`rounded-md px-3 py-1 font-medium ${sym === "$" ? "bg-elevated text-ink shadow-sm" : "text-ink-muted"}`}>Dolar</Link>
              <Link href={`/portfoy/${portfolio.id}?para=tl`} aria-current={sym === "₺" ? "true" : undefined}
                className={`rounded-md px-3 py-1 font-medium ${sym === "₺" ? "bg-elevated text-ink shadow-sm" : "text-ink-muted"}`}>TL</Link>
            </div>
          ) : null}
          <p className="text-3xl font-bold tracking-tight num">{formatMoney(value, sym)}</p>
          {portfolio.positions.length ? (
            <p className={`text-sm font-medium num ${up ? "text-gain" : "text-loss"}`}>
              {up ? "+" : "−"}{formatMoney(Math.abs(pnl), sym)} ({formatPercent(pnlPct, true)}) · yatırılan {formatMoney(cost, sym)}
            </p>
          ) : null}
        </div>
      </header>

      {portfolio.positions.length && (fx || spyPnlPct != null) ? (
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {fx ? (
            <section className="glass-card p-5" aria-labelledby="tl-title">
              <h2 id="tl-title" className="flex items-center gap-1 font-semibold">
                TL bazında
                <InfoTip title="TL hesabı">
                  Her alım, o günkü dolar/TL kuruyla TL&apos;ye çevrilir; bugünkü değer güncel kurla hesaplanır (ECB referans kuru). Kur kaynaklı
                  kısım, TL&apos;nin dolara karşı değer kaybından gelen kazançtır; hisseler yerinde saysa da oluşur.
                </InfoTip>
              </h2>
              <p className={`mt-1 text-2xl font-bold num ${fx.pnlTry >= 0 ? "text-gain" : "text-loss"}`}>
                {fx.pnlTry >= 0 ? "+" : "−"}{formatMoney(Math.abs(fx.pnlTry), "₺")} <span className="text-base">({formatPercent(fx.pnlPct, true)})</span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm num">
                <div><dt className="text-ink-muted">Hisselerden</dt><dd className={fx.fromStocks >= 0 ? "text-gain" : "text-loss"}>{fx.fromStocks >= 0 ? "+" : "−"}{formatMoney(Math.abs(fx.fromStocks), "₺")}</dd></div>
                <div><dt className="text-ink-muted">Kurdan</dt><dd className={fx.fromCurrency >= 0 ? "text-gain" : "text-loss"}>{fx.fromCurrency >= 0 ? "+" : "−"}{formatMoney(Math.abs(fx.fromCurrency), "₺")}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-ink-muted num">Güncel kur: 1 $ = {fx.rate.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺</p>
            </section>
          ) : null}
          {spyPnlPct != null ? (
            <section className="glass-card p-5" aria-labelledby="bench-title">
              <h2 id="bench-title" className="flex items-center gap-1 font-semibold">
                S&amp;P 500 ile kıyas
                <InfoTip title="Kıyas nasıl hesaplanıyor?">
                  Her alımda harcadığın tutarla aynı gün SPY (S&amp;P 500 ETF&apos;i) alsaydın bugün ne kadar ederdi. Fiyat geçmişi son bir yılla sınırlı
                  olduğu için daha eski alımlar bir yıl önceki fiyattan hesaplanır. Temettüler dahil değildir.
                </InfoTip>
              </h2>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm num">
                <div><dt className="text-ink-muted">Portföyün</dt><dd className={`text-xl font-bold ${(a.history.at(-1) && a.history.at(-1)!.value >= a.history.at(-1)!.invested) ? "text-gain" : "text-loss"}`}>{formatPercent(a.history.at(-1)?.invested ? a.history.at(-1)!.value / a.history.at(-1)!.invested - 1 : null, true)}</dd></div>
                <div><dt className="text-ink-muted">SPY olsaydı</dt><dd className={`text-xl font-bold ${spyPnlPct >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(spyPnlPct, true)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-ink-muted">Dolar bazında, grafikteki dönem için.</p>
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="glass-card p-5" aria-labelledby="value-title">
            <h2 id="value-title" className="flex items-center gap-1 font-semibold">
              Değer geçmişi
              <InfoTip title="Değer geçmişi">
                Mavi alan portföyün o günkü piyasa değeri, kesikli çizgi o güne kadar yatırılan toplam tutar, turuncu çizgi aynı alımlar SPY ile yapılsaydı oluşacak değerdir. Aradaki fark kâr ya da
                zarardır. Fiyat geçmişi son bir yılla sınırlıdır; daha eski alımlar bir yıl öncesinden itibaren çizilir.
              </InfoTip>
            </h2>
            <div className="mt-4">
              <ValueChart points={history} symbol={sym} />
            </div>
          </section>
          <section className="glass-card p-5" aria-labelledby="pos-title">
            <h2 id="pos-title" className="mb-3 font-semibold">Pozisyonlar</h2>
            {h.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm num">
                  <thead>
                    <tr className="text-left text-ink-muted">
                      <th scope="col" className="py-2 pr-3 font-medium">Varlık</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Adet</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Alış</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Güncel</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Değer</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Kâr/zarar</th>
                      <th scope="col" className="py-2"><span className="sr-only">Sil</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.rows.map((r) => (
                      <tr key={r.id} className="border-t border-outline-soft/40">
                        <td className="py-2 pr-3">
                          <Link href={`/hisseler/${r.ticker}`} className="flex items-center gap-2 hover:text-primary">
                            <TickerLogo ticker={r.ticker} size={22} etf={a.stocks[r.ticker]?.asset_type === "etf"} />
                            <span className="font-semibold">{r.ticker}</span>
                          </Link>
                          <span className="text-xs text-ink-muted">{formatDate(r.buy_date)}</span>
                        </td>
                        <td className="py-2 pr-3 text-right">{r.shares.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}</td>
                        <td className="py-2 pr-3 text-right">{formatPrice(r.buy_price)}</td>
                        <td className="py-2 pr-3 text-right">{formatPrice(r.price)}</td>
                        <td className="py-2 pr-3 text-right">{formatMoney(r.value)}</td>
                        <td className={`py-2 pr-3 text-right ${(r.pnl ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                          {r.pnl == null ? "—" : `${r.pnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(r.pnl))}`}
                          <span className="block text-xs">{formatPercent(r.pnlPct, true)}</span>
                        </td>
                        <td className="py-2 text-right"><RemovePositionButton id={r.id!} label={r.ticker} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Henüz pozisyon yok. Sağdaki formdan ilk hisseni ekle.</p>
            )}
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <PositionForm portfolioId={portfolio.id} today={today} />
          {a.risk ? <RiskCard risk={a.risk} /> : null}
        </div>
      </div>

      {h.rows.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Bars title="Varlık dağılımı" rows={[...byTicker].sort((x, y) => y[1] - x[1]).map(([t, w]) => ({ label: t, weight: w, href: `/hisseler/${t}` }))} />
          <Bars title="Sektör dağılımı" rows={[...bySector].sort((x, y) => y[1] - x[1]).map(([s, w]) => ({ label: s, weight: w }))} />
        </div>
      ) : null}

      <div className="mt-8 flex justify-end">
        <DeletePortfolioButton id={portfolio.id} />
      </div>
    </>
  );
}

export default function PortfolioPage({ params, searchParams }: PageProps<"/portfoy/[id]">) {
  return (
    <>
      <Link href="/portfoy" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Portföyler
      </Link>
      <Suspense fallback={<div className="glass-card h-[32rem] animate-pulse" aria-label="Portföy yükleniyor" />}>
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
