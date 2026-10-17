import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { TickerLogo } from "@/components/ticker-logo";
import { NewsList } from "@/components/news/news-list";
import { HealthGauges } from "@/components/stocks/health-gauges";
import { PriceChart } from "@/components/stocks/price-chart";
import { QuarterCharts, type QuarterPoint } from "@/components/stocks/quarter-charts";
import { RangeCard } from "@/components/stocks/range-card";
import { ScoreCard } from "@/components/stocks/score-card";
import { SectorCompare } from "@/components/stocks/sector-compare";
import { getNextEarnings, getTickerNews, requestTime } from "@/lib/data/news";
import { getPrices, getQuarters, getSectorStats, getStock, type SectorStat } from "@/lib/data/stocks";
import { formatDate, formatMetric, formatMoney, formatPercent, formatPeriod, formatPrice } from "@/lib/format";
import { METRIC_BY_KEY } from "@/lib/metrics/definitions";
import { sectorName } from "@/lib/sectors";

export async function generateMetadata({ params }: PageProps<"/hisseler/[ticker]">): Promise<Metadata> {
  const { ticker } = await params;
  return { title: decodeURIComponent(ticker).toUpperCase() };
}

const KEY_STATS = ["market_cap", "pe", "pb", "ps", "eps_ttm", "net_margin", "roe", "revenue_growth_yoy"];

function StatTile({ metric, value, stat }: { metric: string; value: number | undefined; stat?: SectorStat }) {
  const d = METRIC_BY_KEY[metric];
  return (
    <div className="glass-card p-4">
      <p className="flex items-center gap-1 text-xs text-ink-muted">
        {d.short ?? d.label}
        <InfoTip title={d.short ? `${d.short} (${d.label})` : d.label} formula={d.help}>{d.meaning}</InfoTip>
      </p>
      <p className="mt-1 text-xl font-semibold num">{formatMetric(value, d.format)}</p>
      {stat ? <p className="mt-1 text-xs text-ink-muted num">Sektör: {formatMetric(stat.median, d.format)}</p> : null}
    </div>
  );
}

function Badge({ children, tip }: { children: React.ReactNode; tip?: { title: string; text: string } }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-outline-soft px-2 py-0.5 text-xs text-ink-muted">
      {children}
      {tip ? <InfoTip title={tip.title}>{tip.text}</InfoTip> : null}
    </span>
  );
}

async function StockDetail({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: raw } = await params;
  const stock = await getStock(decodeURIComponent(raw));
  if (!stock) notFound();

  const isEtf = stock.asset_type === "etf";
  const [quarters, prices, stats, news, nextEarnings, now] = await Promise.all([
    isEtf ? Promise.resolve([]) : getQuarters(stock.cik),
    getPrices(stock.ticker, stock.core),
    isEtf ? Promise.resolve({} as Record<string, SectorStat>) : getSectorStats(stock.sector),
    getTickerNews(stock.ticker),
    isEtf ? Promise.resolve(null) : getNextEarnings(stock.ticker),
    requestTime(),
  ]);
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
  const hasFundamentals = quarterPoints.length > 0;
  const up = (stock.change_1d ?? 0) >= 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <TickerLogo ticker={stock.ticker} size={44} etf={isEtf} />
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{stock.name}</h1>
            <span className="rounded-[var(--radius-control)] bg-surface-container px-2 py-1 text-sm font-semibold">{stock.ticker}</span>
            {isEtf ? (
              <Badge tip={{ title: "ETF nedir?", text: "Borsada hisse gibi alınıp satılan bir fon. İçinde birçok hisse ya da varlık bulunur; tek bir şirket değildir. Bu yüzden bilanço ve Kairos Skoru yoktur, yalnızca fiyat performansı gösterilir." }}>
                ETF
              </Badge>
            ) : null}
            {!isEtf && !stock.in_sp500 ? (
              <Badge tip={{ title: "S&P 500 dışı hisse", text: "Bu şirket S&P 500 endeksinde değil. Sektör karşılaştırması ve skor, aynı sektördeki S&P 500 şirketlerine göre yapılır; bu hisse sektör ortalamalarını değiştirmez." }}>
                S&amp;P 500 dışı
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {isEtf ? "Borsa yatırım fonu" : sectorName(stock.sector)}
            {stock.sub_industry ? `, ${stock.sub_industry}` : ""}
            {stock.exchange ? ` · ${stock.exchange}` : ""}
          </p>
          {nextEarnings ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
              Sonraki bilanço: {formatDate(nextEarnings.report_date)}
              {nextEarnings.time_of_day === "pre-market" ? ", açılış öncesi" : nextEarnings.time_of_day === "post-market" ? ", kapanış sonrası" : ""}
              {nextEarnings.estimate_eps != null ? ` · beklenen hisse başı kâr ${formatPrice(nextEarnings.estimate_eps)}` : ""}
            </p>
          ) : null}
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
          {!isEtf && hasFundamentals ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {KEY_STATS.map((k) => (
                <StatTile key={k} metric={k} value={stock.metrics[k]} stat={stats[k]} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          {!isEtf ? <ScoreCard score={stock.score} parts={stock.score_parts} /> : null}
          <RangeCard price={stock.price} metrics={stock.metrics} />
        </div>
      </div>

      {!isEtf && hasFundamentals ? (
        <>
          <h2 className="mt-8 mb-1 text-lg font-semibold">Çeyreklik sonuçlar</h2>
          <p className="mb-4 text-sm text-ink-muted">
            SEC&apos;e verilen 10-Q ve 10-K raporlarından, takvim çeyreklerine göre. Son dönem:{" "}
            {stock.latest_period ? formatPeriod(stock.latest_period) : "—"}.
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
            <HealthGauges metrics={stock.metrics} stats={stats} />
          </div>
        </>
      ) : !isEtf ? (
        <section className="glass-card mt-8 max-w-[65ch] p-6">
          <h2 className="font-semibold">Bilanço verisi yok</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Bu şirketin SEC&apos;e verdiği raporlarda standart (US-GAAP) bilanço kalemleri bulunamadı. Genelde yabancı şirketler
            (IFRS ile raporlayanlar) ya da çok yeni halka açılan şirketler böyledir. Fiyat verileri yine de güncel.
          </p>
        </section>
      ) : null}

      <section className="glass-card mt-8 p-5" aria-labelledby="news-title">
        <h2 id="news-title" className="flex items-center gap-1 font-semibold">
          Haberler
          <InfoTip title="Hisse haberleri">
            Bu hisseyle etiketlenmiş son haberler (Marketaux) ve şirket adının geçtiği büyük yayın başlıkları. Olumlu/olumsuz
            etiketi haber metninin otomatik duygu analizidir.
          </InfoTip>
        </h2>
        <div className="mt-3">
          <NewsList now={now} items={news} showTickers={false} emptyText="Son 30 günde bu hisseyle eşleşen haber yok. Haberler her güncellemede birikir." />
        </div>
      </section>

      {!isEtf && stock.sector && hasFundamentals ? (
        <div className="mt-8">
          <SectorCompare sector={stock.sector} metrics={stock.metrics} pct={stock.sector_pct} stats={stats} />
        </div>
      ) : null}
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
