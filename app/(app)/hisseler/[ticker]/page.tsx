import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { TickerLogo } from "@/components/ticker-logo";
import { WatchButton } from "@/components/watch-button";
import { getWatchlist } from "@/lib/data/watchlist";
import { getCompanySpending, getSpendingActions } from "@/lib/data/spending";
import { GrowthBadge } from "@/components/spending/quarter-bars";
import { growth } from "@/lib/spending/trends";
import { classifyEtf } from "@/lib/etf";
import { ProsCons } from "@/components/stocks/pros-cons";
import { ThesisSection } from "@/components/stocks/thesis-section";
import { stockPoints } from "@/lib/insights/stock";
import { InsiderTrades } from "@/components/stocks/insider-trades";
import { ValuationSection } from "@/components/stocks/valuation-section";
import { EarningsSurprises } from "@/components/stocks/earnings-surprises";
import { surpriseSummary } from "@/lib/metrics/earnings";
import { AlertForm, DeleteAlertButton } from "@/components/alerts/alert-form";
import { getAlerts } from "@/lib/data/alerts";
import { ALERT_SHORT } from "@/lib/alerts/evaluate";
import { getInsiderTrades } from "@/lib/data/insiders";
import { summarize } from "@/lib/insiders/parse";
import { NewsList } from "@/components/news/news-list";
import { HealthGauges } from "@/components/stocks/health-gauges";
import { PriceChart } from "@/components/stocks/price-chart";
import { QuarterCharts, type QuarterPoint } from "@/components/stocks/quarter-charts";
import { RangeCard } from "@/components/stocks/range-card";
import { ScoreCard } from "@/components/stocks/score-card";
import { SectorCompare } from "@/components/stocks/sector-compare";
import { getEarningsHistory, getNextEarnings, getTickerNews, requestTime } from "@/lib/data/news";
import { getPrices, getQuarters, getSectorStats, getStock, searchStocks, type SectorStat } from "@/lib/data/stocks";
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
  const [quarters, prices, stats, news, nextEarnings, now, watchlist, spending, spendingActions, insiders, alerts, earningsHistory] = await Promise.all([
    isEtf ? Promise.resolve([]) : getQuarters(stock.cik),
    getPrices(stock.ticker, stock.core),
    isEtf ? Promise.resolve({} as Record<string, SectorStat>) : getSectorStats(stock.sector),
    getTickerNews(stock.ticker),
    isEtf ? Promise.resolve(null) : getNextEarnings(stock.ticker),
    requestTime(),
    getWatchlist(),
    isEtf ? Promise.resolve([]) : getCompanySpending({ tickers: [stock.ticker], limit: 1 }),
    isEtf ? Promise.resolve([]) : getSpendingActions({ ticker: stock.ticker, limit: 8, sort: "date" }),
    isEtf || !stock.core ? Promise.resolve(null) : getInsiderTrades(stock.ticker),
    getAlerts(stock.ticker),
    isEtf ? Promise.resolve([]) : getEarningsHistory(stock.ticker),
  ]);
  const federal = spending[0];
  const points = isEtf ? null : stockPoints({
    metrics: stock.metrics,
    pct: stock.sector_pct,
    sectorMedian: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.median])),
    score: stock.score,
    price: stock.price,
    daysToEarnings: nextEarnings ? Math.round((Date.parse(`${nextEarnings.report_date}T00:00:00Z`) - now) / 864e5) : null,
    federal12m: federal?.amount ?? null,
    earnings: earningsHistory.length ? surpriseSummary(earningsHistory) : null,
    insiders: insiders ? summarize(insiders.filter((t) => Date.parse(t.date) >= now - 90 * 864e5)) : null,
  });
  const etfCategory = isEtf ? classifyEtf(stock.name) : null;
  const similar = isEtf
    ? (await searchStocks({ universe: "etf", etfCategory: etfCategory?.key ?? "diger", sort: "dollar_volume", dir: "desc", page: 1 })).rows
        .filter((r) => r.ticker !== stock.ticker)
        .slice(0, 8)
    : [];
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
            {isEtf ? `Borsa yatırım fonu${etfCategory ? ` · ${etfCategory.label}` : ""}` : sectorName(stock.sector)}
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
        <div className="flex flex-col items-end gap-1 text-right">
          <WatchButton ticker={stock.ticker} watched={watchlist.includes(stock.ticker)} />
          <p className="mt-2 text-3xl font-bold tracking-tight num">{formatPrice(stock.price)}</p>
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
          {isEtf ? (
            <section className="glass-card p-5" aria-labelledby="etf-info">
              <h2 id="etf-info" className="font-semibold">Fon bilgisi</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1 text-ink-muted">
                    Tür
                    {etfCategory ? <InfoTip title={etfCategory.label}>{etfCategory.help}</InfoTip> : null}
                  </dt>
                  <dd className="text-right font-medium">{etfCategory?.label ?? "Diğer"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1 text-ink-muted">
                    Günlük işlem hacmi
                    <InfoTip title={METRIC_BY_KEY.dollar_volume.label} formula={METRIC_BY_KEY.dollar_volume.help}>{METRIC_BY_KEY.dollar_volume.meaning}</InfoTip>
                  </dt>
                  <dd className="text-right font-medium num">{formatMoney(stock.metrics.dollar_volume)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-muted">Tür, fonun adından otomatik çıkarılır; fonun içindeki varlıkların listesi ücretsiz kaynaklarda yok.</p>
            </section>
          ) : null}
        </div>
      </div>

      {points ? (
        <Suspense fallback={<ProsCons {...points} />}>
          <ThesisSection stock={stock} points={points} quarters={quarters} federal={federal} />
        </Suspense>
      ) : null}

      {isEtf && similar.length ? (
        <section className="glass-card mt-8 p-5" aria-labelledby="similar-title">
          <h2 id="similar-title" className="font-semibold">
            Benzer ETF&apos;ler <span className="font-normal text-ink-muted">· {etfCategory?.label ?? "Diğer"}, en çok işlem görenler</span>
          </h2>
          <ul className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {similar.map((e) => (
              <li key={e.ticker} className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] items-center gap-3 text-sm">
                <Link href={`/hisseler/${e.ticker}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
                  <TickerLogo ticker={e.ticker} size={22} etf />
                  <span className="font-semibold">{e.ticker}</span>
                  <span className="truncate text-ink-muted">{e.name}</span>
                </Link>
                <span className={`text-right num ${e.return_1y == null ? "text-ink-muted" : e.return_1y >= 0 ? "text-gain" : "text-loss"}`} title="1 yıl getiri">
                  {formatPercent(e.return_1y, true)}
                </span>
                <span className="text-right text-xs text-ink-muted num" title="Günlük işlem hacmi">{formatMoney(e.dollar_volume)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isEtf && hasFundamentals ? (
        <>
          <h2 className="mt-8 mb-1 text-lg font-semibold">Çeyreklik sonuçlar</h2>
          <p className="mb-4 text-sm text-ink-muted">
            SEC&apos;e verilen 10-Q ve 10-K raporlarından, takvim çeyreklerine göre. Son dönem:{" "}
            {stock.latest_period ? formatPeriod(stock.latest_period) : "—"}.
          </p>
          <QuarterCharts data={quarterPoints} />
          <Suspense fallback={<div className="glass-card mt-4 h-72 animate-pulse" aria-label="Değerleme geçmişi yükleniyor" />}>
            <ValuationSection ticker={stock.ticker} quarters={quarters} price={stock.price} asOf={stock.as_of} />
          </Suspense>
          <EarningsSurprises rows={earningsHistory} />
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

      <section className="glass-card mt-8 p-5" aria-labelledby="alert-title">
        <h2 id="alert-title" className="mb-3 font-semibold">Alarm</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <AlertForm ticker={stock.ticker} price={stock.price} />
          <div>
            <p className="mb-2 text-sm text-ink-muted">Bu hisse için alarmların</p>
            {alerts.length ? (
              <ul className="space-y-1.5 text-sm">
                {alerts.map((a) => (
                  <li key={a.id} className={`flex items-center gap-2 ${a.active ? "" : "opacity-60"}`}>
                    <span className="flex-1 num">{ALERT_SHORT[a.kind]} {a.threshold.toLocaleString("tr-TR")}{a.kind === "move_abs" ? "%" : a.kind.startsWith("price") ? " $" : ""}{a.active ? "" : " · tetiklendi"}</span>
                    <DeleteAlertButton id={a.id} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">Kurulu alarm yok. İzleme listesindeyse bilanço, sert hareket, yönetici alımı ve büyük federal sözleşmeler için ayrıca otomatik bildirim alırsın.</p>}
          </div>
        </div>
      </section>

      {insiders ? <InsiderTrades trades={insiders} /> : null}

      {federal || spendingActions.length ? (
        <section className="glass-card mt-8 p-5" aria-labelledby="fed-title">
          <h2 id="fed-title" className="flex items-center gap-1 font-semibold">
            Federal sözleşmeler
            <InfoTip title="Federal sözleşmeler">
              USAspending.gov verisine göre ABD federal kurumlarının bu şirketle (ve yan kuruluşlarıyla) yaptığı sözleşmeler. Gelirin ne
              kadarının devletten geldiğini anlamaya yardım eder.
            </InfoTip>
          </h2>
          <div className="mt-3 grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-ink-muted">Son 12 ay sözleşme tutarı</p>
              <p className="mt-1 text-2xl font-bold num">{formatMoney(federal?.amount)}</p>
              {federal && growth(federal.amount_lagged, federal.amount_prev) != null ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                  Yıllık değişim <GrowthBadge value={growth(federal.amount_lagged, federal.amount_prev)} />
                  <InfoTip title="Yıllık değişim">3 ay önce biten 12 ay, ondan önceki 12 ayla karşılaştırılır; savunma sözleşmeleri yaklaşık 90 gün geç raporlandığı için son 3 ay dahil edilmez.</InfoTip>
                </p>
              ) : null}
              {federal?.recipients.length ? (
                <p className="mt-1 text-xs text-ink-muted">Alıcı birimler: {federal.recipients.slice(0, 4).join(", ")}{federal.recipients.length > 4 ? "…" : ""}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm text-ink-muted">Son büyük sözleşme işlemleri (ayrıntı ve yorum için tıkla)</p>
              {spendingActions.length ? (
                <ul className="space-y-1.5 text-sm">
                  {spendingActions.map((a) => (
                    <li key={a.id}>
                      <Link href={`/harcamalar/islem/${a.id}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] gap-3 hover:text-primary">
                        <span className="text-ink-muted num">{formatDate(a.action_date)}</span>
                        <span className="min-w-0">
                          <span className="block truncate">{a.agency}</span>
                          {a.psc_desc ? <span className="block truncate text-xs text-ink-muted">{a.psc_desc.toLowerCase()}</span> : null}
                        </span>
                        <span className="text-right font-medium num">{formatMoney(a.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">Son 90 günün kayıtlı en büyük işlemleri arasında bu şirket yok.</p>
              )}
            </div>
          </div>
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
