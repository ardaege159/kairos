import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { ComparePicker } from "@/components/compare/compare-picker";
import { MAX_COMPARE } from "@/lib/compare";
import { PerformanceChart } from "@/components/compare/performance-chart";
import { ScorePartsChart } from "@/components/compare/score-parts-chart";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { SERIES } from "@/components/stocks/chart-theme";
import { TickerLogo } from "@/components/ticker-logo";
import { getAllSectorStats, getPrices, getStocks, type StockRow } from "@/lib/data/stocks";
import { formatMetric, formatPercent, formatPrice } from "@/lib/format";
import { GROUP_LABELS, GROUP_MEANINGS, METRICS, type MetricGroup } from "@/lib/metrics/definitions";
import { SCORE_PARTS, type ScorePartKey } from "@/lib/score/weights";
import { SECTOR_ETF, sectorName } from "@/lib/sectors";

export const metadata: Metadata = { title: "Karşılaştır" };

const GROUPS: MetricGroup[] = ["valuation", "profitability", "growth", "health", "price"];
const SUGGESTIONS = [["AAPL", "MSFT"], ["NVDA", "AMD", "AVGO"], ["KTOS", "RKLB", "LMT"], ["JPM", "BAC", "GS"]];

/** Index of the best value among the compared stocks, or -1 when not comparable. */
function bestIndex(values: (number | undefined)[], better: "higher" | "lower" | null) {
  if (!better) return -1;
  const present = values.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] != null);
  if (present.length < 2) return -1;
  return present.reduce((best, cur) => ((better === "higher" ? cur[0] > best[0] : cur[0] < best[0]) ? cur : best))[1];
}

function StockCard({ s, color }: { s: StockRow; color: string }) {
  const up = (s.change_1d ?? 0) >= 0;
  return (
    <Link href={`/hisseler/${s.ticker}`} className="glass-card block p-5 hover:shadow-[0_10px_30px_rgb(99_102_241/0.16)]">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
        <TickerLogo ticker={s.ticker} size={28} etf={s.asset_type === "etf"} />
        <span className="font-semibold">{s.ticker}</span>
        <span className="truncate text-sm text-ink-muted">{s.name}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight num">{formatPrice(s.price)}</p>
      {s.change_1d != null ? (
        <p className={`inline-flex items-center gap-1 text-sm num ${up ? "text-gain" : "text-loss"}`}>
          {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
          {formatPercent(Math.abs(s.change_1d))} günlük
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm num">
        <dt className="text-ink-muted">Sektör</dt>
        <dd className="truncate text-right">{sectorName(s.sector)}</dd>
        <dt className="text-ink-muted">Piyasa değeri</dt>
        <dd className="text-right">{formatMetric(s.metrics.market_cap, "money")}</dd>
        <dt className="text-ink-muted">Kairos Skoru</dt>
        <dd className="text-right font-semibold">{s.score ?? "—"}</dd>
      </dl>
    </Link>
  );
}

async function Comparison({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const requested = typeof sp.h === "string" ? sp.h.split(",").map((t) => t.trim().toUpperCase()) : [];
  const stocks = await getStocks([...new Set(requested)].slice(0, MAX_COMPARE));
  const tickers = stocks.map((s) => s.ticker);
  // Compare against the sector: sector medians in the table, the sector's SPDR ETF on the chart.
  const withSector = sp.sektor !== "0";
  const sectors = withSector ? [...new Set(stocks.filter((s) => s.asset_type === "stock" && s.sector).map((s) => s.sector!))] : [];
  const [prices, sectorPrices, allStats] = await Promise.all([
    Promise.all(stocks.map((s) => getPrices(s.ticker, s.core))),
    Promise.all(sectors.map((sec) => (SECTOR_ETF[sec] ? getPrices(SECTOR_ETF[sec], false) : Promise.resolve([])))),
    sectors.length ? getAllSectorStats() : Promise.resolve({} as Awaited<ReturnType<typeof getAllSectorStats>>),
  ]);
  const toggleHref = `/karsilastir?h=${tickers.join(",")}${withSector ? "&sektor=0" : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <ComparePicker selected={tickers} />

      {stocks.length === 0 ? (
        <section className="glass-card max-w-[65ch] p-6">
          <h2 className="font-semibold">Karşılaştırmak için hisse ekle</h2>
          <p className="mt-2 text-sm text-ink-muted">Yukarıdan hisse kodu yaz ya da bir öneriyle başla:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((g) => (
              <li key={g.join()}>
                <Link href={`/karsilastir?h=${g.join(",")}`} className="inline-block rounded-full bg-primary-soft/60 px-3 py-1 text-sm font-medium text-primary-strong hover:bg-primary-soft">
                  {g.join(" · ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stocks.map((s, i) => (
              <StockCard key={s.ticker} s={s} color={SERIES[i]} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={toggleHref} aria-pressed={withSector}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${withSector ? "bg-primary text-white" : "bg-white/70 text-ink-muted hover:text-ink"}`}>
              <span className={`h-3 w-3 rounded-full border-2 ${withSector ? "border-white bg-white/40" : "border-outline"}`} aria-hidden />
              Sektörüyle karşılaştır
            </Link>
            <InfoTip title="Sektörle karşılaştırma">
              Açıkken grafiğe her hissenin sektörünü temsil eden SPDR sektör ETF&apos;i (ör. teknoloji için XLK) kesikli çizgiyle, tabloya da
              sektördeki S&amp;P 500 şirketlerinin medyan değerleri eklenir. Böylece hissenin sektörünün önünde mi gerisinde mi olduğunu görürsün.
            </InfoTip>
          </div>

          {stocks.length > 1 || sectors.length ? (
            <section className="glass-card p-5" aria-labelledby="perf-title">
              <h2 id="perf-title" className="flex items-center gap-1 font-semibold">
                Son 1 yıl getiri
                <InfoTip title="Getiri karşılaştırması">
                  Her hisse, grafiğin başındaki fiyatı 0% kabul edilerek çizilir. Böylece fiyatları çok farklı hisseler aynı
                  eksende karşılaştırılabilir: +%20, o günden bu yana %20 kazandırdı demektir (temettü hariç). Kesikli çizgiler
                  sektör ETF&apos;leridir.
                </InfoTip>
              </h2>
              <p className="mt-1 mb-4 text-sm text-ink-muted">Başlangıç noktası %0 olacak şekilde.</p>
              <PerformanceChart
                series={[
                  ...stocks.map((s, i) => ({ ticker: s.ticker, points: prices[i], color: SERIES[i] })),
                  ...sectors
                    .map((sec, i) => ({ ticker: SECTOR_ETF[sec] ?? sec, points: sectorPrices[i], color: "#767586", dashed: true,
                      label: `${SECTOR_ETF[sec]} · ${sectorName(sec)} sektörü` }))
                    .filter((s) => s.points.length),
                ]}
              />
            </section>
          ) : null}

          {stocks.some((s) => s.score != null) ? (
            <section className="glass-card p-5" aria-labelledby="parts-title">
              <h2 id="parts-title" className="flex items-center gap-1 font-semibold">
                Kairos Skoru bölümleri
                <InfoTip title="Skor bölümleri">
                  Her bölüm hissenin kendi sektöründeki sırasıdır (0–100). Farklı sektörlerdeki hisselerde bu, “sektörüne göre ne
                  kadar iyi” sorusunun cevabıdır; hisseleri birbirine doğrudan değil, kendi sektörlerine göre karşılaştırır.
                </InfoTip>
              </h2>
              <p className="mt-1 mb-4 text-sm text-ink-muted">Yüksek çubuk, hissenin o konuda sektöründe daha iyi olduğunu gösterir. ETF&apos;lerin skoru yoktur.</p>
              <ScorePartsChart
                series={stocks.map((s, i) => ({ ticker: s.ticker, color: SERIES[i], scored: s.score != null })).filter((s) => s.scored)}
                rows={(Object.keys(SCORE_PARTS) as ScorePartKey[]).filter((k) => SCORE_PARTS[k].weight > 0).map((k) => ({
                  part: SCORE_PARTS[k].label,
                  ...Object.fromEntries(stocks.filter((s) => s.score != null).map((s) => [s.ticker, s.score_parts[k] ?? null])),
                }))}
              />
            </section>
          ) : null}

          <section className="glass-card p-5" aria-labelledby="metrics-title">
            <h2 id="metrics-title" className="font-semibold">Göstergeler</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Her satırda hisseler arasındaki en iyi değer kalın ve işaretli. Gri sütunlar sektördeki S&amp;P 500 şirketlerinin medyanıdır
              (en iyi seçimine katılmaz). Farklı sektörlerdeki hisseleri karşılaştırırken dikkatli ol: bir bankanın ve bir yazılım
              şirketinin normal F/K&apos;sı çok farklıdır.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm num">
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col" className="py-2 pr-4 text-left font-medium">Gösterge</th>
                    {stocks.map((s, i) => (
                      <th key={s.ticker} scope="col" className="py-2 pr-4 text-right font-semibold text-ink">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
                          {s.ticker}
                        </span>
                      </th>
                    ))}
                    {sectors.map((sec) => (
                      <th key={sec} scope="col" className="bg-surface-container/50 py-2 pr-4 pl-3 text-right text-xs font-medium">
                        Sektör medyanı
                        <span className="block font-normal">{sectorName(sec)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="rowgroup" colSpan={stocks.length + sectors.length + 1} className="pt-4 pb-1 text-left text-xs font-semibold text-primary-strong">
                      Kairos Skoru
                    </th>
                  </tr>
                  {(["total", ...(Object.keys(SCORE_PARTS) as ScorePartKey[]).filter((k) => SCORE_PARTS[k].weight > 0)] as const).map((k) => {
                    const values = stocks.map((s) => (k === "total" ? s.score ?? undefined : s.score_parts[k]));
                    const best = bestIndex(values, "higher");
                    const label = k === "total" ? "Toplam skor" : SCORE_PARTS[k].label;
                    return (
                      <tr key={k} className="border-t border-outline-soft/40">
                        <th scope="row" className="py-2 pr-4 text-left font-normal">
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {k !== "total" ? <InfoTip title={label}>{SCORE_PARTS[k].meaning}</InfoTip> : null}
                          </span>
                        </th>
                        {values.map((v, i) => (
                          <td key={stocks[i].ticker} className={`py-2 pr-4 text-right ${i === best ? "font-semibold" : ""}`}>
                            {i === best ? <Check size={12} className="mr-1 inline text-primary" aria-label="en iyi" /> : null}
                            {v ?? "—"}
                          </td>
                        ))}
                        {sectors.map((sec) => (
                          <td key={sec} className="bg-surface-container/50 py-2 pr-4 text-right text-ink-muted" title="Sektörün ortası tanım gereği 50'dir">
                            50
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                {GROUPS.map((g) => (
                  <tbody key={g}>
                    <tr>
                      <th scope="rowgroup" colSpan={stocks.length + sectors.length + 1} className="pt-4 pb-1 text-left text-xs font-semibold text-primary-strong">
                        <span className="inline-flex items-center gap-1">
                          {GROUP_LABELS[g]}
                          <InfoTip title={GROUP_LABELS[g]}>{GROUP_MEANINGS[g]}</InfoTip>
                        </span>
                      </th>
                    </tr>
                    {METRICS.filter((d) => d.group === g).map((d) => {
                      const values = stocks.map((s) => s.metrics[d.key]);
                      const best = bestIndex(values, d.better);
                      return (
                        <tr key={d.key} className="border-t border-outline-soft/40">
                          <th scope="row" className="py-2 pr-4 text-left font-normal">
                            <span className="inline-flex items-center gap-1">
                              {d.short ?? d.label}
                              <InfoTip title={d.short ? `${d.short} (${d.label})` : d.label} formula={d.help}>{d.meaning}</InfoTip>
                            </span>
                          </th>
                          {values.map((v, i) => (
                            <td key={stocks[i].ticker} className={`py-2 pr-4 text-right ${i === best ? "font-semibold" : ""}`}>
                              {i === best ? <Check size={12} className="mr-1 inline text-primary" aria-label="en iyi" /> : null}
                              {formatMetric(v, d.format)}
                            </td>
                          ))}
                          {sectors.map((sec) => (
                            <td key={sec} className="bg-surface-container/50 py-2 pr-4 text-right text-ink-muted">
                              {formatMetric(allStats[sec]?.[d.key]?.median, d.format)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function KarsilastirPage({ searchParams }: PageProps<"/karsilastir">) {
  return (
    <>
      <PageHeader
        title="Karşılaştır"
        description="En fazla 4 hisseyi çarpanlar, karlılık, büyüme, borç ve fiyat performansına göre yan yana gör."
      />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Karşılaştırma yükleniyor" />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </>
  );
}
