// Data-backed strengths, weaknesses and watch points for one stock. Rule-based: every item cites the
// numbers it comes from. Descriptive only; the UI states it is not a buy/sell recommendation.

export type Point = { key: string; title: string; detail: string; strength: number };
export type StockInput = {
  metrics: Record<string, number | undefined>;
  pct: Record<string, number | undefined>;          // within-sector percentile, 1 = best
  sectorMedian: Record<string, number | null | undefined>;
  score: number | null;
  price: number | null;
  daysToEarnings: number | null;
  federal12m: number | null;
  earnings?: { quarters: number; beats: number; misses: number; recentMisses: number; avgSurprise: number | null } | null;
  insiders?: { buyValue: number; sellValue: number; buyers: number; sellers: number; plannedSellShare: number | null } | null;
};

const pct = (v: number) => `%${(Math.abs(v) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
const signed = (v: number) => `${v < 0 ? "−" : "+"}${pct(v)}`;
const x = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const money = (v: number) => (v >= 1e9 ? `${x(v / 1e9)} milyar $` : `${x(v / 1e6)} milyon $`);

export function stockPoints(s: StockInput): { pros: Point[]; cons: Point[]; watch: Point[] } {
  const m = s.metrics, p = s.pct, med = s.sectorMedian;
  const pros: Point[] = [], cons: Point[] = [], watch: Point[] = [];
  const has = (k: string) => m[k] != null && Number.isFinite(m[k]!);

  // Valuation
  if (has("pe") && p.pe != null) {
    if (p.pe >= 0.75) pros.push({ key: "pe", title: "Sektörüne göre ucuz", strength: p.pe,
      detail: `F/K ${x(m.pe!)}${med.pe != null ? `, sektör medyanı ${x(med.pe)}` : ""}. Kârına göre sektördeki çoğu şirketten daha düşük fiyatlanıyor.` });
    else if (p.pe <= 0.25 || m.pe! > 60) cons.push({ key: "pe", title: "Pahalı fiyatlanıyor", strength: 1 - p.pe,
      detail: `F/K ${x(m.pe!)}${med.pe != null ? `, sektör medyanı ${x(med.pe)}` : ""}. Piyasa yüksek büyüme bekliyor; beklenti karşılanmazsa düşüş riski artar.` });
  }
  if (has("net_margin") && m.net_margin! < 0) cons.push({ key: "loss", title: "Zarar ediyor", strength: 0.9,
    detail: `Son 12 ayda net marj ${signed(m.net_margin!)}. Kâra geçemezse finansman ihtiyacı doğabilir.` });

  // Profitability
  if (has("net_margin") && m.net_margin! > 0 && (p.net_margin ?? 0) >= 0.75) pros.push({ key: "margin", title: "Yüksek kârlılık", strength: p.net_margin!,
    detail: `Net marj ${pct(m.net_margin!)}${med.net_margin != null ? ` (sektör medyanı ${pct(med.net_margin)})` : ""}: her 100 dolarlık satıştan sektörün çoğundan fazla kâr kalıyor.` });
  if (has("roe") && (p.roe ?? 0) >= 0.8 && m.roe! > 0.15) pros.push({ key: "roe", title: "Sermayeyi verimli kullanıyor", strength: p.roe!,
    detail: `Özsermaye kârlılığı ${pct(m.roe!)}.` });

  // Growth
  if (has("revenue_growth_yoy")) {
    if (m.revenue_growth_yoy! >= 0.15) pros.push({ key: "growth", title: "Gelirleri hızlı büyüyor", strength: Math.min(1, 0.6 + m.revenue_growth_yoy!),
      detail: `Son çeyrek geliri bir yıl öncesine göre ${signed(m.revenue_growth_yoy!)}.` });
    else if (m.revenue_growth_yoy! < 0) cons.push({ key: "growth", title: "Gelirleri küçülüyor", strength: Math.min(1, 0.6 - m.revenue_growth_yoy!),
      detail: `Son çeyrek geliri bir yıl öncesine göre ${signed(m.revenue_growth_yoy!)}.` });
  }
  if (has("net_income_growth_yoy") && m.net_income_growth_yoy! >= 0.25 && (m.revenue_growth_yoy ?? 0) >= 0) pros.push({ key: "eps_growth", title: "Kârı gelirden hızlı artıyor", strength: 0.7,
    detail: `Net kâr bir yıl öncesine göre ${signed(m.net_income_growth_yoy!)}.` });

  // Balance sheet
  if (has("net_cash") && m.net_cash! > 0) pros.push({ key: "cash", title: "Net nakit pozisyonunda", strength: 0.7,
    detail: `Kasadaki nakit uzun vadeli borcundan ${money(m.net_cash!)} fazla; zor dönemlere karşı tampon var.` });
  if (has("debt_to_equity")) {
    if (m.debt_to_equity! > 2 || (p.debt_to_equity ?? 1) <= 0.15) cons.push({ key: "debt", title: "Borç yükü yüksek", strength: Math.min(1, 0.5 + m.debt_to_equity! / 6),
      detail: `Borç/özsermaye ${x(m.debt_to_equity!)}${med.debt_to_equity != null ? `, sektör medyanı ${x(med.debt_to_equity)}` : ""}. Faizler yükselirse ya da satışlar düşerse baskı artar.` });
  }
  // Cash flow and dividends (last fiscal year)
  if (has("fcf")) {
    if (m.fcf! < 0) cons.push({ key: "fcf", title: "Nakit yakıyor", strength: 0.75,
      detail: `Son mali yılda serbest nakit akışı eksi ${money(-m.fcf!)}: yatırımlarını işinden gelen nakitle karşılayamıyor.` });
    else if (has("fcf_margin") && m.fcf_margin! >= 0.15) pros.push({ key: "fcf", title: "Güçlü nakit üretiyor", strength: Math.min(1, 0.6 + m.fcf_margin!),
      detail: `Son mali yılda serbest nakit akışı ${money(m.fcf!)}; satışlara oranı ${pct(m.fcf_margin!)}.` });
  }
  if (has("dividend_yield") && m.dividend_yield! >= 0.025) {
    if (has("payout_ratio") && m.payout_ratio! > 1) watch.push({ key: "dividend", title: "Temettü kârı aşıyor", strength: 0.7,
      detail: `Temettü verimi ${pct(m.dividend_yield!)}, ama son mali yılda dağıtım oranı ${pct(m.payout_ratio!)} oldu: kazandığından fazlasını dağıttı, bu tempo sürmeyebilir.` });
    else pros.push({ key: "dividend", title: "Düzenli temettü", strength: 0.55,
      detail: `Temettü verimi ${pct(m.dividend_yield!)}${has("payout_ratio") ? `; kârın dağıtılan kısmı ${pct(m.payout_ratio!)}` : ""}.` });
  }

  if (has("current_ratio") && m.current_ratio! < 1) cons.push({ key: "liquidity", title: "Kısa vadeli likidite dar", strength: 0.6,
    detail: `Cari oran ${x(m.current_ratio!)}: önümüzdeki 1 yılın borçları, 1 yılda nakde dönecek varlıklarından fazla.` });

  // Price action
  if (p.return_3m != null && has("return_3m")) {
    if (p.return_3m >= 0.8) pros.push({ key: "momentum", title: "Fiyatı sektöründen güçlü", strength: p.return_3m,
      detail: `Son 3 ayda ${signed(m.return_3m!)}; sektördeki şirketlerin çoğundan iyi.` });
    else if (p.return_3m <= 0.2) cons.push({ key: "momentum", title: "Fiyatı sektörünün gerisinde", strength: 1 - p.return_3m,
      detail: `Son 3 ayda ${signed(m.return_3m!)}; sektördeki şirketlerin çoğundan zayıf.` });
  }
  if (s.price != null && has("high_52w") && m.high_52w! > 0) {
    const off = s.price / m.high_52w! - 1;
    if (off <= -0.3) watch.push({ key: "drawdown", title: "Zirvesinin çok altında", strength: Math.min(1, -off),
      detail: `Son 1 yılın zirvesinden ${pct(off)} aşağıda. Ucuzlamış olabilir ama düşüşün nedeni araştırılmalı.` });
  }

  // News, events
  if (has("news_sentiment") && (m.news_count ?? 0) >= 3) {
    if (m.news_sentiment! >= 0.2) pros.push({ key: "news", title: "Haber akışı olumlu", strength: 0.55,
      detail: `Son 30 günde ${m.news_count} haberin ortalama tonu olumlu.` });
    else if (m.news_sentiment! <= -0.15) cons.push({ key: "news", title: "Haber akışı olumsuz", strength: 0.55,
      detail: `Son 30 günde ${m.news_count} haberin ortalama tonu olumsuz.` });
  }
  if (s.daysToEarnings != null && s.daysToEarnings <= 14) watch.push({ key: "earnings", title: "Bilanço yaklaşıyor", strength: 0.8,
    detail: `${s.daysToEarnings <= 0 ? "Bugün" : `${s.daysToEarnings} gün sonra`} çeyrek sonuçları açıklanacak; fiyat sert hareket edebilir.` });
  if (s.federal12m != null && s.federal12m >= 1e9) watch.push({ key: "federal", title: "Gelirin bir kısmı devletten", strength: 0.5,
    detail: `Son 12 ayda ${money(s.federal12m)} federal sözleşme aldı. İstikrar sağlar ama bütçe kesintilerine duyarlıdır.` });
  // Earnings vs analyst expectations
  const e = s.earnings;
  if (e && e.quarters >= 6 && e.beats >= e.quarters - 1) pros.push({ key: "beats", title: "Beklentileri düzenli aşıyor", strength: 0.65,
    detail: `Son ${e.quarters} çeyreğin ${e.beats} tanesinde hisse başı kâr analist beklentisinin üstünde geldi${e.avgSurprise != null ? ` (tipik sürpriz %${x(e.avgSurprise)})` : ""}.` });
  else if (e && e.recentMisses >= 2) cons.push({ key: "misses", title: "Beklentilerin altında kalıyor", strength: 0.6,
    detail: `Son 4 çeyreğin ${e.recentMisses} tanesinde hisse başı kâr analist beklentisinin altında kaldı.` });

  // Insiders (last 90 days, open market only)
  const ins = s.insiders;
  if (ins && ins.buyers >= 2 && ins.buyValue >= 250_000) pros.push({ key: "insiders", title: "Yöneticiler hisse alıyor", strength: Math.min(1, 0.6 + ins.buyers / 10),
    detail: `Son 90 günde ${ins.buyers} yönetici ya da büyük ortak piyasadan toplam ${money(ins.buyValue)} hisse aldı. Şirketi en iyi tanıyanların kendi parasıyla alım yapması güven işaretidir.` });
  else if (ins && ins.buyValue >= 1_000_000) pros.push({ key: "insiders", title: "Yönetici alımı", strength: 0.6,
    detail: `Son 90 günde piyasadan ${money(ins.buyValue)} tutarında içeriden alım yapıldı.` });
  if (ins && ins.sellers >= 3 && ins.buyValue === 0 && (ins.plannedSellShare ?? 1) < 0.5) watch.push({ key: "insider_sales", title: "Yöneticiler satıyor", strength: 0.55,
    detail: `Son 90 günde ${ins.sellers} yönetici piyasada toplam ${money(ins.sellValue)} hisse sattı ve bunların çoğu önceden planlanmış değildi. Satışların birçok sıradan nedeni olabilir; tek başına olumsuz değildir.` });

  if (!has("pe") && !has("net_margin")) watch.push({ key: "data", title: "Bilanço verisi eksik", strength: 0.4,
    detail: "SEC verilerinde temel kalemler bulunamadı; değerlendirme yalnızca fiyat hareketine dayanıyor." });

  const top = (xs: Point[]) => xs.sort((a, b) => b.strength - a.strength).slice(0, 5);
  return { pros: top(pros), cons: top(cons), watch: top(watch) };
}
