import { describe, expect, it } from "vitest";
import { stockPoints, type StockInput } from "./stock.ts";

const base: StockInput = {
  metrics: { pe: 12, net_margin: 0.25, roe: 0.3, revenue_growth_yoy: 0.22, net_cash: 5e9, debt_to_equity: 0.2, current_ratio: 2, return_3m: 0.18, high_52w: 120 },
  pct: { pe: 0.9, net_margin: 0.85, roe: 0.9, debt_to_equity: 0.8, return_3m: 0.85 },
  sectorMedian: { pe: 22, net_margin: 0.12, debt_to_equity: 0.6 },
  score: 80, price: 110, daysToEarnings: 5, federal12m: null,
};

describe("stockPoints", () => {
  it("lists data-backed strengths for a strong, cheap company", () => {
    const r = stockPoints(base);
    const keys = r.pros.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["pe", "margin", "growth", "momentum"]));
    expect(r.pros.length).toBeLessThanOrEqual(5);
    expect(r.cons).toEqual([]);
    expect(r.pros.find((p) => p.key === "pe")!.detail).toContain("sektör medyanı 22");
    expect(r.watch.map((w) => w.key)).toContain("earnings");
  });

  it("flags losses, shrinking sales, heavy debt and a deep drawdown", () => {
    const r = stockPoints({
      ...base,
      metrics: { net_margin: -0.1, revenue_growth_yoy: -0.08, debt_to_equity: 3.2, current_ratio: 0.7, return_3m: -0.2, high_52w: 200 },
      pct: { debt_to_equity: 0.05, return_3m: 0.1 },
      price: 100, daysToEarnings: null,
    });
    expect(r.cons.map((c) => c.key)).toEqual(expect.arrayContaining(["loss", "growth", "debt", "liquidity", "momentum"]));
    expect(r.watch.map((w) => w.key)).toContain("drawdown");
    expect(r.pros).toEqual([]);
  });
});
