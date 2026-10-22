import { describe, expect, it } from "vitest";
import { extractMessages, htmlToText, parseMentions, sameCompany } from "./extract.ts";
import { SOURCES } from "./sources.ts";

const listing = new Map([
  ["CAVA", "CAVA Group, Inc."], ["META", "Meta Platforms, Inc."], ["BRK.B", "Berkshire Hathaway Inc."],
  ["MC", "Moelis & Company"], ["TSM", "Taiwan Semiconductor Manufacturing Company Ltd."],
]);
const byName = (c: string) => (sameCompany(c, "Taiwan Semiconductor Manufacturing") ? "TSM" : null);

describe("parseMentions", () => {
  it("keeps valid mentions of known tickers and normalizes them", () => {
    const raw = '```json\n{"stocks":[{"ticker":"$cava","company":"Cava Group","stance":"Olumlu","focus":"ana","summary":"Yazar düşüşü alım fırsatı görüyor.","points":["Mağaza büyümesi","Marj","Fiyat","Fazla"]},' +
      '{"ticker":"BRK/B","company":"Berkshire Hathaway","stance":"nötr","summary":"Değerlemeyi makul buluyor ama izliyor."},' +
      '{"ticker":"XYZ","stance":"olumlu","summary":"Listede olmayan hisse."},' +
      '{"ticker":"META","stance":"harika","summary":"Geçersiz görüş etiketi."}]}\n```';
    const m = parseMentions(raw, listing, byName);
    expect(m.map((x) => [x.ticker, x.stance])).toEqual([["CAVA", "olumlu"], ["BRK.B", "notr"]]);
    expect(m[0].points).toHaveLength(3);
    expect(m.map((x) => x.focus)).toEqual(["ana", "yan"]); // missing focus counts as a side mention
  });

  it("rejects a ticker that belongs to another company and recovers by name", () => {
    const raw = JSON.stringify({ stocks: [
      { ticker: "MC", company: "LVMH Moët Hennessy Louis Vuitton", stance: "notr", summary: "Lüks talebi zayıf, izliyor." },
      { ticker: "TSMC", company: "Taiwan Semiconductor Manufacturing", stance: "olumlu", summary: "Yapay zekâ talebiyle büyüme hızlanıyor." },
    ] });
    expect(parseMentions(raw, listing, byName).map((x) => x.ticker)).toEqual(["TSM"]);
  });

  it("returns nothing for malformed output", () => {
    expect(parseMentions("Bu yazıda hisse yok.", listing)).toEqual([]);
    expect(parseMentions('{"stocks":"yok"}', listing)).toEqual([]);
  });
});

describe("sameCompany", () => {
  it("compares the first significant words", () => {
    expect(sameCompany("Meta Platforms", "Meta Platforms, Inc.")).toBe(true);
    expect(sameCompany("Alphabet", "Alphabet Inc. (Class A)")).toBe(true);
    expect(sameCompany("LVMH", "Moelis & Company")).toBe(false);
    expect(sameCompany("The Walt Disney Company", "Walt Disney Co")).toBe(true);
  });
});

describe("prompt and text", () => {
  it("strips feed HTML to readable text", () => {
    expect(htmlToText("<![CDATA[<p>Cava&#8217;s <b>margins</b>&nbsp;rose.</p><script>x()</script><p>Second</p>]]>")).toBe("Cava's margins rose.\nSecond");
  });

  it("asks for JSON with the company name and passes the post", () => {
    const [sys, user] = extractMessages({ source: "Chit Chat Money", author: "CCM", title: "Cava (Ticker: CAVA)", text: "..." });
    expect(sys.content).toContain('{"stocks":[]}');
    expect(sys.content).toContain('"company"');
    expect(user.content).toContain("Başlık: Cava (Ticker: CAVA)");
  });

  it("has unique source keys and https feeds", () => {
    expect(new Set(SOURCES.map((s) => s.key)).size).toBe(SOURCES.length);
    expect(SOURCES.every((s) => s.feed.startsWith("https://"))).toBe(true);
  });
});
