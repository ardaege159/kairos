import { describe, expect, it } from "vitest";
import { contributions, sectorInsights, type Member } from "./insights.ts";

const members: Member[] = [
  { ticker: "BIG", name: "Big Co", market_cap: 800, return_1m: 0.08, return_3m: 0.3 },
  { ticker: "MID", name: "Mid Co", market_cap: 150, return_1m: 0.01, return_3m: 0.05 },
  { ticker: "SM1", name: "Small 1", market_cap: 20, return_1m: -0.02, return_3m: -0.1 },
  { ticker: "SM2", name: "Small 2", market_cap: 20, return_1m: -0.01, return_3m: -0.05 },
  { ticker: "SM3", name: "Small 3", market_cap: 10, return_1m: 0, return_3m: 0.02 },
];

describe("contributions", () => {
  it("weights each return by market cap", () => {
    const c = contributions(members);
    expect(c[0].ticker).toBe("BIG");
    expect(c[0].contribution).toBeCloseTo(0.8 * 0.3);
    expect(c.at(-1)!.ticker).toBe("SM1");
  });
});

describe("sectorInsights", () => {
  const base = {
    label: "Enerji",
    sector: { return_1m: 0.06, return_3m: 0.12, revenue_growth_yoy: 0.2, net_margin: 0.1, pe: 14 },
    market: { return_1m: 0.01, return_3m: 0.03, revenue_growth_yoy: 0.08, net_margin: 0.12, pe: 22 },
    rank3m: 2, sectorCount: 11, members, topics: [{ label: "Petrol ve enerji", count: 9 }, { label: "Jeopolitik", count: 4 }],
    spendingShare: 0.02, spendingRank: 6, earningsSoon: 3,
  };

  it("builds a headline and data-backed reasons", () => {
    const r = sectorInsights(base);
    expect(r.headline).toContain("2. sırada");
    expect(r.headline).toContain("öne çıkan");
    const keys = r.reasons.map((x) => x.key);
    expect(keys).toEqual(expect.arrayContaining(["momentum", "breadth", "growth", "valuation", "news", "earnings"]));
    expect(keys).not.toContain("spending"); // small share, rank 6
    expect(r.reasons.find((x) => x.key === "breadth")!.title).toBe("Hareket birkaç büyük hisseye dayalı");
    expect(r.leaders[0].ticker).toBe("BIG");
    expect(r.laggards[0].ticker).toBe("SM1");
  });

  it("flags a fading move", () => {
    const r = sectorInsights({ ...base, sector: { ...base.sector, return_1m: -0.02 } });
    expect(r.reasons.find((x) => x.key === "momentum")!.title).toBe("Son ayda soluklanıyor");
  });
});
