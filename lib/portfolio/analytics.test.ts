import { describe, expect, it } from "vitest";
import { annualVol, assessRisk, beta, holdings, maxDrawdown, valueHistory, weightedReturns, type Series } from "./analytics.ts";

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
const line = (start: number, step: number, n = 30): Series => days(n).map((date, i) => ({ date, close: start + step * i }));

describe("holdings", () => {
  it("computes cost, value, P/L and weights", () => {
    const r = holdings(
      [{ ticker: "A", shares: 10, buy_price: 100, buy_date: "2026-01-01" }, { ticker: "B", shares: 5, buy_price: 20, buy_date: "2026-01-01" }],
      { A: 120, B: 20 },
    );
    expect(r.cost).toBe(1100);
    expect(r.value).toBe(1300);
    expect(r.pnl).toBe(200);
    expect(r.pnlPct).toBeCloseTo(200 / 1100);
    expect(r.rows[0].weight).toBeCloseTo(1200 / 1300);
  });
});

describe("valueHistory", () => {
  it("adds positions from their buy date", () => {
    const h = valueHistory(
      [{ ticker: "A", shares: 1, buy_price: 100, buy_date: "2026-01-01" }, { ticker: "B", shares: 2, buy_price: 10, buy_date: "2026-01-03" }],
      { A: line(100, 1, 4), B: line(10, 1, 4) },
    );
    expect(h.map((x) => x.invested)).toEqual([100, 100, 120, 120]);
    expect(h[3].value).toBe(103 + 2 * 13);
  });
});

describe("risk measures", () => {
  it("measures volatility, drawdown and beta", () => {
    expect(annualVol(new Array(30).fill(0.01))).toBeCloseTo(0);
    expect(maxDrawdown([0.1, -0.5, 0.2])).toBeCloseTo(-0.5);
    const m = weightedReturns({ M: 1 }, { M: days(30).map((date, i) => ({ date, close: 100 * (1 + (i % 2 ? 0.01 : -0.01)) ** i })) });
    const doubled = m.map((x) => ({ date: x.date, r: x.r * 2 }));
    expect(beta(doubled, m)).toBeCloseTo(2);
  });

  it("rates a concentrated, speculative portfolio as high risk and a spread one lower", () => {
    const wobble = (amp: number): Series => days(60).map((date, i) => ({ date, close: 100 * (1 + (i % 2 ? amp : -amp)) }));
    const spy = wobble(0.005);
    const risky = assessRisk({
      weights: { X: 0.8, Y: 0.2 }, series: { X: wobble(0.05), Y: wobble(0.04) }, benchmark: spy,
      info: { X: { sector: "Information Technology", asset_type: "etf", speculative: true }, Y: { sector: "Information Technology", asset_type: "stock", speculative: false } },
    });
    expect(risky.level).toBe("high");
    const tickers = Array.from({ length: 12 }, (_, i) => `S${i}`);
    const calm = assessRisk({
      weights: Object.fromEntries(tickers.map((t) => [t, 1])),
      series: Object.fromEntries(tickers.map((t) => [t, wobble(0.003)])), benchmark: spy,
      info: Object.fromEntries(tickers.map((t, i) => [t, { sector: `Sector${i % 6}`, asset_type: "stock" as const, speculative: false }])),
    });
    expect(calm.level).toBe("low");
    expect(calm.effectiveHoldings).toBeCloseTo(12);
  });
});
