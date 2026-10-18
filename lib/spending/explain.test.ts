import { describe, expect, it } from "vitest";
import { explainAction, money, type ActionInput } from "./explain.ts";
import { themesOf } from "./themes.ts";
import { fiscalQuarterOf, fqLabel, growth, naicsSector } from "./trends.ts";

describe("trends", () => {
  it("computes growth and fiscal quarters", () => {
    expect(growth(150, 100)).toBeCloseTo(0.5);
    expect(growth(100, 0)).toBeNull();
    expect(fiscalQuarterOf("2025-10-01")).toEqual({ fy: 2026, q: 1 });
    expect(fiscalQuarterOf("2026-09-30")).toEqual({ fy: 2026, q: 4 });
    expect(fiscalQuarterOf("2026-02-15")).toEqual({ fy: 2026, q: 2 });
    expect(fqLabel(2026, 4)).toBe("MY26 Ç4");
    expect(naicsSector("336411")).toBe("İmalat");
    expect(naicsSector("541715")).toBe("Mühendislik, Ar-Ge ve danışmanlık");
  });
});

const base: ActionInput = {
  amount: 500e6, action_date: "2026-09-30", modification: "0", award_type: "DEFINITIVE CONTRACT",
  description: "HYPERSONIC MISSILE PRODUCTION LOT 3", agency: "Department of Defense", sub_agency: "Department of the Navy",
  naics_desc: "GUIDED MISSILE AND SPACE VEHICLE MANUFACTURING", psc_desc: null, total_obligation: 500e6, potential_value: 2e9,
  pop_start: "2026-10-01", pop_end: "2030-09-30", competition: "NOT COMPETED", offers: 1,
};
const titles = (r: ReturnType<typeof explainAction>) => r.points.map((p) => p.title);

describe("explainAction", () => {
  it("reads a large new multi-year sole-source defense award", () => {
    const r = explainAction(base, { name: "Acme", revenue: 5e9, federal12m: 2e9 });
    expect(titles(r)).toEqual(expect.arrayContaining([
      "Yeni sözleşme ya da sipariş", "Şirket için önemi: şirket için büyük", "Devlet ana müşterisi",
      "İleriye dönük potansiyel", "Çok yıllık iş", "Rekabetsiz verildi", "Hangi bütçeden?",
    ]));
    expect(r.points.find((p) => p.title.startsWith("Şirket için"))!.detail).toContain("%10");
    expect(r.themes.map((t) => t.key)).toContain("hipersonik");
  });

  it("treats periodic reports as continuing revenue, not new business", () => {
    const r = explainAction({ ...base, description: "EXPRESS REPORT: AUGUST 2026", potential_value: null, pop_start: null, pop_end: null }, null);
    expect(titles(r)).toContain("Süregelen bir programın dönemsel ödemesi");
    expect(titles(r)).not.toContain("Yeni sözleşme ya da sipariş");
  });

  it("calls a modification an extension and a small award small", () => {
    const r = explainAction({ ...base, modification: "P00012", amount: 10e6, competition: "FULL AND OPEN COMPETITION", offers: 4 }, { name: "Big", revenue: 50e9, federal12m: 1e9 });
    expect(titles(r)).toContain("Mevcut sözleşmeye ek");
    expect(titles(r)).toContain("Şirket için önemi: şirketin ölçeğine göre küçük");
    expect(titles(r)).toContain("Açık ihaleyle kazanıldı");
    expect(titles(r)).not.toContain("Devlet ana müşterisi");
  });
});

describe("themes and money", () => {
  it("matches themes by text and formats amounts", () => {
    expect(themesOf("Cloud migration for data center consolidation").map((t) => t.key)).toEqual(["bulut"]);
    expect(themesOf("office furniture")).toEqual([]);
    expect(money(1.5e9)).toBe("1,5 milyar $");
    expect(money(2.25e6)).toBe("2,3 milyon $");
  });
});
