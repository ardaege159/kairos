import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { PriceChart } from "@/components/stocks/price-chart";
import { QuarterCharts, type QuarterPoint } from "@/components/stocks/quarter-charts";
import { ScoreCard } from "@/components/stocks/score-card";
import { SectorCompare } from "@/components/stocks/sector-compare";
import { getPrices, getQuarters, getSectorStats, getStock, type SectorStat } from "@/lib/data/stocks";
import { formatDate, formatMetric, formatMoney, formatPercent, formatPeriod, formatPrice } from "@/lib/format";
import { METRIC_BY_KEY } from "@/lib/metrics/definitions";

export async function generateMetadata({ params }: PageProps<"/hisseler/[ticker]">): Promise<Metadata> {
  const { ticker } = await params;
  return { title: decodeURIComponent(ticker).toUpperCase() };
}

const KEY_STATS = ["market_cap", "pe", "pb", "ps", "eps_ttm", "net_margin", "roe", "debt_to_equity"];

function StatTile({ metric, value, stat }: { metric: string; value: number | undefined; stat?: SectorStat }) {
  const d = METRIC_BY_KEY[metric];
  return (
    <div className="glass-card p-4" title={d.help}>
      <p className="text-xs text-ink-muted">{d.short ?? d.label}</p>
      <p className="mt-1 text-xl font-semibold num">{formatMetric(value, d.format)}</p>
      <p className="mt-1 text-xs text-ink-muted num">Sektör: {formatMetric(stat?.median, d.format)}</p>
    </div>
  );
}

async function StockDetail({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: raw } = await params;
  const stock = await getStock(decodeURIComponent(raw));
  if (!stock) notFound();

  const [quarters, prices, stats] = await Promise.all([getQuarters(stock.cik), getPrices(stock.ticker), getSectorStats(stock.sector)]);
  const ratio = (a?: number, b?: number) => (a == null || b == null || b === 0 ? null : a / b);
  const quarterPoints: QuarterPoint[] = quarters
    .filter((q) => q.values.revenue != null || q.values.net_income != null)
    .map((q) => ({
      period: q.period,
      revenue: q.values.revenue ?? null,
      net_income: q.values.net_income ?? null,
      gross_margin: ratio(q.values.gross_profit, q.values.revenue),
      operating_margin: ratio(q.values.operating_income, q.values.revenue),
      net_margin: ratio(q.values.net_income, q.values.revenue),
    }));
  const up = (stock.change_1d ?? 0) >= 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{stock.name}</h1>
            <span className="rounded-[var(--radius-control)] bg-surface-container px-2 py-1 text-sm font-semibold">{stock.ticker}</span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {stock.sector}
            {stock.sub_industry ? `, ${stock.sub_industry}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tracking-tight num">{formatPrice(stock.price)}</p>
          {stock.change_1d != null ? (
            <p className={`inline-flex items-center gap-1 text-sm num ${up ? "text-gain" : "text-loss"}`}>
              {up ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
              {formatPercent(Math.abs(stock.change_1d))} günlük
            </p>
          ) : null}
          {stock.as_of ? <p className="text-xs text-ink-muted">{formatDate(stock.as_of)} kapanışı</p> : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <PriceChart points={prices} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {KEY_STATS.map((k) => (
              <StatTile key={k} metric={k} value={stock.metrics[k]} stat={stats[k]} />
            ))}
          </div>
        </div>
        <ScoreCard score={stock.score} parts={stock.score_parts} />
      </div>

      <h2 className="mt-8 mb-1 text-lg font-semibold">Çeyreklik sonuçlar</h2>
      <p className="mb-4 text-sm text-ink-muted">
        SEC&apos;e verilen 10-Q ve 10-K raporlarından, takvim çeyreklerine göre. Son dönem: {stock.latest_period ? formatPeriod(stock.latest_period) : "—"}.
      </p>
      <QuarterCharts data={quarterPoints} />
      <details className="glass-card mt-4 p-5">
        <summary className="cursor-pointer text-sm font-medium">Çeyreklik sonuçları tablo olarak göster</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm num">
            <thead>
              <tr className="text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Çeyrek</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Gelir</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Net kâr</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Brüt marj</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Faaliyet marjı</th>
                <th scope="col" className="py-2 text-right font-medium">Net marj</th>
              </tr>
            </thead>
            <tbody>
              {[...quarterPoints].reverse().map((q) => (
                <tr key={q.period} className="border-t border-outline-soft/40">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">{formatPeriod(q.period)}</th>
                  <td className="py-2 pr-4 text-right">{formatMoney(q.revenue)}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(q.net_income)}</td>
                  <td className="py-2 pr-4 text-right">{formatPercent(q.gross_margin)}</td>
                  <td className="py-2 pr-4 text-right">{formatPercent(q.operating_margin)}</td>
                  <td className="py-2 text-right">{formatPercent(q.net_margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="mt-8">
        <SectorCompare sector={stock.sector} metrics={stock.metrics} pct={stock.sector_pct} stats={stats} />
      </div>
    </>
  );
}

export default function StockPage({ params }: PageProps<"/hisseler/[ticker]">) {
  return (
    <>
      <Link href="/hisseler" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Hisseler
      </Link>
      <Suspense fallback={<div className="glass-card h-[32rem] animate-pulse" aria-label="Hisse yükleniyor" />}>
        <StockDetail params={params} />
      </Suspense>
    </>
  );
}
