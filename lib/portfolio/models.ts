// Model portfolios: transparent screens over S&P 500 data. Educational examples, rebuilt from the
// latest data every time; never a recommendation.

export type Candidate = {
  ticker: string; name: string; sector: string | null; price: number | null; score: number | null;
  metrics: Record<string, number | undefined>; pct: Record<string, number | undefined>;
};
export type Model = { key: string; name: string; summary: string; rules: string[]; picks: Candidate[] };

const ok = (c: Candidate) => c.price != null && c.price > 0 && c.sector != null;
const byDesc = (f: (c: Candidate) => number | undefined | null) => (a: Candidate, b: Candidate) => (f(b) ?? -Infinity) - (f(a) ?? -Infinity);

/** Take the first `n` candidates while allowing at most `perSector` from any one sector. */
function capSectors(sorted: Candidate[], n: number, perSector: number): Candidate[] {
  const out: Candidate[] = [];
  const count: Record<string, number> = {};
  for (const c of sorted) {
    if (out.length >= n) break;
    const s = c.sector ?? "?";
    if ((count[s] ?? 0) >= perSector) continue;
    count[s] = (count[s] ?? 0) + 1;
    out.push(c);
  }
  return out;
}

export function buildModels(all: Candidate[], sectorMedianPe: Record<string, number | null>): Model[] {
  const pool = all.filter(ok);
  const leaders = Object.values(
    pool.filter((c) => c.score != null).reduce<Record<string, Candidate>>((m, c) => {
      if (!m[c.sector!] || c.score! > m[c.sector!].score!) m[c.sector!] = c;
      return m;
    }, {}),
  ).sort(byDesc((c) => c.score));

  const quality = capSectors(
    pool.filter((c) => (c.metrics.revenue_growth_yoy ?? -1) >= 0.1 && (c.metrics.net_margin ?? -1) >= 0.1 && (c.metrics.debt_to_equity ?? 0) <= 1).sort(byDesc((c) => c.score)),
    10, 3,
  );
  const value = capSectors(
    pool.filter((c) => {
      const pe = c.metrics.pe, med = sectorMedianPe[c.sector!];
      return pe != null && pe > 0 && med != null && pe < med && (c.metrics.revenue_growth_yoy ?? -1) >= 0 && (c.metrics.net_margin ?? -1) > 0;
    }).sort(byDesc((c) => c.pct.pe)),
    10, 3,
  );
  const defensive = ["Consumer Staples", "Utilities", "Health Care"].flatMap((s) =>
    pool.filter((c) => c.sector === s && (c.metrics.net_margin ?? -1) > 0 && c.score != null).sort(byDesc((c) => c.score)).slice(0, 4),
  );
  const momentum = capSectors(pool.filter((c) => (c.score ?? 0) >= 55 && c.metrics.return_3m != null).sort(byDesc((c) => c.metrics.return_3m)), 10, 3);

  return [
    { key: "liderler", name: "Sektör liderleri", summary: "Her sektörden Kairos Skoru en yüksek tek şirket; sektörlere eşit yayılmış dengeli bir sepet.",
      rules: ["11 sektörün her birinden skoru en yüksek S&P 500 şirketi", "Eşit ağırlık"], picks: leaders },
    { key: "kalite", name: "Kaliteli büyüme", summary: "Hem hızlı büyüyen hem kârlı, borcu sınırlı şirketler.",
      rules: ["Son çeyrek gelir büyümesi en az %10", "Net marj en az %10", "Borç/özsermaye en fazla 1", "Skoru en yüksek 10, bir sektörden en fazla 3"], picks: quality },
    { key: "deger", name: "Değer", summary: "Sektörüne göre ucuz fiyatlanan, kârlı ve küçülmeyen şirketler.",
      rules: ["F/K sektör medyanının altında", "Kârlı ve geliri küçülmüyor", "Sektöre göre en ucuz 10, bir sektörden en fazla 3"], picks: value },
    { key: "defansif", name: "Defansif", summary: "Ekonomik dalgalanmalardan görece az etkilenen sektörler: temel tüketim, kamu hizmetleri, sağlık.",
      rules: ["Temel tüketim, kamu hizmetleri ve sağlıktan skoru en yüksek 4'er kârlı şirket"], picks: defensive },
    { key: "momentum", name: "Momentum", summary: "Son 3 ayda en güçlü yükselen, temelleri de ortalamanın üstündeki şirketler. Oynaklığı yüksek olabilir.",
      rules: ["Kairos Skoru en az 55", "Son 3 ay getirisi en yüksek 10, bir sektörden en fazla 3"], picks: momentum },
  ];
}
