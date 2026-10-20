// SEC 13F information table -> positions, and quarter-over-quarter changes. Pure (tested).

export type Position = { cusip: string; issuer: string; title: string; putCall: string; value: number; shares: number };

const blocks = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "g"))].map((m) => m[1]);
const text = (xml: string, tag: string) => new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml)?.[1].trim() ?? "";
const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"');

/**
 * One row per security and option type, summed across the filer's sub-managers (13F repeats a
 * security once per manager group). Values are in US dollars (SEC changed from thousands in 2023).
 */
export function parseInfoTable(xml: string): Position[] {
  const by = new Map<string, Position>();
  for (const t of blocks(xml, "infoTable")) {
    const cusip = text(t, "cusip").toUpperCase();
    if (!cusip) continue;
    const putCall = text(t, "putCall").toUpperCase();
    const k = `${cusip}|${putCall}`;
    const row = by.get(k) ?? { cusip, issuer: unescape(text(t, "nameOfIssuer")), title: unescape(text(t, "titleOfClass")), putCall, value: 0, shares: 0 };
    row.value += Number(text(t, "value")) || 0;
    row.shares += Number(text(t, "sshPrnamt")) || 0;
    by.set(k, row);
  }
  return [...by.values()];
}

/**
 * Some managers still report values in thousands of dollars although the SEC switched to whole
 * dollars in 2023. A typical share then appears to cost well under $1: scale such filings by 1,000.
 */
export function normalizeUnits(rows: Position[]): { rows: Position[]; scaled: boolean } {
  const prices = rows.filter((r) => r.shares > 0 && !r.putCall).map((r) => r.value / r.shares).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  if (median == null || median >= 1) return { rows, scaled: false };
  return { rows: rows.map((r) => ({ ...r, value: r.value * 1000 })), scaled: true };
}

// 13F issuer names are abbreviated ("ASML HLDG NV"); listing names carry the security type
// ("Bruker Corporation Common Stock"). Bring both to the same plain company name before matching.
const ABBREV: [RegExp, string][] = [
  [/\bHLDGS?\b|\bHOLDING\b/g, "HOLDINGS"], [/\bINTL\b/g, "INTERNATIONAL"], [/\bFINL\b/g, "FINANCIAL"], [/\bTECHNOLOGIE?S?\b|\bTECH\b/g, "TECHNOLOGIES"],
  [/\bCOS\b/g, "COMPANIES"], [/\bMGMT\b/g, "MANAGEMENT"], [/\bSVCS?\b/g, "SERVICES"], [/\bPHARMACEUTICALS?\b|\bPHARMA\b/g, "PHARMACEUTICALS"],
  [/\bCOMMUNICATIONS?\b|\bCOMMS?\b/g, "COMMUNICATIONS"], [/\bLABS?\b|\bLABORATORIES\b/g, "LABORATORIES"], [/\bSYS\b/g, "SYSTEMS"],
  [/\bAMER\b/g, "AMERICA"], [/\bBANCORPORATION\b/g, "BANCORP"], [/\bN\s?V\b|\bN\.V\.|\bPLC\b|\bS\.?A\.?\b|\bAG\b|\bSE\b|\bLTD\b|\bLP\b/g, ""],
];
export function cleanIssuer(name: string): string {
  let s = name.toUpperCase()
    .replace(/\s+(DEL|NEW|COM|CL [A-Z]|SHS|SPONSORED ADR|ADR|ORD)\b.*$/, "")
    // Country of incorporation tacked on by some filers ("CHUBB LTD SWITZ").
    .replace(/\s+(SWITZ|SWITZERLAND|BERMUDA|IRELAND|IRL|NETH|NETHERLANDS|JERSEY|CAYMAN( IS(LANDS)?)?|GUERNSEY|LUXEMBOURG|CDA|CANADA|UK|ISRAEL)$/, "");
  for (const [re, to] of ABBREV) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}
export function cleanListingName(name: string): string {
  return cleanIssuer(name.replace(/\s+(-\s+)?(Class [A-Z]\s+)?(Common Stock|Ordinary Shares|Common Shares|Capital Stock|New York Registry Shares|American Depositary Shares?|Depositary Shares|Units?|Shares)\b.*$/i, ""));
}

export type Change ="yeni" | "artirdi" | "azaltti" | "satti" | "ayni";
export const CHANGE_LABEL: Record<Change, string> = { yeni: "Yeni", artirdi: "Artırdı", azaltti: "Azalttı", satti: "Sattı", ayni: "Aynı" };

/** Share-count change per position versus the previous quarter (±1% counts as unchanged). */
export function compareQuarters<T extends { cusip: string; putCall: string; shares: number }>(current: T[], previous: T[] | null) {
  const key = (p: { cusip: string; putCall: string }) => `${p.cusip}|${p.putCall}`;
  const prev = new Map((previous ?? []).map((p) => [key(p), p]));
  const rows = current.map((p) => {
    const before = prev.get(key(p));
    if (!previous) return { ...p, change: "ayni" as Change, sharesChange: null as number | null };
    if (!before || before.shares === 0) return { ...p, change: "yeni" as Change, sharesChange: null };
    const r = p.shares / before.shares - 1;
    return { ...p, change: (r > 0.01 ? "artirdi" : r < -0.01 ? "azaltti" : "ayni") as Change, sharesChange: r };
  });
  const now = new Set(current.map(key));
  const sold = (previous ?? []).filter((p) => !now.has(key(p)));
  return { rows, sold };
}
