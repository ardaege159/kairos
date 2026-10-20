import { describe, expect, it } from "vitest";
import { activeConditions, macroEffects, type MacroSnapshot } from "./macro-impact.ts";
import { buildThesis } from "./thesis.ts";

const macro: MacroSnapshot = {
  CPIAUCSL: { now: 3.1, m3: 3.7, m6: 3.5, y1: 3.0 },     // inflation falling
  DGS10: { now: 5.1, m3: 4.6, m6: 4.4, y1: 4.0 },        // yields up 0.5
  DFF: { now: 3.88, m3: 3.88, m6: 4.13, y1: 4.1 },       // Fed cut 0.25
  DCOILWTICO: { now: 102, m3: 85, m6: 80, y1: 60 },      // oil +20%
  UNRATE: { now: 4.2, m3: 4.1, m6: 4.2, y1: 4.4 },
  T10Y2Y: { now: 0.35, m3: 0.2, m6: 0.4, y1: 0.6 },
};

describe("macro impact", () => {
  it("lists the conditions in force", () => {
    expect(activeConditions(macro).map((c) => c.key)).toEqual(["inflation_down", "yields_up", "fed_cutting", "oil_up"]);
  });

  it("maps conditions to a sector and to stock traits", () => {
    const energy = macroEffects(macro, { sector: "Energy", pe: 12, debtToEquity: 0.4, marketCap: 300e9 });
    expect(energy.map((e) => [e.key, e.tone])).toEqual([["oil_up", "positive"]]);
    const tech = macroEffects(macro, { sector: "Information Technology", pe: 45, debtToEquity: 0.3, marketCap: 3e12 });
    expect(tech.map((e) => [e.key, e.tone])).toEqual([["inflation_down", "positive"], ["yields_up", "negative"]]);
    expect(tech[1].text).toContain("F/K 45");
    const reit = macroEffects(macro, { sector: "Real Estate", pe: 20, debtToEquity: 2, marketCap: 8e9 });
    expect(reit.map((e) => e.key)).toEqual(["inflation_down", "yields_up", "fed_cutting"]);
  });

  it("names the oil benchmark and cites the series and its date", () => {
    const dated: MacroSnapshot = { ...macro, DCOILWTICO: { ...macro.DCOILWTICO, date: "2026-10-14", name: "WTI ham petrol (spot)" } };
    const [oil] = macroEffects(dated, { sector: "Energy", pe: 12, debtToEquity: 0.4, marketCap: 300e9 });
    expect(oil.title).toContain("WTI ham petrol");
    expect(oil.source).toBe("WTI ham petrol (spot) · FRED · 14 Eki 2026 verisi");
    expect(macroEffects(macro, { sector: "Energy", pe: 12, debtToEquity: 0.4, marketCap: 300e9 })[0].source).toBeNull();
  });
});

describe("buildThesis", () => {
  it("weighs company, valuation, sector, macro and federal reasons into a stance", () => {
    const t = buildThesis({
      name: "Acme", sectorName: "Sanayi",
      points: { pros: [{ key: "growth", title: "Gelirleri hızlı büyüyor", detail: "…", strength: 0.8 }], cons: [], watch: [] },
      macro: [{ key: "oil_up", title: "Petrol yükseldi", text: "…", tone: "negative", weight: 0.5, source: null }],
      sector: { rank: 2, of: 11, return3m: 0.08 },
      valuation: { metric: "F/K", now: 15, median: 20 },
      federal: { amount12m: 2e9, revenue: 10e9, growth: 0.3, themes: [{ name: "Hipersonik ve füze", growth: 0.65 }] },
    });
    expect(t.reasons.map((r) => r.category)).toEqual(["Şirket", "Değerleme", "Sektör", "Makro", "Federal harcama", "Federal harcama"]);
    expect(t.stance).toBe("olumlu");
    expect(t.plus).toBeCloseTo(0.8 + 0.6 + 0.6 + 0.7 + 0.4);
    expect(t.summary).toContain("Acme için görünüm olumlu ağırlıklı.");
    expect(t.summary).toContain("Başlıca riskler: petrol yükseldi.");
  });

  it("is mixed when the two sides balance and negative when risks dominate", () => {
    const base = { name: "X", sectorName: "S", macro: [], sector: null, federal: null };
    expect(buildThesis({ ...base, valuation: null, points: { pros: [{ key: "a", title: "A", detail: "", strength: 0.7 }], cons: [{ key: "b", title: "B", detail: "", strength: 0.6 }], watch: [] } }).stance).toBe("karisik");
    expect(buildThesis({ ...base, valuation: { metric: "F/K", now: 60, median: 30 }, points: { pros: [], cons: [{ key: "b", title: "B", detail: "", strength: 0.9 }], watch: [] } }).stance).toBe("olumsuz");
  });
});
