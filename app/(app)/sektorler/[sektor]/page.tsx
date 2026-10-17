import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { PerformanceChart } from "@/components/compare/performance-chart";
import { InfoTip } from "@/components/info-tip";
import { NewsList } from "@/components/news/news-list";
import { TickerLogo } from "@/components/ticker-logo";
import { getEarnings, getNews, requestTime } from "@/lib/data/news";
import { getCompanySpending, getSectorSpending } from "@/lib/data/spending";
import { getAllSectorStats, getPrices, listSp500 } from "@/lib/data/stocks";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { quantile } from "@/lib/metrics/compute";
import { TOPIC_LABEL } from "@/lib/news/topics";
import { SECTOR_ETF, sectorFromSlug, sectorName } from "@/lib/sectors";
import { sectorInsights, type Contributor, type Reason } from "@/lib/sectors/insights";

export async function generateMetadata({ params }: PageProps<"/sektorler/[sektor]">): Promise<Metadata> {
  const { sektor } = await params;
  const s = sectorFromSlug(sektor);
  return { title: s ? sectorName(s) : "Sektör" };
}

const median = (xs: (number | null | undefined)[]) => quantile(xs.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b), 0.5);

function ReasonIcon({ tone }: { tone: Reason["tone"] }) {
  const cls = "mt-0.5 shrink-0";
  if (tone === "positive") return <TrendingUp size={18} className={`${cls} text-gain`} aria-label="olumlu" />;
  if (tone === "negative") return <TrendingDown size={18} className={`${cls} text-loss`} aria-label="olumsuz" />;
  return <Minus size={18} className={`${cls} text-outline`} aria-label="nötr" />;
}

function ContributorTable({ title, rows, tip }: { title: string; rows: Contributor[]; tip: string }) {
  return (
    <section className="glass-card p-5">
      <h2 className="mb-3 flex items-center gap-1 font-semibold">
        {title}
        <InfoTip title={title}>{tip}</InfoTip>
      </h2>
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((c) => (
            <li key={c.ticker} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-3 text-sm">
              <Link href={`/hisseler/${c.ticker}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
                <TickerLogo ticker={c.ticker} size={24} />
                <span className="font-semibold">{c.ticker}</span>
                <span className="truncate text-ink-muted">{c.name}</span>
              </Link>
              <span className={`text-right num ${c.return_3m >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(c.return_3m, true)}</span>
              <span className="text-right text-xs text-ink-muted num" title="Sektör içindeki piyasa değeri ağırlığı">ağ. {formatPercent(c.weight)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Yok.</p>
      )}
    </section>
  );
}

async function SectorDetail({ params }: { params: Promise<{ sektor: string }> }) {
  const { sektor } = await params;
  const sector = sectorFromSlug(sektor);
  if (!sector) notFound();
  const label = sectorName(sector);
  const etf = SECTOR_ETF[sector];

  const now = await requestTime();
  const today = new Date(now).toISOString().slice(0, 10);
  const in14 = new Date(now + 14 * 864e5).toISOString().slice(0, 10);
  const [members, stats, news, etfPrices, spyPrices, earnings, sectorSpending, topSpending] = await Promise.all([
    listSp500(),
    getAllSectorStats(),
    getNews({ sector, hours: 168, limit: 200 }),
    etf ? getPrices(etf, false) : Promise.resolve([]),
    getPrices("SPY", false),
    getEarnings(today, in14),
    getSectorSpending(),
    getCompanySpending({ sector, limit: 6 }),
  ]);
  const inSector = members.filter((m) => m.sector === sector);
  const tickers = new Set(inSector.map((m) => m.ticker));

  const statOf = (sec: string, k: string) => stats[sec]?.[k]?.median ?? null;
  const ranking = Object.keys(stats)
    .map((sec) => [sec, statOf(sec, "return_3m")] as const)
    .filter((e): e is readonly [string, number] => e[1] != null)
    .sort((a, b) => b[1] - a[1]);
  const rank3m = ranking.findIndex(([sec]) => sec === sector) + 1 || null;

  const topicCounts = new Map<string, number>();
  for (const n of news) if (n.topic && n.topic !== "markets" && n.topic !== "earnings") topicCounts.set(n.topic, (topicCounts.get(n.topic) ?? 0) + 1);
  const spendTotal = Object.values(sectorSpending).reduce((a, b) => a + b, 0);
  const spendRank = Object.entries(sectorSpending).sort((a, b) => b[1] - a[1]).findIndex(([sec]) => sec === sector) + 1 || null;

  const insight = sectorInsights({
    label,
    sector: { return_1m: statOf(sector, "return_1m"), return_3m: statOf(sector, "return_3m"), revenue_growth_yoy: statOf(sector, "revenue_growth_yoy"), net_margin: statOf(sector, "net_margin"), pe: statOf(sector, "pe") },
    market: {
      return_1m: median(members.map((m) => m.metrics.return_1m)), return_3m: median(members.map((m) => m.metrics.return_3m)),
      revenue_growth_yoy: median(members.map((m) => m.metrics.revenue_growth_yoy)), net_margin: median(members.map((m) => m.metrics.net_margin)), pe: median(members.map((m) => m.metrics.pe)),
    },
    rank3m, sectorCount: ranking.length,
    members: inSector.map((m) => ({ ticker: m.ticker, name: m.name, market_cap: m.metrics.market_cap ?? null, return_1m: m.metrics.return_1m ?? null, return_3m: m.metrics.return_3m ?? null })),
    topics: [...topicCounts].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ label: TOPIC_LABEL[k] ?? k, count })),
    spendingShare: spendTotal ? (sectorSpending[sector] ?? 0) / spendTotal : null,
    spendingRank: sectorSpending[sector] ? spendRank : null,
    earningsSoon: earnings.filter((e) => tickers.has(e.ticker)).length,
  });
  const sectorEarnings = earnings.filter((e) => tickers.has(e.ticker)).slice(0, 8);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{label}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {inSector.length} S&amp;P 500 şirketi{etf ? ` · sektör ETF'i ${etf}` : ""}
          </p>
        </div>
        <Link href={`/hisseler?sektor=${encodeURIComponent(sector)}&evren=sp500`} className="text-sm font-medium text-primary hover:underline">
          Sektördeki tüm hisseler
        </Link>
      </header>

      <section className="glass-card p-6" aria-labelledby="why-title">
        <h2 id="why-title" className="flex items-center gap-1 text-lg font-semibold">
          Sektörde neler oluyor?
          <InfoTip title="Bu açıklama nasıl üretiliyor?">
            Fiyat performansı, şirketlerin bilançoları, son 7 günün haber başlıkları, federal sözleşmeler ve bilanço takviminden kurallarla
            çıkarılır; yapay zekâ kullanılmaz. Bunlar olası etkenlerdir, kesin neden-sonuç iddiası değildir.
          </InfoTip>
        </h2>
        <p className="mt-2 max-w-[75ch] leading-relaxed">{insight.headline}</p>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {insight.reasons.map((r) => (
            <li key={r.key} className="flex gap-3">
              <ReasonIcon tone={r.tone} />
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{r.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {etf && etfPrices.length ? (
        <section className="glass-card mt-4 p-5" aria-labelledby="etf-title">
          <h2 id="etf-title" className="flex items-center gap-1 font-semibold">
            {etf} ile S&amp;P 500 (SPY), son 1 yıl
            <InfoTip title="Sektör ETF'i">
              {etf}, {label} sektöründeki S&amp;P 500 şirketlerini piyasa değerine göre tutan fon. SPY tüm S&amp;P 500&apos;ü temsil eder.
              Mor çizgi üstteyse sektör piyasadan iyi gidiyor.
            </InfoTip>
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">Başlangıç noktası %0 olacak şekilde.</p>
          <PerformanceChart series={[
            { ticker: etf, points: etfPrices, color: "#4648d4", label: `${etf} · ${label}` },
            { ticker: "SPY", points: spyPrices, color: "#767586", dashed: true, label: "SPY · S&P 500" },
          ]} />
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ContributorTable title="Sektörü yukarı taşıyanlar" rows={insight.leaders}
          tip="Son 3 aydaki getirisi ile sektör içindeki piyasa değeri ağırlığının çarpımı en yüksek olanlar: sektörün yükselişine en çok katkı yapan şirketler." />
        <ContributorTable title="Sektörü aşağı çekenler" rows={insight.laggards}
          tip="Son 3 ayda piyasa değeri ağırlığıyla birlikte sektörün getirisini en çok düşüren şirketler." />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-5 lg:col-span-2" aria-labelledby="snews-title">
          <h2 id="snews-title" className="mb-3 font-semibold">Sektörü ilgilendiren haberler (7 gün)</h2>
          <NewsList now={now} items={news.slice(0, 12)} emptyText="Son 7 günde bu sektörle eşleşen haber yok." />
        </section>
        <div className="flex flex-col gap-4">
          <section className="glass-card p-5" aria-labelledby="searn-title">
            <h2 id="searn-title" className="mb-3 font-semibold">Yaklaşan bilançolar (14 gün)</h2>
            {sectorEarnings.length ? (
              <ul className="space-y-2">
                {sectorEarnings.map((e) => (
                  <li key={e.ticker} className="flex items-center gap-2 text-sm">
                    <TickerLogo ticker={e.ticker} size={20} />
                    <Link href={`/hisseler/${e.ticker}`} className="font-semibold hover:text-primary">{e.ticker}</Link>
                    <span className="ml-auto text-ink-muted">{formatDate(e.report_date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Önümüzdeki 14 günde bilanço açıklayan şirket yok.</p>
            )}
          </section>
          <section className="glass-card p-5" aria-labelledby="sspend-title">
            <h2 id="sspend-title" className="flex items-center gap-1 font-semibold">
              Federal sözleşmeler (12 ay)
              <InfoTip title="Federal sözleşmeler" align="end">
                USAspending verisine göre son 12 ayda ABD federal kurumlarının bu sektördeki halka açık şirketlerle yaptığı sözleşmelerin tutarı.
              </InfoTip>
            </h2>
            {topSpending.length ? (
              <ul className="mt-3 space-y-2">
                {topSpending.map((r) => (
                  <li key={r.ticker} className="flex items-center gap-2 text-sm">
                    <TickerLogo ticker={r.ticker} size={20} />
                    <Link href={`/hisseler/${r.ticker}`} className="font-semibold hover:text-primary">{r.ticker}</Link>
                    <span className="ml-auto num">{formatMoney(r.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">Bu sektörde eşleşen federal sözleşme yok.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default function SectorPage({ params }: PageProps<"/sektorler/[sektor]">) {
  return (
    <>
      <Link href="/sektorler" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-primary">
        <ArrowLeft size={14} aria-hidden /> Sektörler
      </Link>
      <Suspense fallback={<div className="glass-card h-[32rem] animate-pulse" aria-label="Sektör yükleniyor" />}>
        <SectorDetail params={params} />
      </Suspense>
    </>
  );
}
