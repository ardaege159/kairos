// Display metadata for computed metrics. `better` drives sector percentiles and the score.

export type MetricFormat = "money" | "ratio" | "percent" | "multiple" | "price";
export type MetricGroup = "valuation" | "profitability" | "growth" | "health" | "price";

export type MetricDef = {
  key: string;
  label: string;
  short?: string;
  group: MetricGroup;
  format: MetricFormat;
  better: "higher" | "lower" | null;
  help: string;
};

export const METRICS: MetricDef[] = [
  { key: "market_cap", label: "Piyasa değeri", group: "valuation", format: "money", better: null, help: "Fiyat × dolaşımdaki hisse sayısı." },
  { key: "pe", label: "Fiyat/Kazanç", short: "F/K", group: "valuation", format: "multiple", better: "lower", help: "Piyasa değeri ÷ son 12 ay net kâr. Zarar edenlerde hesaplanmaz." },
  { key: "pb", label: "Piyasa değeri/Defter değeri", short: "PD/DD", group: "valuation", format: "multiple", better: "lower", help: "Piyasa değeri ÷ özsermaye." },
  { key: "ps", label: "Fiyat/Satış", short: "F/S", group: "valuation", format: "multiple", better: "lower", help: "Piyasa değeri ÷ son 12 ay gelir." },
  { key: "ev_sales", label: "Firma değeri/Satış", short: "FD/S", group: "valuation", format: "multiple", better: "lower", help: "(Piyasa değeri + uzun vadeli borç − nakit) ÷ son 12 ay gelir." },
  { key: "eps_ttm", label: "Hisse başı kâr (12 ay)", group: "valuation", format: "price", better: null, help: "Son 12 ay net kâr ÷ hisse sayısı." },

  { key: "gross_margin", label: "Brüt marj", group: "profitability", format: "percent", better: "higher", help: "Son 12 ay brüt kâr ÷ gelir." },
  { key: "operating_margin", label: "Faaliyet marjı", group: "profitability", format: "percent", better: "higher", help: "Son 12 ay faaliyet kârı ÷ gelir." },
  { key: "net_margin", label: "Net marj", group: "profitability", format: "percent", better: "higher", help: "Son 12 ay net kâr ÷ gelir." },
  { key: "roe", label: "Özsermaye kârlılığı", short: "ROE", group: "profitability", format: "percent", better: "higher", help: "Son 12 ay net kâr ÷ özsermaye." },
  { key: "roa", label: "Aktif kârlılığı", short: "ROA", group: "profitability", format: "percent", better: "higher", help: "Son 12 ay net kâr ÷ toplam varlıklar." },

  { key: "revenue_growth_yoy", label: "Gelir büyümesi (çeyrek, yıllık)", group: "growth", format: "percent", better: "higher", help: "Son çeyrek geliri ÷ bir yıl önceki aynı çeyrek − 1." },
  { key: "net_income_growth_yoy", label: "Net kâr büyümesi (çeyrek, yıllık)", group: "growth", format: "percent", better: "higher", help: "Son çeyrek net kârı ÷ bir yıl önceki aynı çeyrek − 1. Önceki çeyrek zarardaysa hesaplanmaz." },
  { key: "revenue_growth_ttm", label: "Gelir büyümesi (12 ay)", group: "growth", format: "percent", better: "higher", help: "Son 12 ay geliri ÷ önceki 12 ay − 1." },

  { key: "debt_to_equity", label: "Borç/Özsermaye", group: "health", format: "ratio", better: "lower", help: "Uzun vadeli borç ÷ özsermaye." },
  { key: "current_ratio", label: "Cari oran", group: "health", format: "ratio", better: "higher", help: "Dönen varlıklar ÷ kısa vadeli borçlar. 1'in altı kısa vadeli likidite baskısına işaret eder." },
  { key: "net_cash", label: "Net nakit", group: "health", format: "money", better: null, help: "Nakit − uzun vadeli borç. Negatifse net borç." },

  { key: "return_1m", label: "1 ay getiri", group: "price", format: "percent", better: "higher", help: "Son 21 işlem günü." },
  { key: "return_3m", label: "3 ay getiri", group: "price", format: "percent", better: "higher", help: "Son 63 işlem günü." },
  { key: "return_1y", label: "1 yıl getiri", group: "price", format: "percent", better: "higher", help: "Son 252 işlem günü." },
  { key: "high_52w", label: "52 hafta en yüksek", group: "price", format: "price", better: null, help: "Son 252 işlem günündeki en yüksek fiyat." },
  { key: "low_52w", label: "52 hafta en düşük", group: "price", format: "price", better: null, help: "Son 252 işlem günündeki en düşük fiyat." },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, MetricDef>;

export const GROUP_LABELS: Record<MetricGroup, string> = {
  valuation: "Değerleme",
  profitability: "Karlılık",
  growth: "Büyüme",
  health: "Finansal sağlık",
  price: "Fiyat performansı",
};
