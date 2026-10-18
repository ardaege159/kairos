import { InfoTip } from "@/components/info-tip";
import { ValuationHistory } from "@/components/stocks/valuation-history";
import { alpacaCloses } from "@/lib/data/alpaca";
import type { QuarterRow } from "@/lib/data/stocks";
import { valuationHistory } from "@/lib/metrics/history";

/** Server wrapper: ~3 years of closes (cached) + stored quarters -> multiples through time. */
export async function ValuationSection({ ticker, quarters, price, asOf }: { ticker: string; quarters: QuarterRow[]; price: number | null; asOf: string | null }) {
  const prices = await alpacaCloses(ticker, 1100);
  const f = new Map(quarters.map((q) => [q.period, q.values]));
  const ends = Object.fromEntries(quarters.map((q) => [q.period, q.period_end]));
  const points = valuationHistory(f, ends, prices, price != null && asOf ? { date: asOf, price } : undefined);
  return (
    <section className="glass-card mt-4 p-5" aria-labelledby="valhist-title">
      <h2 id="valhist-title" className="mb-3 flex items-center gap-1 font-semibold">
        Değerleme geçmişi
        <InfoTip title="Kendi geçmişine göre değerleme">
          Sektörle karşılaştırmanın yanında, bir hissenin bugün kendi geçmişine göre pahalı mı ucuz mu fiyatlandığına bakmak da faydalıdır.
          Kesikli çizgi, gösterilen dönemin medyanıdır.
        </InfoTip>
      </h2>
      <ValuationHistory points={points} />
    </section>
  );
}
