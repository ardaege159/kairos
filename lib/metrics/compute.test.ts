import { describe, expect, it } from "vitest";
import {
  fundamentalMetrics,
  kairosScore,
  percentileOf,
  percentiles,
  priceMetrics,
  quantile,
  shiftPeriod,
  ttm,
  type Fundamentals,
} from "./compute.ts";

// Eight quarters of a simple company: revenue 100..170 step 10, net income 10% of revenue.
function sample(): Fundamentals {
  const f: Fundamentals = new Map();
  const periods = ["CY2024Q3", "CY2024Q4", "CY2025Q1", "CY2025Q2", "CY2025Q3", "CY2025Q4", "CY2026Q1", "CY2026Q2"];
  periods.forEach((p, i) => {
    const revenue = 100 + i * 10;
    f.set(p, {
      revenue,
      net_income: revenue * 0.1,
      operating_income: revenue * 0.2,
      gross_profit: revenue * 0.5,
      equity: 400,
      assets: 1000,
      current_assets: 300,
      current_liabilities: 150,
      long_term_debt: 200,
      cash: 50,
      shares_outstanding: 10,
    });
  });
  return f;
}

describe("periods", () => {
  it("shifts across year boundaries", () => {
    expect(shiftPeriod("CY2026Q1", -1)).toBe("CY2025Q4");
    expect(shiftPeriod("CY2025Q4", 1)).toBe("CY2026Q1");
    expect(shiftPeriod("CY2026Q2", -4)).toBe("CY2025Q2");
  });
});

describe("ttm", () => {
  it("sums the last four quarters and fails on gaps", () => {
    const f = sample();
    expect(ttm(f, "revenue", "CY2026Q2")).toBe(140 + 150 + 160 + 170);
    expect(ttm(f, "revenue", "CY2026Q2", 4)).toBe(100 + 110 + 120 + 130);
    f.get("CY2026Q1")!.revenue = undefined as unknown as number;
    delete f.get("CY2026Q1")!.revenue;
    expect(ttm(f, "revenue", "CY2026Q2")).toBeNull();
  });
});

describe("data guards", () => {
  it("checks the cover-page share count against the weighted diluted count", () => {
    const f = sample();
    for (const q of f.values()) q.shares_diluted = 10;
    f.get("CY2026Q2")!.shares_outstanding = 10_000; // filed in the wrong unit
    expect(fundamentalMetrics(f, 20).metrics.market_cap).toBe(200);
    f.get("CY2026Q2")!.shares_outstanding = 11; // ordinary buybacks/issuance: cover page wins
    expect(fundamentalMetrics(f, 20).metrics.market_cap).toBe(220);
    f.get("CY2026Q2")!.shares_outstanding = 15; // an acquisition paid in stock...
    f.get("CY2026Q2")!.shares_diluted = 15_000; // ...and the weighted count filed 1,000× too large
    f.get("CY2026Q1")!.shares_diluted = 12_000; // two quarters in a row
    expect(fundamentalMetrics(f, 20).metrics.market_cap).toBe(300);
    f.get("CY2026Q1")!.shares_diluted = 10;
    f.get("CY2026Q2")!.shares_diluted = 10;
    for (const q of f.values()) delete q.shares_outstanding; // one share class only, or none filed
    expect(fundamentalMetrics(f, 20).metrics.market_cap).toBe(200);
  });

  it("drops revenue-based figures when profit exceeds revenue", () => {
    const f = sample();
    for (const q of f.values()) q.revenue = q.net_income / 2; // a bank's fee income only
    const m = fundamentalMetrics(f, 20).metrics;
    expect([m.ps, m.net_margin, m.gross_margin, m.revenue_growth_yoy]).toEqual([null, null, null, null]);
    expect(m.pe).not.toBeNull();
  });
});

describe("cash flow and dividends", () => {
  // Fiscal year ends CY2025Q4: OCF 80, capex 30, D&A 20, dividends paid 15; market cap 200.
  function withCashFlow(): Fundamentals {
    const f = sample();
    Object.assign(f.get("CY2025Q4")!, { ocf_fy: 80, capex_fy: 30, da_fy: 20, dividends_paid_fy: 15 });
    return f;
  }

  it("pairs annual cash flows with the same fiscal year's income statement", () => {
    const m = fundamentalMetrics(withCashFlow(), 20).metrics;
    const fyRevenue = 120 + 130 + 140 + 150; // CY2025Q1..Q4
    expect(m.fcf).toBe(50);
    expect(m.fcf_yield).toBeCloseTo(50 / 200);
    expect(m.fcf_margin).toBeCloseTo(50 / fyRevenue);
    expect(m.ev_ebitda).toBeCloseTo((200 + 200 - 50) / (fyRevenue * 0.2 + 20));
    expect(m.payout_ratio).toBeCloseTo(15 / (fyRevenue * 0.1));
    expect(m.dividend_yield).toBeCloseTo(15 / 200); // no per-share data: falls back to cash paid
  });

  it("prefers declared dividends per share and treats a cash-flow filer without dividends as zero", () => {
    const f = withCashFlow();
    for (const p of ["CY2025Q3", "CY2025Q4", "CY2026Q1", "CY2026Q2"]) f.get(p)!.dividends_ps = 0.25;
    expect(fundamentalMetrics(f, 20).metrics.dividend_yield).toBeCloseTo(1 / 20);
    expect(fundamentalMetrics(f, 20).metrics.payout_ratio).toBeCloseTo((1 * 10) / 62); // dps × shares ÷ TTM net income

    const g = sample();
    Object.assign(g.get("CY2025Q4")!, { ocf_fy: 80, capex_fy: 30 });
    expect(fundamentalMetrics(g, 20).metrics.dividend_yield).toBe(0);
    expect(fundamentalMetrics(sample(), 20).metrics.dividend_yield).toBeNull(); // no cash-flow data at all
  });

  it("leaves free cash flow unknown when capex is not reported", () => {
    const f = sample();
    f.get("CY2025Q4")!.ocf_fy = 80;
    expect(fundamentalMetrics(f, 20).metrics.fcf).toBeNull();
  });
});

describe("fundamentalMetrics", () => {
  it("computes valuation, margins, growth and health from hand-checked numbers", () => {
    const { period, metrics: m } = fundamentalMetrics(sample(), 20); // market cap = 20 × 10 = 200
    expect(period).toBe("CY2026Q2");
    const revenue = 620, netIncome = 62;
    expect(m.market_cap).toBe(200);
    expect(m.pe).toBeCloseTo(200 / netIncome);
    expect(m.pb).toBeCloseTo(200 / 400);
    expect(m.ps).toBeCloseTo(200 / revenue);
    expect(m.ev_sales).toBeCloseTo((200 + 200 - 50) / revenue);
    expect(m.eps_ttm).toBeCloseTo(6.2);
    expect(m.net_margin).toBeCloseTo(0.1);
    expect(m.operating_margin).toBeCloseTo(0.2);
    expect(m.gross_margin).toBeCloseTo(0.5);
    expect(m.roe).toBeCloseTo(netIncome / 400);
    expect(m.roa).toBeCloseTo(netIncome / 1000);
    expect(m.revenue_growth_yoy).toBeCloseTo(170 / 130 - 1);
    expect(m.revenue_growth_ttm).toBeCloseTo(620 / 460 - 1);
    expect(m.debt_to_equity).toBeCloseTo(0.5);
    expect(m.current_ratio).toBeCloseTo(2);
    expect(m.net_cash).toBe(-150);
  });

  it("leaves debt-based metrics empty when debt is not reported", () => {
    const f = sample();
    for (const q of f.values()) delete q.long_term_debt;
    const m = fundamentalMetrics(f, 20).metrics;
    expect(m.debt_to_equity).toBeNull();
    expect(m.ev_sales).toBeNull();
    expect(m.net_cash).toBeNull();
    expect(m.pb).toBeCloseTo(0.5);
  });

  it("does not report P/E for loss-making companies", () => {
    const f = sample();
    for (const q of f.values()) q.net_income = -5;
    expect(fundamentalMetrics(f, 20).metrics.pe).toBeNull();
  });
});

describe("priceMetrics", () => {
  it("computes returns and the 52-week range", () => {
    const bars = Array.from({ length: 300 }, (_, i) => ({
      date: `d${String(i).padStart(4, "0")}`,
      close: 100 + i,
      high: 101 + i,
      low: 99 + i,
    }));
    const m = priceMetrics(bars);
    expect(m.price).toBe(399);
    expect(m.change_1d).toBeCloseTo(399 / 398 - 1);
    expect(m.return_1m).toBeCloseTo(399 / 378 - 1);
    expect(m.return_1y).toBeCloseTo(399 / 147 - 1);
    expect(m.high_52w).toBe(400);
    expect(m.low_52w).toBe(99 + 48);
    expect(m.dollar_volume).toBeNull(); // no volume in these bars
  });

  it("averages traded value over the last 20 days", () => {
    const bars = Array.from({ length: 30 }, (_, i) => ({ date: `d${String(i).padStart(2, "0")}`, close: 10, high: 10, low: 10, volume: i < 10 ? 1 : 100 }));
    expect(priceMetrics(bars).dollar_volume).toBe(1000);
  });
});

describe("percentiles and score", () => {
  it("orients percentiles so 1 is better", () => {
    const vals = new Map([["A", 10], ["B", 20], ["C", 30]]);
    expect(percentiles(vals, "higher").get("C")).toBe(1);
    expect(percentiles(vals, "lower").get("A")).toBe(1);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("places an outside stock within its peers' distribution", () => {
    expect(percentileOf([10, 20, 30, 40], 35, "higher")).toBeCloseTo(0.75);
    expect(percentileOf([10, 20, 30, 40], 35, "lower")).toBeCloseTo(0.25);
    expect(percentileOf([10, 20, 30, 40], 20, "higher")).toBeCloseTo(0.375);
    expect(percentileOf([], 1, "higher")).toBeNull();
  });

  it("renormalises weights over available parts", () => {
    const all = Object.fromEntries(
      ["pe", "pb", "ps", "ev_sales", "gross_margin", "operating_margin", "net_margin", "roe", "revenue_growth_yoy",
        "net_income_growth_yoy", "revenue_growth_ttm", "debt_to_equity", "current_ratio", "return_3m", "return_1y"].map((k) => [k, 1]),
    );
    expect(kairosScore({ sectorPct: all, sectorDirection: 1 }).score).toBe(100);
    expect(kairosScore({ sectorPct: { pe: 0.5 }, sectorDirection: null })).toEqual({ score: 50, parts: { valuation: 50 } });
    expect(kairosScore({ sectorPct: {}, sectorDirection: null }).score).toBeNull();
  });
});
