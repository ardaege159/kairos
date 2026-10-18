import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CreatePortfolioForm } from "@/components/portfolio/create-form";
import { RiskBadge } from "@/components/portfolio/risk-card";
import { TickerLogo } from "@/components/ticker-logo";
import { analyze, listPortfolios } from "@/lib/data/portfolios";
import { formatMoney, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Portföy" };

async function Portfolios() {
  const portfolios = await listPortfolios();
  const analyses = await Promise.all(portfolios.map((p) => analyze(p.positions)));
  return (
    <div className="flex flex-col gap-4">
      <section className="glass-card p-5">
        <CreatePortfolioForm />
      </section>
      {portfolios.length === 0 ? (
        <section className="glass-card max-w-[65ch] p-6">
          <h2 className="font-semibold">Henüz portföyün yok</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Bir ad verip portföy oluştur, sonra hisse ve ETF&apos;leri alış fiyatı ve tarihiyle ekle. Kairos kâr/zararı, değer geçmişini ve
            risk seviyesini hesaplar. İstersen önce örnek portföylere göz at.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {portfolios.map((p, i) => {
            const a = analyses[i];
            const up = a.holdings.pnl >= 0;
            return (
              <Link key={p.id} href={`/portfoy/${p.id}`} className="glass-card flex flex-col gap-3 p-5 hover:shadow-[0_10px_30px_rgb(99_102_241/0.16)]">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{p.name}</h2>
                  {a.risk ? <RiskBadge level={a.risk.level} /> : null}
                </div>
                <div>
                  <p className="text-2xl font-bold num">{formatMoney(a.holdings.value)}</p>
                  {p.positions.length ? (
                    <p className={`text-sm num ${up ? "text-gain" : "text-loss"}`}>
                      {up ? "+" : "−"}{formatMoney(Math.abs(a.holdings.pnl))} ({formatPercent(a.holdings.pnlPct, true)})
                    </p>
                  ) : (
                    <p className="text-sm text-ink-muted">Pozisyon yok</p>
                  )}
                </div>
                <div className="flex -space-x-1.5">
                  {[...new Set(p.positions.map((x) => x.ticker))].slice(0, 8).map((t) => (
                    <TickerLogo key={t} ticker={t} size={24} etf={a.stocks[t]?.asset_type === "etf"} className="ring-2 ring-white" />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortfoyPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Portföy" description="Kendi portföylerini oluştur; kâr/zarar, değer geçmişi ve risk seviyesini takip et." />
        <Link href="/portfoy/modeller" className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-white/70">
          <Sparkles size={16} aria-hidden /> Örnek portföyler
        </Link>
      </div>
      <Suspense fallback={<div className="glass-card h-64 animate-pulse" aria-label="Portföyler yükleniyor" />}>
        <Portfolios />
      </Suspense>
    </>
  );
}
