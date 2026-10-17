import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { SectorReturnsChart } from "@/components/sectors/sector-returns-chart";
import { getAllSectorStats, listSp500 } from "@/lib/data/stocks";
import { formatMetric, formatPercent } from "@/lib/format";
import { METRIC_BY_KEY } from "@/lib/metrics/definitions";
import { sectorName } from "@/lib/sectors";

export const metadata: Metadata = { title: "Sektörler" };

const COLUMNS = ["return_3m", "return_1y", "pe", "net_margin", "revenue_growth_yoy", "debt_to_equity"];

async function SectorOverview() {
  const [members, stats] = await Promise.all([listSp500(), getAllSectorStats()]);
  const sectors = Object.keys(stats).map((sector) => {
    const inSector = members.filter((s) => s.sector === sector);
    const scored = inSector.filter((s) => s.score != null);
    return {
      sector,
      n: inSector.length,
      avgScore: scored.length ? Math.round(scored.reduce((a, s) => a + s.score!, 0) / scored.length) : null,
      top: [...scored].sort((a, b) => b.score! - a.score!).slice(0, 3),
      stats: stats[sector],
    };
  });
  sectors.sort((a, b) => (b.stats.return_3m?.median ?? -Infinity) - (a.stats.return_3m?.median ?? -Infinity));

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card p-5" aria-labelledby="sector-returns">
        <h2 id="sector-returns" className="flex items-center gap-1 font-semibold">
          Son 3 ayda sektörler
          <InfoTip title="Sektör getirisi">
            Her sektördeki S&amp;P 500 hisselerinin son 3 aylık getirilerinin medyanı (ortadaki değer). Ortalama yerine medyan
            kullanılır ki tek bir aşırı yükselen hisse sektörü olduğundan iyi göstermesin. Kairos Skoru&apos;ndaki
            &quot;sektör yönü&quot; bu sıralamadan gelir.
          </InfoTip>
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">Hangi sektörlerin yükselişte, hangilerinin geride olduğunu gösterir.</p>
        <SectorReturnsChart
          rows={sectors.filter((s) => s.stats.return_3m?.median != null).map((s) => ({ sector: sectorName(s.sector), value: s.stats.return_3m!.median! }))}
        />
      </section>

      <section className="glass-card p-5" aria-labelledby="sector-table">
        <h2 id="sector-table" className="font-semibold">Sektörlerin medyan değerleri</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Her hücre sektördeki tipik şirketi gösterir. Sektör adına tıklayınca o sektörün hisselerini listelersin.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm num">
            <thead>
              <tr className="text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Sektör</th>
                {COLUMNS.map((k) => {
                  const d = METRIC_BY_KEY[k];
                  return (
                    <th key={k} scope="col" className="py-2 pr-4 text-right font-medium">
                      <span className="inline-flex items-center gap-0.5">
                        {d.short ?? d.label}
                        <InfoTip title={d.short ? `${d.short} (${d.label})` : d.label} formula={d.help} align="end">{d.meaning}</InfoTip>
                      </span>
                    </th>
                  );
                })}
                <th scope="col" className="py-2 pr-4 text-right font-medium">Ort. skor</th>
                <th scope="col" className="py-2 font-medium">En yüksek skorlular</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((s) => (
                <tr key={s.sector} className="border-t border-outline-soft/40">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                    <Link href={`/hisseler?sektor=${encodeURIComponent(s.sector)}`} className="font-medium hover:text-primary">
                      {sectorName(s.sector)}
                    </Link>
                    <span className="block text-xs text-ink-muted">{s.n} hisse</span>
                  </th>
                  {COLUMNS.map((k) => {
                    const v = s.stats[k]?.median ?? null;
                    const signed = k.startsWith("return");
                    return (
                      <td key={k} className={`py-2.5 pr-4 text-right ${signed && v != null ? (v >= 0 ? "text-gain" : "text-loss") : ""}`}>
                        {signed ? formatPercent(v, true) : formatMetric(v, METRIC_BY_KEY[k].format)}
                      </td>
                    );
                  })}
                  <td className="py-2.5 pr-4 text-right font-semibold">{s.avgScore ?? "—"}</td>
                  <td className="py-2.5">
                    <span className="flex flex-wrap gap-1.5">
                      {s.top.map((t) => (
                        <Link key={t.ticker} href={`/hisseler/${t.ticker}`} className="inline-flex items-center gap-1 rounded-full bg-primary-soft/60 px-2 py-0.5 text-xs font-medium text-primary-strong hover:bg-primary-soft">
                          <TickerLogo ticker={t.ticker} size={16} />
                          {t.ticker} {t.score}
                        </Link>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function SektorlerPage() {
  return (
    <>
      <PageHeader
        title="Sektörler"
        description="11 S&P 500 sektörünün son dönem performansı ve tipik değerleri. Bir hisseyi değerlendirirken önce sektörüne bakmak, rakamları doğru yorumlamayı sağlar."
      />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Sektörler yükleniyor" />}>
        <SectorOverview />
      </Suspense>
    </>
  );
}
