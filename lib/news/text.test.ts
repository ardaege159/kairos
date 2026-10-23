import { describe, expect, it } from "vitest";
import { cleanFeedText, decodeEntities } from "./text";
import { parseTranslations } from "./translate";

describe("decodeEntities", () => {
  it("decodes hex, decimal and named entities", () => {
    expect(decodeEntities("Here&#x2019;s why &#8212; S&amp;P &quot;rally&quot;")).toBe("Here’s why — S&P \"rally\"");
  });
  it("leaves unknown entities alone", () => {
    expect(decodeEntities("a &foo; b")).toBe("a &foo; b");
  });
});

describe("cleanFeedText", () => {
  it("strips CDATA and escaped markup", () => {
    expect(cleanFeedText("<![CDATA[<p>Stocks &lt;b&gt;rise&lt;/b&gt;</p>]]>")).toBe("Stocks rise");
  });
});

describe("parseTranslations", () => {
  const items = [{ id: "a", title: "A", description: "x" }, { id: "b", title: "B", description: null }];
  it("maps numbered answers to ids and drops empty summaries", () => {
    const out = parseTranslations(items, JSON.stringify({ haberler: [{ n: 2, baslik: "B tr", ozet: "" }, { n: 1, baslik: "A tr", ozet: "Özet." }] }));
    expect(out).toEqual([{ id: "b", title_tr: "B tr", summary_tr: null }, { id: "a", title_tr: "A tr", summary_tr: "Özet." }]);
  });
  it("ignores bad JSON, unknown numbers and duplicates", () => {
    expect(parseTranslations(items, "not json")).toEqual([]);
    expect(parseTranslations(items, JSON.stringify({ haberler: [{ n: 5, baslik: "x" }, { n: 1, baslik: "A" }, { n: 1, baslik: "A2" }] }))).toEqual([{ id: "a", title_tr: "A", summary_tr: null }]);
  });
});
