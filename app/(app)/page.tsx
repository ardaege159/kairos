import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, CalendarClock } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { NewsList } from "@/components/news/news-list";
import { MarketHeatmap } from "@/components/market-heatmap";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { WatchButton } from "@/components/watch-button";
import { WatchlistAdd } from "@/components/watchlist-add";
import { getNewsForTickers, getUpcomingEarningsFor, requestTime } from "@/lib/data/news";
import { getStocks, type StockRow } from "@/lib/data/stocks";
import { getWatchlist } from "@/lib/data/watchlist";
import { formatDate, formatPercent, formatPrice } from "@/lib/format";
import { sectorName } from "@/lib/sectors";

function WatchCard({ s, earnings }: { s: StockRow; earnings?: { report_date: string; time_of_day: string | null } }) {
  const up = (s.change_1d ?? 0) >= 0;
  return (
    <div className="glass-card relative transition-colors hover:border-primary/40">
    <div className="absolute top-3 right-3 z-10">
      <WatchButton ticker={s.ticker} watched compact />
    </div>
    <Link href={`/hisseler/${s.ticker}`} className="flex flex-col gap-3 rounded-[var(--radius-card)] p-4">
      <div className="flex items-center gap-3 pr-8">
        <TickerLogo ticker={s.ticker} size={36} etf={s.asset_type === "etf"} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.ticker}</p>
          <p className="truncate text-xs text-ink-muted">{s.name}</p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xl font-bold tracking-tight num">{formatPrice(s.price)}</p>
          {s.change_1d != null ? (
            <p className={`inline-flex items-center gap-1 text-sm num ${up ? "text-gain" : "text-loss"}`}>
              {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
              {formatPercent(Math.abs(s.change_1d))} günlük
            </p>
          ) : null}
        </div>
        {s.score != null ? (
          <div className="text-right">
            <p className="text-xs text-ink-muted">Kairos Skoru</p>
            <p className="text-xl font-bold text-primary num">{s.score}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted num">
        <span>1 yıl {formatPercent(s.metrics.return_1y, true)}</span>
        {s.metrics.pe != null ? <span>F/K {s.metrics.pe.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span> : null}
        <span>{s.asset_type === "etf" ? "ETF" : sectorName(s.sector)}</span>
      </div>
      {earnings ? (
        <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
          <CalendarClock size={12} aria-hidden /> Bilanço {formatDate(earnings.report_date)}
          {earnings.time_of_day === "pre-market" ? ", açılış öncesi" : earnings.time_of_day === "post-market" ? ", kapanış sonrası" : ""}
        </p>
      ) : null}
    </Link>
    </div>
  );
}

async function Dashboard() {
  const tickers = await getWatchlist();
  if (!tickers.length) {
    return (
      <section className="glass-card max-w-2xl p-6">
        <h2 className="font-semibold">İzleme listen boş</h2>
        <p className="mt-2 mb-4 text-sm text-ink-muted">
          Takip ettiğin hisseleri ekle; panelde fiyatları, skorları, yaklaşan bilanço tarihleri ve haberleri bir arada görürsün. Bir
          hissenin sayfasındaki ya da Hisseler listesindeki yıldıza basarak da ekleyebilirsin.
        </p>
        <WatchlistAdd exclude={[]} />
      </section>
    );
  }
  const [stocks, earnings, news, now] = await Promise.all([getStocks(tickers), getUpcomingEarningsFor(tickers), getNewsForTickers(tickers, 12), requestTime()]);
  const moves = stocks.filter((s) => s.change_1d != null);
  const avg = moves.length ? moves.reduce((a, s) => a + s.change_1d!, 0) / moves.length : null;
  const upCount = moves.filter((s) => s.change_1d! >= 0).length;
  const soon = Object.entries(earnings).filter(([, e]) => Date.parse(`${e.report_date}T00:00:00Z`) - now < 14 * 864e5);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <section className="glass-card p-5">
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            Listenin günlük ortalaması
            <InfoTip title="Günlük ortalama">İzleme listendeki hisselerin son işlem günündeki değişimlerinin basit ortalaması.</InfoTip>
          </p>
          <p className={`mt-1 text-3xl font-bold num ${avg == null ? "" : avg >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(avg, true)}</p>
          <p className="mt-1 text-sm text-ink-muted num">{upCount} yükselen, {moves.length - upCount} düşen</p>
        </section>
        <section className="glass-card p-5 md:col-span-2">
          <p className="text-sm text-ink-muted">Önümüzdeki 2 haftada bilanço açıklayacaklar</p>
          {soon.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {soon.map(([t, e]) => (
                <li key={t}>
                  <Link href={`/hisseler/${t}`} className="inline-flex items-center gap-2 rounded-full bg-elevated/70 px-3 py-1.5 text-sm hover:bg-elevated">
                    <TickerLogo ticker={t} size={18} />
                    <span className="font-semibold">{t}</span>
                    <span className="text-ink-muted">{formatDate(e.report_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Listendeki hisselerin önümüzdeki 2 hafta içinde bilanço tarihi yok.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="watch-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="watch-title" className="font-semibold">İzleme listem <span className="font-normal text-ink-muted">· {stocks.length} hisse</span></h2>
          <div className="w-full max-w-md">
            <WatchlistAdd exclude={tickers} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stocks.map((s) => (
            <WatchCard key={s.ticker} s={s} earnings={earnings[s.ticker]} />
          ))}
        </div>
      </section>

      <section className="glass-card p-5" aria-labelledby="watch-news">
        <h2 id="watch-news" className="mb-3 font-semibold">Listendeki hisselerin haberleri</h2>
        <NewsList now={now} items={news} emptyText="Listendeki hisseler için son 30 günde haber yok. Haberler her güncellemede birikir." />
      </section>
    </div>
  );
}

export default function PanelPage() {
  return (
    <>
      <PageHeader title="Panel" description="İzleme listendeki hisselerin fiyatı, Kairos Skoru, yaklaşan bilançoları ve haberleri." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Panel yükleniyor" />}>
        <Dashboard />
      </Suspense>
      <div className="mt-4">
        <Suspense fallback={<div className="glass-card h-[600px] animate-pulse" aria-label="Isı haritası yükleniyor" />}>
          <MarketHeatmap />
        </Suspense>
      </div>
    </>
  );
}
