import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { ComparePicker } from "@/components/compare/compare-picker";
import { MAX_COMPARE } from "@/lib/compare";
import { PerformanceChart } from "@/components/compare/performance-chart";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { SERIES } from "@/components/stocks/chart-theme";
import { getPrices, listStocks, type StockRow } from "@/lib/data/stocks";
import { formatMetric, formatPercent, formatPrice } from "@/lib/format";
import { GROUP_LABELS, GROUP_MEANINGS, METRICS, type MetricGroup } from "@/lib/metrics/definitions";
import { SCORE_PARTS, type ScorePartKey } from "@/lib/score/weights";
import { sectorName } from "@/lib/sectors";

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
  const all = await listStocks();
  const byTicker = new Map(all.map((s) => [s.ticker, s]));
  const requested = typeof sp.h === "string" ? sp.h.split(",").map((t) => t.trim().toUpperCase()) : [];
  const tickers = [...new Set(requested)].filter((t) => byTicker.has(t)).slice(0, MAX_COMPARE);
  const stocks = tickers.map((t) => byTicker.get(t)!);
  const prices = await Promise.all(stocks.map((s) => getPrices(s.ticker)));
  const options = all.map((s) => ({ ticker: s.ticker, name: s.name }));

  return (
    <div className="flex flex-col gap-6">
      <ComparePicker selected={tickers} options={options} />

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

          {stocks.length > 1 ? (
            <section className="glass-card p-5" aria-labelledby="perf-title">
              <h2 id="perf-title" className="flex items-center gap-1 font-semibold">
                Son 1 yıl getiri
                <InfoTip title="Getiri karşılaştırması">
                  Her hisse, grafiğin başındaki fiyatı 0% kabul edilerek çizilir. Böylece fiyatları çok farklı hisseler aynı
                  eksende karşılaştırılabilir: +%20, o günden bu yana %20 kazandırdı demektir (temettü hariç).
                </InfoTip>
              </h2>
              <p className="mt-1 mb-4 text-sm text-ink-muted">Başlangıç noktası %0 olacak şekilde.</p>
              <PerformanceChart series={stocks.map((s, i) => ({ ticker: s.ticker, points: prices[i] }))} />
            </section>
          ) : null}

          <section className="glass-card p-5" aria-labelledby="metrics-title">
            <h2 id="metrics-title" className="font-semibold">Göstergeler</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Her satırda en iyi değer kalın ve işaretli. Farklı sektörlerdeki hisseleri karşılaştırırken dikkatli ol: bir
              bankanın ve bir yazılım şirketinin normal F/K&apos;sı çok farklıdır.
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
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="rowgroup" colSpan={stocks.length + 1} className="pt-4 pb-1 text-left text-xs font-semibold text-primary-strong">
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
                      </tr>
                    );
                  })}
                </tbody>
                {GROUPS.map((g) => (
                  <tbody key={g}>
                    <tr>
                      <th scope="rowgroup" colSpan={stocks.length + 1} className="pt-4 pb-1 text-left text-xs font-semibold text-primary-strong">
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
