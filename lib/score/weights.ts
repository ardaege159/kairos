// Kairos Skoru: weights and which metrics feed each part. Single source of truth (see CLAUDE.md).
// Each part is the average within-sector percentile (0..1) of its metrics; parts with no data are
// dropped and the remaining weights are renormalised. The score is descriptive, not a forecast.

export type ScorePartKey = "valuation" | "profitability" | "growth" | "health" | "momentum" | "sector" | "news";

export const SCORE_PARTS: Record<ScorePartKey, { label: string; weight: number; metrics: string[]; meaning: string }> = {
  valuation: { label: "Değerleme", weight: 25, metrics: ["pe", "pb", "ps", "ev_sales"], meaning: "F/K, PD/DD, F/S ve FD/S'ye göre hisse sektöründekilere kıyasla ne kadar ucuz. Yüksek puan = daha ucuz." },
  profitability: { label: "Karlılık", weight: 20, metrics: ["gross_margin", "operating_margin", "net_margin", "roe"], meaning: "Marjlar ve özsermaye kârlılığı sektöre göre ne kadar yüksek." },
  growth: { label: "Büyüme", weight: 20, metrics: ["revenue_growth_yoy", "net_income_growth_yoy", "revenue_growth_ttm"], meaning: "Gelir ve kâr bir yıl öncesine göre sektördekilerden daha hızlı mı büyüyor." },
  health: { label: "Finansal sağlık", weight: 15, metrics: ["debt_to_equity", "current_ratio"], meaning: "Borç yükü düşük ve kısa vadeli ödeme gücü yüksek mi. Yüksek puan = daha sağlam bilanço." },
  momentum: { label: "Momentum", weight: 10, metrics: ["return_3m", "return_1y"], meaning: "Hisse son 3 ay ve 1 yılda sektöründekilerden daha iyi mi performans gösterdi." },
  sector: { label: "Sektör yönü", weight: 10, metrics: [], meaning: "Hissenin sektörü son 3 ayda diğer sektörlere göre ne kadar iyi gitti. Aynı sektördeki tüm hisseler aynı puanı alır." }, // sector's 3-month median return ranked across sectors
  news: { label: "Haber", weight: 0, metrics: [], meaning: "Hisse hakkındaki haberlerin genel tonu. Haber verisi bağlanınca devreye girecek." }, // Marketaux sentiment; enabled when the news pipeline lands
};
