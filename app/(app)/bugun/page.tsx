import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InfoTip } from "@/components/info-tip";
import { NewsList } from "@/components/news/news-list";
import { TopicPulse } from "@/components/news/topic-pulse";
import { PageHeader } from "@/components/page-header";
import { FOMC_INFO, FOMC_RELEASE_ID, releaseInfo } from "@/lib/calendar/releases";
import { getEarnings, getEconCalendar, getNews, requestTime, type EarningsEvent, type EconEvent } from "@/lib/data/news";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Bugün" };

/** Calendar dates are US market dates. */
function nyDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + offsetDays * 864e5));
}
function dayLabel(iso: string, today: string) {
  if (iso === today) return "Bugün";
  const d = new Date(`${iso}T12:00:00Z`);
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const name = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  return iso === tomorrow ? `Yarın, ${name}` : name;
}
const groupBy = <T,>(xs: T[], key: (x: T) => string) =>
  xs.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]), new Map<string, T[]>());

function EconList({ events, today }: { events: EconEvent[]; today: string }) {
  if (!events.length) return <p className="text-sm text-ink-muted">Önümüzdeki günlerde takvimde önemli bir veri yok.</p>;
  return (
    <div className="space-y-4">
      {[...groupBy(events, (e) => e.date)].map(([date, list]) => (
        <div key={date}>
          <h3 className={`mb-1.5 text-xs font-semibold ${date === today ? "text-primary-strong" : "text-ink-muted"}`}>{dayLabel(date, today)}</h3>
          <ul className="space-y-1.5">
            {list.map((e) => {
              const fomc = e.release_id === FOMC_RELEASE_ID;
              const info = fomc ? null : releaseInfo(e.name);
              const label = fomc ? FOMC_INFO.label + (e.name.endsWith("*") ? " · tahminlerle" : "") : info?.label ?? e.name;
              return (
                <li key={`${e.date}-${e.release_id}`} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${e.importance >= 2 ? "bg-secondary" : "bg-outline-soft"}`} aria-label={e.importance >= 2 ? "yüksek önem" : "normal önem"} />
                  <span className={e.importance >= 2 ? "font-medium" : ""}>{label}</span>
                  <InfoTip title={label} align="end">{fomc ? FOMC_INFO.help : info?.help ?? e.name}</InfoTip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const TIME_LABEL: Record<string, string> = { "pre-market": "Açılış öncesi", "post-market": "Kapanış sonrası" };

function EarningsList({ events, today }: { events: EarningsEvent[]; today: string }) {
  if (!events.length) return <p className="text-sm text-ink-muted">Önümüzdeki günlerde bilanço açıklayacak şirket görünmüyor.</p>;
  return (
    <div className="space-y-4">
      {[...groupBy(events, (e) => e.report_date)].map(([date, list]) => (
        <div key={date}>
          <h3 className={`mb-1.5 text-xs font-semibold ${date === today ? "text-primary-strong" : "text-ink-muted"}`}>
            {dayLabel(date, today)} <span className="font-normal">· {list.length} şirket</span>
          </h3>
          <ul className="space-y-1">
            {list.slice(0, 8).map((e) => (
              <li key={e.ticker} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <Link href={`/hisseler/${e.ticker}`} className="font-semibold hover:text-primary">{e.ticker}</Link>
                <span className="truncate text-ink-muted">{e.name}</span>
                <span className="text-right text-xs text-ink-muted num">
                  {e.time_of_day ? TIME_LABEL[e.time_of_day] ?? e.time_of_day : "Saat belirsiz"}
                  {e.market_cap ? ` · ${formatMoney(e.market_cap)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {list.length > 8 ? <p className="mt-1 text-xs text-ink-muted">ve {list.length - 8} şirket daha (piyasa değerine göre ilk 8 gösteriliyor)</p> : null}
        </div>
      ))}
    </div>
  );
}

async function Today() {
  const today = nyDate();
  const until = nyDate(7);
  const [now, global, company, econ, earnings] = await Promise.all([
    requestTime(),
    getNews({ kind: "global", hours: 24, limit: 80 }),
    getNews({ kind: "company", hours: 24, limit: 30 }),
    getEconCalendar(today, until),
    getEarnings(today, until),
  ]);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const closed = weekday === 0 || weekday === 6;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {closed ? (
          <p className="glass-card px-5 py-3 text-sm text-ink-muted">ABD borsaları bugün kapalı (hafta sonu). Aşağıda önümüzdeki işlem günlerinin takvimi var.</p>
        ) : null}
        <section className="glass-card p-5" aria-labelledby="pulse-title">
          <h2 id="pulse-title" className="flex items-center gap-1 font-semibold">
            Son 24 saatte gündem
            <InfoTip title="Gündem nasıl ölçülüyor?">
              CNBC, MarketWatch, Financial Times, Investing.com ve BBC&apos;nin son 24 saatlik başlıkları konulara göre sınıflandırılır.
              Çubuk, o konuda kaç başlık çıktığını gösterir. Bir konuya tıklayınca o konunun haberlerini görürsün.
            </InfoTip>
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">Piyasayı en çok meşgul eden konular.</p>
          <TopicPulse items={global} linkBase="/piyasa" />
        </section>
        <section className="glass-card p-5" aria-labelledby="global-title">
          <h2 id="global-title" className="mb-3 font-semibold">Günün gelişmeleri</h2>
          <NewsList now={now} items={global.slice(0, 12)} emptyText="Son 24 saatte haber yok. Haberleri güncellemek için veri betiğini çalıştır." />
          <Link href="/piyasa" className="mt-3 inline-block text-sm text-primary hover:underline">Tüm haberler</Link>
        </section>
        <section className="glass-card p-5" aria-labelledby="company-title">
          <h2 id="company-title" className="flex items-center gap-1 font-semibold">
            Şirket haberleri
            <InfoTip title="Olumlu / olumsuz etiketi">
              Marketaux&apos;un haber metnini analiz ederek hisse için verdiği duygu puanı. Otomatik bir tahmindir; haberi okumadan
              karar verme.
            </InfoTip>
          </h2>
          <div className="mt-3">
            <NewsList now={now} items={company.slice(0, 10)} emptyText="Son 24 saatte şirket haberi yok." />
          </div>
        </section>
      </div>
      <div className="flex flex-col gap-4">
        <section className="glass-card p-5" aria-labelledby="econ-title">
          <h2 id="econ-title" className="flex items-center gap-1 font-semibold">
            Açıklanacak veriler
            <InfoTip title="Ekonomik takvim" align="end">
              ABD&apos;de açıklanacak önemli ekonomik veriler (FRED) ve Fed toplantı günleri. Mor nokta, piyasayı genelde en çok
              hareketlendiren verilerdir. Saatler kaynakta yok; çoğu veri ABD saatiyle 08:30&apos;da (TSİ 15:30–16:30) açıklanır.
            </InfoTip>
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">Önümüzdeki 7 gün.</p>
          <EconList events={econ} today={today} />
        </section>
        <section className="glass-card p-5" aria-labelledby="earnings-title">
          <h2 id="earnings-title" className="flex items-center gap-1 font-semibold">
            Bilanço açıklayacaklar
            <InfoTip title="Bilanço takvimi" align="end">
              Çeyrek sonuçlarını açıklayacak şirketler (Alpha Vantage). Açılış öncesi açıklananlar o günün fiyatını, kapanış
              sonrası açıklananlar ertesi günün açılışını etkiler.
            </InfoTip>
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">Önümüzdeki 7 gün, büyük şirketler önce.</p>
          <EarningsList events={earnings} today={today} />
        </section>
      </div>
    </div>
  );
}

export default function BugunPage() {
  return (
    <>
      <PageHeader title="Bugün" description="Piyasayı etkileyen gelişmeler, açıklanacak ekonomik veriler ve bilanço takvimi." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Bugün yükleniyor" />}>
        <Today />
      </Suspense>
    </>
  );
}
