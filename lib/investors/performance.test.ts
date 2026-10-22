import { describe, expect, it } from "vitest";
import { isSmallStockPicker, medianPrices, quarterReturn, trackStats } from "./performance.ts";

describe("prices from filings", () => {
  it("takes the median value per share and needs enough filers", () => {
    const p = medianPrices(new Map([["A", [10, 11, 50]], ["B", [20]], ["C", [5, 7]]]));
    expect(p.get("A")).toBe(11);
    expect(p.has("B")).toBe(false);
    expect(p.get("C")).toBe(6);
  });
});

describe("quarterReturn", () => {
  it("weights by start value and drops unpriced positions", () => {
    const start = new Map([["A", 600], ["B", 300], ["X", 100]]);
    const p0 = new Map([["A", 10], ["B", 20], ["X", 5]]);
    const p1 = new Map([["A", 12], ["B", 18]]); // X delisted: no end price
    const q = quarterReturn(start, p0, p1)!;
    expect(q.r).toBeCloseTo((600 * 0.2 + 300 * -0.1) / 900);
    expect(q.coverage).toBeCloseTo(0.9);
    expect(quarterReturn(new Map([["Z", 1]]), p0, p1)).toBeNull();
  });
});

describe("trackStats", () => {
  it("annualizes, measures drawdown and counts quarters ahead of the benchmark", () => {
    const s = trackStats({ returns: [0.1, -0.2, 0.15, 0.05], bench: [0.05, -0.05, 0.05, 0.05] });
    expect(s.quarters).toBe(4);
    expect(s.annual).toBeCloseTo(1.1 * 0.8 * 1.15 * 1.05 - 1);
    expect(s.excess).toBeCloseTo((1.1 * 0.8 * 1.15 * 1.05) - (1.05 * 0.95 * 1.05 * 1.05));
    expect(s.maxDrawdown).toBeCloseTo(-0.2);
    expect(s.beat).toBe(2);
  });
});

describe("isSmallStockPicker", () => {
  const ok = { totalValue: 500e6, positions: 20, maxWeight: 0.15, fundShare: 0, quarters: 9, coverage: 0.95 };
  it("keeps concentrated small managers and drops the rest", () => {
    expect(isSmallStockPicker(ok, 8)).toBe(true);
    expect(isSmallStockPicker({ ...ok, totalValue: 20e9 }, 8)).toBe(false);   // too big
    expect(isSmallStockPicker({ ...ok, positions: 300 }, 8)).toBe(false);     // index-like
    expect(isSmallStockPicker({ ...ok, maxWeight: 0.9 }, 8)).toBe(false);     // holding company
    expect(isSmallStockPicker({ ...ok, fundShare: 0.6 }, 8)).toBe(false);     // ETF allocator
    expect(isSmallStockPicker({ ...ok, quarters: 4 }, 8)).toBe(false);        // short record
  });
});
