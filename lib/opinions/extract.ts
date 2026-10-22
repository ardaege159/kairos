// Turn one investor write-up into structured stock opinions with an LLM, and validate what comes back.
// The model gets only the post's public text. It returns a ticker and the company name; a ticker is
// accepted only when the name agrees with our listing for it (an "MC" for LVMH must not land on Moelis),
// otherwise the name is looked up instead. Anything malformed is dropped. Pure (tested).

export type Stance = "olumlu" | "olumsuz" | "notr";
export type Mention = { ticker: string; stance: Stance; focus: "ana" | "yan"; summary: string; points: string[] };

export function extractMessages(post: { source: string; author: string; title: string; text: string }) {
  return [
    {
      role: "system" as const,
      content:
        "Bir yatırım yazısını okuyup yazarın HANGİ hisseler hakkında NE düşündüğünü çıkarırsın. Yalnızca yazarın kendi görüşünü belirttiği, " +
        "üzerinde gerekçeyle durduğu hisseleri al; sadece adı geçen, örnek verilen ya da listelenen hisseleri alma. Derleme yazılarında " +
        "(başkalarının önerileri) öneriyi yapan kişiyi/fonu özette belirt. Hisse kodu olarak ABD borsasındaki kodu yaz (ör. TSMC için TSM, " +
        "Alphabet için GOOGL, Berkshire için BRK.B); ABD'de işlem görmüyorsa ana borsasındaki kodu yaz. 'company' alanına şirketin tam adını yaz. " +
        "Görüş: 'olumlu' (alım, iyimser, hedef yukarı), 'olumsuz' (satış, açığa satış, kötümser) ya da 'notr' (karışık, izliyor). " +
        "Her hisse için 'focus' alanına yazının ana konusu o hisseyse 'ana', başka bir şirketi anlatırken değerlendirilmişse 'yan' yaz. " +
        "Özet ve maddeler Türkçe olsun, yazıda olmayan bilgi ve rakam ekleme. " +
        'Yalnızca şu JSON\'u döndür: {"stocks":[{"ticker":"ABC","company":"Şirket adı","stance":"olumlu","focus":"ana","summary":"1-2 cümle","points":["en fazla 3 kısa gerekçe"]}]}. ' +
        'Yazı tek tek hisseleri değerlendirmiyorsa {"stocks":[]} döndür.',
    },
    { role: "user" as const, content: `Kaynak: ${post.source} (${post.author})\nBaşlık: ${post.title}\n\nMetin:\n${post.text}` },
  ];
}

const STANCES = new Set(["olumlu", "olumsuz", "notr", "nötr"]);
const STOP = new Set(["THE", "INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED", "PLC", "HOLDINGS", "HOLDING", "GROUP", "SA", "NV", "AG", "SE", "CLASS", "AND"]);
const words = (s: string) => s.toUpperCase().replace(/\(.*?\)/g, " ").replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

/** Do two company names refer to the same company? First significant words must agree. */
export function sameCompany(a: string, b: string): boolean {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  return x[0] === y[0] || x.join("").startsWith(y.join("").slice(0, 6)) || y.join("").startsWith(x.join("").slice(0, 6));
}

/**
 * Parse the model's JSON (tolerating code fences). `listing` maps our tickers to company names;
 * `byName` finds a ticker from a company name when the model's ticker is missing or belongs to another company.
 */
export function parseMentions(raw: string, listing: Map<string, string>, byName: (company: string) => string | null = () => null): Mention[] {
  const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let data: unknown;
  try { data = JSON.parse(body); } catch { return []; }
  const list = (data as { stocks?: unknown })?.stocks;
  if (!Array.isArray(list)) return [];
  const out = new Map<string, Mention>();
  for (const s of list as Record<string, unknown>[]) {
    let ticker = String(s?.ticker ?? "").toUpperCase().replace(/^\$/, "").replace("/", ".").trim();
    const company = String(s?.company ?? "").trim();
    const stance = String(s?.stance ?? "").toLowerCase();
    const summary = String(s?.summary ?? "").trim();
    if (!STANCES.has(stance) || summary.length < 10) continue;
    const listed = listing.get(ticker);
    if (!listed || (company && !sameCompany(company, listed))) ticker = (company && byName(company)) || "";
    if (!ticker || !listing.has(ticker)) continue;
    const points = Array.isArray(s.points) ? (s.points as unknown[]).map((p) => String(p).trim()).filter(Boolean).slice(0, 3) : [];
    out.set(ticker, { ticker, stance: (stance === "nötr" ? "notr" : stance) as Stance, focus: String(s.focus ?? "").toLowerCase() === "ana" ? "ana" : "yan", summary: summary.slice(0, 600), points: points.map((p) => p.slice(0, 200)) });
  }
  return [...out.values()];
}

/** Plain text from feed HTML: tags and entities out, whitespace collapsed, capped for the prompt. */
export function htmlToText(html: string, max = 9000): string {
  return html
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#8217;|&#39;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .slice(0, max);
}
