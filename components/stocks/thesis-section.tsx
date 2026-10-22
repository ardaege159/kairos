import Link from "next/link";
import { Suspense } from "react";
import { AiSummary } from "@/components/stocks/ai-summary";
import { aiEnabled } from "@/lib/data/ai";
import { CircleCheck, CircleMinus, Eye } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { alpacaCloses } from "@/lib/data/alpaca";
import { getMacro } from "@/lib/data/macro";
import type { HolderOf } from "@/lib/data/investors";
import { quarterLabel } from "@/components/investors/bits";
import { getSpendingThemes, type CompanySpending } from "@/lib/data/spending";
import { getAllSectorStats, type QuarterRow, type StockRow } from "@/lib/data/stocks";
import { macroEffects } from "@/lib/insights/macro-impact";
import type { Point } from "@/lib/insights/stock";
import { buildThesis, type Category, type Reason } from "@/lib/insights/thesis";
import { macroSnapshot } from "@/lib/macro/series";
import { median, valuationHistory } from "@/lib/metrics/history";
import { sectorName } from "@/lib/sectors";
import { THEME_BY_KEY } from "@/lib/spending/themes";
import { growth } from "@/lib/spending/trends";

const ORDER: Category[] = ["Şirket", "Değerleme", "Sektör", "Makro", "Federal harcama", "Yatırımcılar"];
const STANCE_STYLE = {
  olumlu: "bg-gain-soft/50 text-gain",
  karisik: "bg-surface-container text-ink",
  olumsuz: "bg-loss-soft/70 text-loss",
} as const;

function Side({ title, icon, reasons, empty }: { title: string; icon: React.ReactNode; reasons: Reason[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      {reasons.length ? (
        <ul className="space-y-3">
          {[...reasons].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || b.weight - a.weight).map((r) => (
            <li key={`${r.category}-${r.title}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="rounded-full border border-outline-soft px-1.5 text-[10px] font-normal text-ink-muted">{r.category}</span>
                {r.title}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{r.text}</p>
              {r.source ? <p className="mt-0.5 text-[11px] text-outline">Kaynak: {r.source}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-muted">{empty}</p>}
    </div>
  );
}

/**
 * Kairos görünümü: bull and bear case from company data, own-history valuation, sector momentum,
 * macro conditions and federal spending themes. Recomputed on every visit from the latest data.
 */
export async function ThesisSection({ stock, points, quarters, federal, holders }: {
  stock: StockRow; points: { pros: Point[]; cons: Point[]; watch: Point[] }; quarters: QuarterRow[]; federal: CompanySpending | undefined; holders: HolderOf[];
}) {
  const [macro, stats, themes, prices] = await Promise.all([getMacro(), getAllSectorStats(), getSpendingThemes(), alpacaCloses(stock.ticker, 1100)]);
  const m = stock.metrics;

  // Sector rank by 3-month median return among the 11 sectors.
  const ranked = Object.entries(stats).map(([s, v]) => [s, v.return_3m?.median ?? null] as const).filter((e): e is [string, number] => e[1] != null).sort((a, b) => b[1] - a[1]);
  const rank = stock.sector ? ranked.findIndex(([s]) => s === stock.sector) + 1 : 0;

  // Own-history valuation: P/E if the company is profitable, else P/S.
  const hist = valuationHistory(new Map(quarters.map((q) => [q.period, q.values])), Object.fromEntries(quarters.map((q) => [q.period, q.period_end])), prices,
    stock.price != null && stock.as_of ? { date: stock.as_of, price: stock.price } : undefined);
  const metric = hist.filter((h) => h.pe != null).length >= 4 ? { key: "pe" as const, label: "F/K" } : { key: "ps" as const, label: "F/S" };
  const series = hist.map((h) => h[metric.key]);
  const med = median(series);
  const now = series.at(-1);

  const revenue = m.market_cap && m.ps ? m.market_cap / m.ps : null;
  const myThemes = themes
    .filter((t) => THEME_BY_KEY[t.key] && t.top_recipients.some((r) => r.ticker === stock.ticker))
    .map((t) => ({ name: THEME_BY_KEY[t.key].name, growth: growth(t.amount_12m, t.amount_prev_12m) }))
    .filter((t): t is { name: string; growth: number } => t.growth != null);

  const thesis = buildThesis({
    name: stock.name,
    sectorName: sectorName(stock.sector),
    points,
    macro: macroEffects(macroSnapshot(macro), { sector: stock.sector, pe: m.pe ?? null, debtToEquity: m.debt_to_equity ?? null, marketCap: m.market_cap ?? null }),
    sector: rank ? { rank, of: ranked.length, return3m: ranked[rank - 1][1] } : null,
    valuation: med != null && now != null ? { metric: metric.label, now, median: med } : null,
    investors: holders.length ? {
      holders: holders.map((h) => h.investor.person),
      buyers: holders.filter((h) => h.change === "yeni" || h.change === "artirdi").map((h) => h.investor.person),
      sellers: holders.filter((h) => h.change === "azaltti").map((h) => h.investor.person),
      quarter: quarterLabel(holders[0].period),
    } : null,
    federal: federal || myThemes.length ? { amount12m: federal?.amount ?? 0, revenue, growth: federal ? growth(federal.amount_lagged, federal.amount_prev) : null, themes: myThemes } : null,
  });
  const bull = thesis.reasons.filter((r) => r.tone === "positive");
  const bear = thesis.reasons.filter((r) => r.tone === "negative");
  const watch = thesis.reasons.filter((r) => r.tone === "neutral");
  const total = thesis.plus + thesis.minus || 1;

  return (
    <section className="glass-card mt-4 p-5" aria-labelledby="thesis-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[70ch]">
          <h2 id="thesis-title" className="flex items-center gap-1 text-lg font-semibold">
            Kairos görünümü
            <InfoTip title="Görünüm nasıl oluşuyor?">
              Şirketin kendi verileri, kendi geçmişine göre değerlemesi, sektörünün son 3 aydaki gücü, makro ortam (faiz, enflasyon, petrol,
              dolar, istihdam) ve federal harcama temaları birlikte değerlendirilir. Her neden bir ağırlık taşır; görünüm olumlu ve olumsuz
              tarafların dengesidir. Veriler güncellendikçe kendiliğinden değişir. Yatırım tavsiyesi değildir.
            </InfoTip>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{thesis.summary}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${STANCE_STYLE[thesis.stance]}`}>{thesis.label}</span>
          <div className="mt-2 flex h-2 w-40 overflow-hidden rounded-full bg-surface-high" role="img" aria-label={`Olumlu ağırlık ${Math.round((thesis.plus / total) * 100)}%`}>
            <span className="h-full bg-gain" style={{ width: `${(thesis.plus / total) * 100}%` }} />
            <span className="h-full bg-loss" style={{ width: `${(thesis.minus / total) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-muted num">{bull.length} olumlu · {bear.length} olumsuz neden</p>
        </div>
      </div>
      {aiEnabled() ? (
        <Suspense fallback={<div className="mt-4 h-28 animate-pulse rounded-[var(--radius-control)] bg-primary-soft/30" aria-label="Yapay zekâ özeti yazılıyor" />}>
          <AiSummary input={{ ticker: stock.ticker, name: stock.name, sector: sectorName(stock.sector), price: stock.price, score: stock.score, stanceLabel: thesis.label, reasons: thesis.reasons }} />
        </Suspense>
      ) : null}
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <Side title="Olumlu senaryo (boğa)" icon={<CircleCheck size={16} className="text-gain" aria-hidden />} reasons={bull} empty="Belirgin bir olumlu etken bulunmadı." />
        <Side title="Olumsuz senaryo (ayı)" icon={<CircleMinus size={16} className="text-loss" aria-hidden />} reasons={bear} empty="Belirgin bir olumsuz etken bulunmadı." />
      </div>
      {watch.length ? (
        <div className="mt-5 border-t border-outline-soft/50 pt-4">
          <Side title="Takip edilecekler" icon={<Eye size={16} className="text-primary" aria-hidden />} reasons={watch} empty="" />
        </div>
      ) : null}
      <p className="mt-4 text-xs text-ink-muted">
        Makro verilerin tamamı için <Link href="/makro" className="text-primary hover:underline">Makro</Link>, temalar için{" "}
        <Link href="/harcamalar" className="text-primary hover:underline">Federal harcamalar</Link> sayfasına bak. Bu görünüm kurallarla
        üretilir; geleceği tahmin etmez ve al/sat önerisi değildir.
      </p>
    </section>
  );
}
