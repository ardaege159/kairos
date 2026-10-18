// SEC Form 4 (insider transactions) XML -> rows. The schema is flat and stable, so a small tag reader
// is enough; no XML dependency. Pure (tested).

export type InsiderTrade = {
  owner: string;
  role: string;              // "CEO", "Yönetim kurulu üyesi", "%10 hissedar"...
  date: string;              // transaction date
  code: string;              // P purchase, S sale, A award, M option exercise, F tax withholding, G gift...
  acquired: boolean;         // A (acquired) / D (disposed)
  shares: number;
  price: number | null;
  value: number | null;
  owned_after: number | null;
  plan: boolean;             // made under a Rule 10b5-1 trading plan (scheduled in advance)
};

const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const blocks = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
/** Text of <tag>…</tag>, or of <tag><value>…</value></tag> as Form 4 wraps most numbers. */
function text(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!m) return null;
  const inner = /<value>([\s\S]*?)<\/value>/.exec(m[1]);
  return unescape(inner ? inner[1] : m[1].replace(/<[^>]+>/g, ""));
}
const num = (v: string | null) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const flag = (v: string | null) => v === "1" || v?.toLowerCase() === "true";

function role(owner: string): string {
  const rel = text(owner, "reportingOwnerRelationship") != null ? owner : "";
  const title = text(rel, "officerTitle");
  const parts: string[] = [];
  if (flag(text(rel, "isOfficer"))) parts.push(title ? title : "Yönetici");
  if (flag(text(rel, "isDirector"))) parts.push("Yönetim kurulu üyesi");
  if (flag(text(rel, "isTenPercentOwner"))) parts.push("%10 hissedar");
  if (!parts.length && flag(text(rel, "isOther"))) parts.push(text(rel, "otherText") ?? "Diğer");
  return parts.join(", ") || "—";
}

/** "COOK TIMOTHY D" -> "Timothy D Cook" (Form 4 lists last name first for people). */
export function displayName(raw: string): string {
  const words = raw.trim().split(/\s+/);
  const isCompany = /\b(INC|LLC|LP|L\.P\.|CORP|TRUST|FUND|CAPITAL|PARTNERS|HOLDINGS|LTD|GROUP)\b/i.test(raw);
  const cap = (w: string) => (w.length <= 2 && !/^[A-Z]\.?$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (isCompany || words.length < 2) return words.map(cap).join(" ");
  return [...words.slice(1), words[0]].map(cap).join(" ");
}

export function parseForm4(xml: string): { issuerCik: number | null; trades: InsiderTrade[] } {
  const issuerCik = num(text(xml, "issuerCik"));
  const ownerXml = blocks(xml, "reportingOwner")[0] ?? "";
  const owner = displayName(text(ownerXml, "rptOwnerName") ?? "?");
  const ownerRole = role(ownerXml);
  // Newer filings flag 10b5-1 plans explicitly; older ones only mention it in footnotes.
  const plan = flag(text(xml, "aff10b5One")) || /10b5-1/i.test(blocks(xml, "footnotes").join(" "));
  const trades = blocks(xml, "nonDerivativeTransaction").map((t) => {
    const shares = num(text(t, "transactionShares")) ?? 0;
    const price = num(text(t, "transactionPricePerShare"));
    return {
      owner, role: ownerRole, plan,
      date: (text(t, "transactionDate") ?? "").slice(0, 10),
      code: text(t, "transactionCode") ?? "?",
      acquired: text(t, "transactionAcquiredDisposedCode") === "A",
      shares, price, value: price != null && price > 0 ? shares * price : null,
      owned_after: num(text(t, "sharesOwnedFollowingTransaction")),
    };
  }).filter((t) => t.date && t.shares > 0);
  return { issuerCik, trades };
}

export const CODE_LABEL: Record<string, string> = {
  P: "Piyasadan alım", S: "Piyasada satış", A: "Hisse ödülü", M: "Opsiyon kullanımı", F: "Vergi için kesinti",
  G: "Bağış", D: "Şirkete iade", C: "Dönüşüm", X: "Opsiyon kullanımı", J: "Diğer",
};

/** Open-market activity over a window: what actually signals conviction. */
export function summarize(trades: (InsiderTrade & { ticker?: string })[]) {
  const buys = trades.filter((t) => t.code === "P");
  const sells = trades.filter((t) => t.code === "S");
  const sum = (xs: InsiderTrade[]) => xs.reduce((s, t) => s + (t.value ?? 0), 0);
  return {
    buyValue: sum(buys), sellValue: sum(sells),
    buyers: new Set(buys.map((t) => t.owner)).size, sellers: new Set(sells.map((t) => t.owner)).size,
    plannedSellShare: sells.length ? sum(sells.filter((t) => t.plan)) / (sum(sells) || 1) : null,
  };
}
