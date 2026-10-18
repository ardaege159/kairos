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

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const portfolio = await getPortfolio(id);
  if (!portfolio) notFound();
  const [a, now] = await Promise.all([analyze(portfolio.positions), requestTime()]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(now));
  const { holdings: h } = a;
  const up = h.pnl >= 0;

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
          <p className="text-3xl font-bold tracking-tight num">{formatMoney(h.value)}</p>
          {portfolio.positions.length ? (
            <p className={`text-sm font-medium num ${up ? "text-gain" : "text-loss"}`}>
              {up ? "+" : "−"}{formatMoney(Math.abs(h.pnl))} ({formatPercent(h.pnlPct, true)}) · yatırılan {formatMoney(h.cost)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="glass-card p-5" aria-labelledby="value-title">
            <h2 id="value-title" className="flex items-center gap-1 font-semibold">
              Değer geçmişi
              <InfoTip title="Değer geçmişi">
                Mavi alan portföyün o günkü piyasa değeri, kesikli çizgi o güne kadar yatırılan toplam tutardır. Aradaki fark kâr ya da
                zarardır. Fiyat geçmişi son bir yılla sınırlıdır; daha eski alımlar bir yıl öncesinden itibaren çizilir.
              </InfoTip>
            </h2>
            <div className="mt-4">
              <ValueChart points={a.history} />
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

export default function PortfolioPage({ params }: PageProps<"/portfoy/[id]">) {
  return (
    <>
      <Link href="/portfoy" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Portföyler
      </Link>
      <Suspense fallback={<div className="glass-card h-[32rem] animate-pulse" aria-label="Portföy yükleniyor" />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}
