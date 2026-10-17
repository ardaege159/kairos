// Keyword topics for global headlines (RSS) and the sectors each topic tends to move.
// Order matters: the first matching topic becomes the headline's main topic; all matches add sectors.

export type Topic = { key: string; label: string; pattern: RegExp; sectors: string[] };

export const TOPICS: Topic[] = [
  { key: "energy", label: "Petrol ve enerji", pattern: /\b(oil|crude|brent|wti|opec|natural gas|lng|gasoline|refiner(y|ies))\b/i, sectors: ["Energy", "Industrials", "Materials"] },
  { key: "rates", label: "Faiz ve Fed", pattern: /\b(fed|federal reserve|fomc|powell|interest rates?|rate (cut|hike)s?|treasur(y|ies)|bond yields?|yields?)\b/i, sectors: ["Financials", "Real Estate", "Utilities"] },
  { key: "inflation", label: "Enflasyon", pattern: /\b(inflation|cpi|pce|consumer prices|price index)\b/i, sectors: ["Consumer Staples", "Consumer Discretionary", "Financials"] },
  { key: "jobs", label: "İstihdam", pattern: /\b(jobs report|payrolls?|unemployment|jobless|labor market|layoffs?)\b/i, sectors: ["Consumer Discretionary", "Industrials"] },
  { key: "trade", label: "Ticaret ve gümrük", pattern: /\b(tariffs?|trade war|trade deal|export controls?|sanctions?)\b/i, sectors: ["Industrials", "Materials", "Consumer Discretionary", "Information Technology"] },
  { key: "geopolitics", label: "Jeopolitik", pattern: /\b(war|missiles?|military|iran|israel|ukraine|russia|hormuz|taiwan|ceasefire|strikes? on)\b/i, sectors: ["Energy", "Industrials"] },
  { key: "chips", label: "Yarı iletken ve yapay zekâ", pattern: /\b(chips?|chipmakers?|semiconductors?|nvidia|tsmc|ai|artificial intelligence|data cent(er|re)s?)\b/i, sectors: ["Information Technology", "Communication Services"] },
  { key: "china", label: "Çin ekonomisi", pattern: /\b(china|chinese|beijing|yuan)\b/i, sectors: ["Materials", "Industrials", "Consumer Discretionary"] },
  { key: "fiscal", label: "ABD bütçesi", pattern: /\b(budget|deficit|debt ceiling|government shutdown|treasury secretary|spending bill|congress)\b/i, sectors: ["Industrials", "Health Care", "Financials"] },
  { key: "banks", label: "Bankalar", pattern: /\b(banks?|lenders?|jpmorgan|goldman|credit)\b/i, sectors: ["Financials"] },
  { key: "health", label: "Sağlık ve ilaç", pattern: /\b(fda|drug|pharma|vaccine|biotech|medicare|obesity)\b/i, sectors: ["Health Care"] },
  { key: "housing", label: "Konut", pattern: /\b(housing|home sales|mortgage|homebuilders?)\b/i, sectors: ["Real Estate", "Consumer Discretionary", "Financials"] },
  { key: "earnings", label: "Bilançolar", pattern: /\b(earnings|quarterly results|profit|revenue|guidance|beats?|misses?)\b/i, sectors: [] },
  { key: "markets", label: "Piyasalar", pattern: /\b(stocks?|s&p 500|nasdaq|dow|wall street|selloff|rally)\b/i, sectors: [] },
];

export const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));

export function classify(text: string): { topic: string | null; sectors: string[] } {
  const hits = TOPICS.filter((t) => t.pattern.test(text));
  return { topic: hits[0]?.key ?? null, sectors: [...new Set(hits.flatMap((t) => t.sectors))] };
}

// Company names that are also common words; never matched from headlines.
const AMBIGUOUS = new Set(["target", "visa", "ball", "block", "gap", "apple pay", "match", "general", "southern", "progressive", "public storage", "eaton", "aflac", "loews", "dover", "hubbell", "fox", "news"]);

/** Short, matchable name: "Apple Inc." -> "apple", "Alphabet Inc. (Class A)" -> "alphabet". */
export function shortName(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|plc|ltd|limited|holdings?|group|the|class [a-c])\b\.?/gi, "")
    .replace(/[.,&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Tickers whose company name (or "(TICKER)" mention) appears in a headline. Conservative on purpose. */
export function matchCompanies(text: string, companies: { ticker: string; name: string }[]): string[] {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  for (const c of companies) {
    if (new RegExp(`\\((?:nasdaq|nyse)?:?\\s?${c.ticker.replace(".", "\\.")}\\)`, "i").test(text)) out.add(c.ticker);
    const n = shortName(c.name);
    if (n.length < 4 || AMBIGUOUS.has(n)) continue;
    if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}('s)?\\b`).test(lower)) out.add(c.ticker);
  }
  return [...out];
}
