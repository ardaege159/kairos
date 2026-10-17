// Match USAspending recipient / parent names ("LOCKHEED MARTIN CORP") to listed companies.

const SUFFIXES = new Set([
  "INC", "INCORPORATED", "CORP", "CORPORATION", "CO", "COMPANY", "LLC", "LP", "LTD", "LIMITED", "PLC", "THE", "HOLDINGS", "HOLDING",
  "GROUP", "SA", "NV", "AG", "SE", "CLASS", "A", "B", "C",
]);

/** "The Boeing Company" -> "BOEING", "Alphabet Inc. (Class A)" -> "ALPHABET". */
export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .join(" ");
}

export type Candidate = { ticker: string; name: string };
export type Matcher = (recipient: string) => { ticker: string; method: "exact" | "prefix" } | null;

/**
 * Exact match on the normalized name first; then a whole-word prefix match ("GENERAL DYNAMICS" in
 * "GENERAL DYNAMICS INFORMATION TECHNOLOGY") for company names long enough to be distinctive.
 */
export function buildMatcher(companies: Candidate[]): Matcher {
  const exact = new Map<string, string>();
  const prefixes: [string, string][] = [];
  for (const c of companies) {
    const n = normalizeName(c.name);
    if (!n) continue;
    if (!exact.has(n)) exact.set(n, c.ticker);
    if (n.length >= 6 && n.includes(" ")) prefixes.push([n, c.ticker]);
    else if (n.length >= 7) prefixes.push([n, c.ticker]);
  }
  prefixes.sort((a, b) => b[0].length - a[0].length); // longest (most specific) first
  return (recipient) => {
    const r = normalizeName(recipient);
    if (!r) return null;
    const e = exact.get(r);
    if (e) return { ticker: e, method: "exact" };
    for (const [p, t] of prefixes) if (r === p || r.startsWith(`${p} `)) return { ticker: t, method: "prefix" };
    return null;
  };
}
