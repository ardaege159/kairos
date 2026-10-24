import { describe, expect, it } from "vitest";
import { median, valuationHistory } from "./history.ts";
import type { Fundamentals } from "./compute.ts";

// Six quarters, net income 10 and revenue 100 each, 10 shares, equity 200.
const periods = ["CY2025Q1", "CY2025Q2", "CY2025Q3", "CY2025Q4", "CY2026Q1", "CY2026Q2"];
const ends: Record<string, string> = { CY2025Q1: "2025-03-31", CY2025Q2: "2025-06-30", CY2025Q3: "2025-09-30", CY2025Q4: "2025-12-31", CY2026Q1: "2026-03-31", CY2026Q2: "2026-06-30" };
function f(): Fundamentals {
  const m: Fundamentals = new Map();
  for (const p of periods) m.set(p, { net_income: 10, revenue: 100, shares_outstanding: 10, equity: 200 });
  return m;
}
const prices = [
  { date: "2025-12-31", close: 40 }, { date: "2026-03-30", close: 50 }, { date: "2026-06-30", close: 60 }, { date: "2026-10-16", close: 80 },
];

describe("valuationHistory", () => {
  it("uses the price at each quarter end and the trailing year known then", () => {
    const h = valuationHistory(f(), ends, prices, { date: "2026-10-16", price: 80 });
    // CY2025Q4 is the first quarter with four quarters of history and a price.
    expect(h.map((p) => p.date)).toEqual(["2025-12-31", "2026-03-31", "2026-06-30", "2026-10-16"]);
    expect(h[0]).toEqual({ date: "2025-12-31", pe: 400 / 40, ps: 400 / 400, pb: 400 / 200 });
    expect(h[1].pe).toBe(500 / 40); // 2026-03-31 falls back to the 03-30 close
    expect(h.at(-1)!.pe).toBe(800 / 40);
  });

  it("skips multiples on losses", () => {
    const m = f();
    for (const p of periods) m.get(p)!.net_income = -5;
    expect(valuationHistory(m, ends, prices).every((p) => p.pe === null)).toBe(true);
  });

  it("uses split-adjusted weighted shares when the cover-page count is stale, and the previous count when the newest is missing", () => {
    const m = f();
    // A 10-for-1 split: older cover pages still show the pre-split count; weighted counts are restated.
    for (const p of periods) m.get(p)!.shares_diluted = 10;
    m.get("CY2025Q4")!.shares_outstanding = 1;
    delete m.get("CY2026Q2")!.shares_outstanding;
    const h = valuationHistory(m, ends, prices, { date: "2026-10-16", price: 80 });
    expect(h[0].pe).toBe(400 / 40);
    expect(h.at(-1)!.pe).toBe(800 / 40);
  });

  it("takes medians of at least three values", () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([1, 2])).toBeNull();
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
