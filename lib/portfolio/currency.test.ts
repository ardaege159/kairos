import { describe, expect, it } from "vitest";
import { benchmarkHistory, historyInTry, rateOn, tryBreakdown } from "./currency.ts";

const rates = [
  { date: "2026-01-02", close: 40 },
  { date: "2026-06-01", close: 45 },
  { date: "2026-10-16", close: 50 },
];

describe("lira conversion", () => {
  it("finds the rate on or before a date", () => {
    expect(rateOn(rates, "2026-06-05")).toBe(45);
    expect(rateOn(rates, "2026-10-18")).toBe(50);
    expect(rateOn(rates, "2025-12-01")).toBe(40); // before the series: first rate
  });

  it("splits lira P/L into stock and currency parts that add up", () => {
    // 10 shares bought at $100 when $1 = 40 TL; now $120 and $1 = 50 TL.
    const b = tryBreakdown([{ ticker: "A", shares: 10, buy_price: 100, buy_date: "2026-01-02" }], { A: 120 }, rates, "2026-10-18")!;
    expect(b.costTry).toBe(40_000);
    expect(b.valueTry).toBe(60_000);
    expect(b.fromStocks).toBe(200 * 50);
    expect(b.fromCurrency).toBe(1000 * 10);
    expect(b.fromStocks + b.fromCurrency).toBeCloseTo(b.pnlTry);
    expect(b.pnlPct).toBeCloseTo(0.5);
  });

  it("converts history with each purchase at its own rate", () => {
    const pos = [{ ticker: "A", shares: 1, buy_price: 100, buy_date: "2026-01-02" }, { ticker: "B", shares: 1, buy_price: 100, buy_date: "2026-06-01" }];
    const h = historyInTry(pos, [{ date: "2026-03-01", value: 110, invested: 100 }, { date: "2026-10-16", value: 230, invested: 200 }], rates);
    expect(h[0]).toEqual({ date: "2026-03-01", value: 4400, invested: 4000 });
    expect(h[1]).toEqual({ date: "2026-10-16", value: 11500, invested: 4000 + 4500 });
  });
});

describe("benchmarkHistory", () => {
  it("buys the benchmark with each purchase's money on its date", () => {
    const spy = [{ date: "2026-01-02", close: 500 }, { date: "2026-06-01", close: 550 }, { date: "2026-10-16", close: 600 }];
    const pos = [{ ticker: "A", shares: 10, buy_price: 100, buy_date: "2026-01-02" }, { ticker: "B", shares: 11, buy_price: 50, buy_date: "2026-06-01" }];
    const v = benchmarkHistory(pos, ["2026-01-02", "2026-10-16"], spy);
    expect(v[0]).toBeCloseTo(1000);
    expect(v[1]).toBeCloseTo(2 * 600 + 1 * 600); // 1000/500 = 2 units, 550/550 = 1 unit
  });
});
