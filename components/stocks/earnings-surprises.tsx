import { InfoTip } from "@/components/info-tip";
import { formatDate } from "@/lib/format";
import { surprisePct, surpriseSummary, type EarningsRow } from "@/lib/metrics/earnings";

const eps = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`);

/** Reported vs expected EPS for the last eight quarters, as diverging bars of the surprise %. */
export function EarningsSurprises({ rows }: { rows: EarningsRow[] }) {
  const s = surpriseSummary(rows);
  if (!s.quarters) return null;
  const list = rows
    .filter((r) => r.reported_eps != null && r.estimated_eps != null)
    .sort((a, b) => a.fiscal_date_ending.localeCompare(b.fiscal_date_ending))
    .slice(-8);
  // Bars share one scale, capped so a single +80% quarter does not flatten the rest.
  const max = Math.min(50, Math.max(5, ...list.map((r) => Math.abs(surprisePct(r) ?? 0))));
  return (
    <section className="glass-card mt-4 p-5" aria-labelledby="surprise-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="surprise-title" className="flex items-center gap-1 font-semibold">
          Bilanço sürprizleri
          <InfoTip title="Bilanço sürprizi">
            Şirketin açıkladığı hisse başı kârın, açıklamadan önce analistlerin ortalama beklentisine göre farkı. İkisi de analistlerin kullandığı
            &quot;düzeltilmiş&quot; kâr üzerindendir (tek seferlik kalemler hariç), bu yüzden SEC&apos;teki GAAP rakamından farklı olabilir. Kaynak: Alpha Vantage.
          </InfoTip>
        </h2>
        <p className="text-sm">
          Son {s.quarters} çeyreğin <b className="text-gain">{s.beats}</b> tanesinde beklentiyi aştı
          {s.misses ? <>, <b className="text-loss">{s.misses}</b> tanesinde altında kaldı</> : null}
          {s.avgSurprise != null ? <span className="text-ink-muted"> · tipik sürpriz %{s.avgSurprise.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span> : null}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="list">
        {list.map((r) => {
          const pct = surprisePct(r);
          const beat = r.reported_eps! >= r.estimated_eps!;
          const p = pct ?? (beat ? 0.0001 : -0.0001);
          const h = pct == null ? 4 : Math.max(4, (Math.min(Math.abs(p), max) / max) * 48);
          return (
            <div key={r.fiscal_date_ending} role="listitem" className="flex flex-col items-center text-center"
              title={`Gerçekleşen ${eps(r.reported_eps)}, beklenti ${eps(r.estimated_eps)}`}>
              <div className="flex h-24 w-full flex-col justify-center">
                <div className="flex h-12 items-end justify-center">{p >= 0 ? <span className="w-6 rounded-t-sm bg-gain" style={{ height: h }} /> : null}</div>
                <div className="h-px w-full bg-outline-soft" />
                <div className="flex h-12 items-start justify-center">{p < 0 ? <span className="w-6 rounded-b-sm bg-loss" style={{ height: h }} /> : null}</div>
              </div>
              <span className={`text-xs font-semibold num ${beat ? "text-gain" : "text-loss"}`}>
                {pct == null ? (beat ? "Aştı" : "Altında") : `${p >= 0 ? "+" : "−"}%${Math.abs(p).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`}
              </span>
              <span className="text-[11px] text-ink-muted num">{eps(r.reported_eps)} / {eps(r.estimated_eps)}</span>
              <span className="text-[11px] text-ink-muted">{r.reported_date ? formatDate(r.reported_date) : r.fiscal_date_ending}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Her sütun: gerçekleşen / beklenen hisse başı kâr ve açıklama tarihi.</p>
    </section>
  );
}
