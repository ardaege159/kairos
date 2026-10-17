// Kairos Skoru: weights and which metrics feed each part. Single source of truth (see CLAUDE.md).
// Each part is the average within-sector percentile (0..1) of its metrics; parts with no data are
// dropped and the remaining weights are renormalised. The score is descriptive, not a forecast.

export type ScorePartKey = "valuation" | "profitability" | "growth" | "health" | "momentum" | "sector" | "news";

export const SCORE_PARTS: Record<ScorePartKey, { label: string; weight: number; metrics: string[] }> = {
  valuation: { label: "Değerleme", weight: 25, metrics: ["pe", "pb", "ps", "ev_sales"] },
  profitability: { label: "Karlılık", weight: 20, metrics: ["gross_margin", "operating_margin", "net_margin", "roe"] },
  growth: { label: "Büyüme", weight: 20, metrics: ["revenue_growth_yoy", "net_income_growth_yoy", "revenue_growth_ttm"] },
  health: { label: "Finansal sağlık", weight: 15, metrics: ["debt_to_equity", "current_ratio"] },
  momentum: { label: "Momentum", weight: 10, metrics: ["return_3m", "return_1y"] },
  sector: { label: "Sektör yönü", weight: 10, metrics: [] }, // sector's 3-month median return ranked across sectors
  news: { label: "Haber", weight: 0, metrics: [] }, // Marketaux sentiment; enabled when the news pipeline lands
};
