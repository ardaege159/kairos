// Stock screener: filter definitions, URL parsing and ready-made scans. Pure (tested); the query
// itself lives in lib/data/stocks.ts (screenStocks).
import { METRIC_BY_KEY } from "./metrics/definitions.ts";

export type FilterUnit = "multiple" | "percent" | "billions" | "points";
export type FilterDef = { key: string; label: string; unit: FilterUnit; group: string };

// Keys are metric keys from definitions.ts, plus "score" (Kairos Skoru, a plain column).
export const FILTERS: FilterDef[] = [
  { key: "score", label: "Kairos Skoru", unit: "points", group: "Özet" },
  { key: "market_cap", label: "Piyasa değeri", unit: "billions", group: "Özet" },
  { key: "dollar_volume", label: "Günlük işlem hacmi", unit: "billions", group: "Özet" },
  { key: "pe", label: "F/K", unit: "multiple", group: "Değerleme" },
  { key: "pb", label: "PD/DD", unit: "multiple", group: "Değerleme" },
  { key: "ps", label: "F/S", unit: "multiple", group: "Değerleme" },
  { key: "ev_ebitda", label: "FD/FAVÖK", unit: "multiple", group: "Değerleme" },
  { key: "fcf_yield", label: "Serbest nakit akışı verimi", unit: "percent", group: "Değerleme" },
  { key: "dividend_yield", label: "Temettü verimi", unit: "percent", group: "Değerleme" },
  { key: "gross_margin", label: "Brüt marj", unit: "percent", group: "Karlılık" },
  { key: "net_margin", label: "Net marj", unit: "percent", group: "Karlılık" },
  { key: "roe", label: "Özsermaye kârlılığı (ROE)", unit: "percent", group: "Karlılık" },
  { key: "fcf_margin", label: "Serbest nakit akışı marjı", unit: "percent", group: "Karlılık" },
  { key: "revenue_growth_yoy", label: "Gelir büyümesi (çeyrek)", unit: "percent", group: "Büyüme" },
  { key: "revenue_growth_ttm", label: "Gelir büyümesi (12 ay)", unit: "percent", group: "Büyüme" },
  { key: "net_income_growth_yoy", label: "Net kâr büyümesi (çeyrek)", unit: "percent", group: "Büyüme" },
  { key: "debt_to_equity", label: "Borç/Özsermaye", unit: "multiple", group: "Finansal sağlık" },
  { key: "current_ratio", label: "Cari oran", unit: "multiple", group: "Finansal sağlık" },
  { key: "payout_ratio", label: "Temettü dağıtım oranı", unit: "percent", group: "Finansal sağlık" },
  { key: "return_1m", label: "1 ay getiri", unit: "percent", group: "Fiyat" },
  { key: "return_3m", label: "3 ay getiri", unit: "percent", group: "Fiyat" },
  { key: "return_1y", label: "1 yıl getiri", unit: "percent", group: "Fiyat" },
];
export const FILTER_BY_KEY = Object.fromEntries(FILTERS.map((f) => [f.key, f])) as Record<string, FilterDef>;
export const UNIT_SUFFIX: Record<FilterUnit, string> = { multiple: "×", percent: "%", billions: "milyar $", points: "puan" };

/** Database path: score is a column, everything else lives in the metrics jsonb. */
export const filterPath = (key: string) => (key === "score" ? "score" : `metrics->${key}`);

export type Range = { key: string; min: number | null; max: number | null };

// What the user types (15 for %15, 2 for 2 milyar $) -> stored value, and back.
const SCALE: Record<FilterUnit, number> = { multiple: 1, percent: 0.01, billions: 1e9, points: 1 };
export const toStored = (unit: FilterUnit, v: number) => v * SCALE[unit];
export const toInput = (unit: FilterUnit, v: number) => Math.round((v / SCALE[unit]) * 1e6) / 1e6;

const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** URL params like pe_max=15&roe_min=20 -> stored-unit ranges (only known keys, at least one bound). */
export function parseRanges(params: Record<string, string | undefined>): Range[] {
  const out: Range[] = [];
  for (const f of FILTERS) {
    const min = num(params[`${f.key}_min`]), max = num(params[`${f.key}_max`]);
    if (min == null && max == null) continue;
    out.push({ key: f.key, min: min == null ? null : toStored(f.unit, min), max: max == null ? null : toStored(f.unit, max) });
  }
  return out;
}

export type Preset = { key: string; name: string; summary: string; params: Record<string, string> };

export const PRESETS: Preset[] = [
  { key: "deger", name: "Ucuz ve kârlı", summary: "F/K 15'in altında, ROE %15'in üstünde, borcu makul.",
    params: { pe_max: "15", roe_min: "15", debt_to_equity_max: "1" } },
  { key: "buyume", name: "Hızlı büyüyenler", summary: "Geliri bir yılda %20'den fazla artan, kâr eden şirketler.",
    params: { revenue_growth_ttm_min: "20", net_margin_min: "0" } },
  { key: "temettu", name: "Temettü", summary: "Temettü verimi %3'ün üstünde ve kârının %80'inden azını dağıtan şirketler.",
    params: { dividend_yield_min: "3", payout_ratio_max: "80" } },
  { key: "nakit", name: "Nakit makinesi", summary: "Serbest nakit akışı verimi %6'nın, nakit marjı %15'in üstünde.",
    params: { fcf_yield_min: "6", fcf_margin_min: "15" } },
  { key: "kalite", name: "Kaliteli bilanço", summary: "ROE %20'nin üstünde, borç/özsermaye 0,5'in altında, cari oran 1,5'in üstünde.",
    params: { roe_min: "20", debt_to_equity_max: "0.5", current_ratio_min: "1.5" } },
  { key: "momentum", name: "Güçlü momentum", summary: "Son 1 yılda %30, son 3 ayda %10'dan fazla yükselen ve en az 1 milyar $ değerli hisseler.",
    params: { return_1y_min: "30", return_3m_min: "10", market_cap_min: "1" } },
];

/** Metric format for a filter key (for result columns). */
export const filterFormat = (key: string) => (key === "score" ? "score" : METRIC_BY_KEY[key]?.format ?? "ratio");
