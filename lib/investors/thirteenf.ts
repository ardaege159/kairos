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

export type Change = "yeni" | "artirdi" | "azaltti" | "satti" | "ayni";
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
