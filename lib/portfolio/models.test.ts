import { describe, expect, it } from "vitest";
import { buildModels, type Candidate } from "./models.ts";

const c = (ticker: string, sector: string, score: number, m: Record<string, number> = {}, pct: Record<string, number> = {}): Candidate =>
  ({ ticker, name: ticker, sector, price: 10, score, metrics: m, pct });

describe("buildModels", () => {
  const pool = [
    c("T1", "Information Technology", 90, { revenue_growth_yoy: 0.3, net_margin: 0.3, debt_to_equity: 0.2, pe: 30, return_3m: 0.4 }, { pe: 0.2 }),
    c("T2", "Information Technology", 80, { revenue_growth_yoy: 0.2, net_margin: 0.2, debt_to_equity: 0.1, pe: 25, return_3m: 0.3 }),
    c("T3", "Information Technology", 75, { revenue_growth_yoy: 0.2, net_margin: 0.2, debt_to_equity: 0.1, pe: 20, return_3m: 0.2 }),
    c("T4", "Information Technology", 70, { revenue_growth_yoy: 0.2, net_margin: 0.2, debt_to_equity: 0.1, pe: 18, return_3m: 0.1 }),
    c("E1", "Energy", 60, { revenue_growth_yoy: 0.05, net_margin: 0.1, pe: 9, return_3m: 0.5 }, { pe: 0.9 }),
    c("U1", "Utilities", 55, { net_margin: 0.12 }),
    c("L1", "Utilities", 40, { net_margin: -0.1 }),
  ];
  const models = Object.fromEntries(buildModels(pool, { "Information Technology": 28, Energy: 14, Utilities: 18 }).map((m) => [m.key, m]));

  it("picks one leader per sector", () => {
    expect(models.liderler.picks.map((p) => p.ticker)).toEqual(["T1", "E1", "U1"]);
  });

  it("caps any one sector at three names", () => {
    expect(models.kalite.picks.map((p) => p.ticker)).toEqual(["T1", "T2", "T3"]);
  });

  it("keeps only profitable names cheaper than their sector", () => {
    // T1 is excluded (P/E 30 is above the sector median 28); T2-T4 fit and stay within the 3-per-sector cap.
    expect(models.deger.picks.map((p) => p.ticker)).toEqual(["E1", "T2", "T3", "T4"]);
  });

  it("excludes loss-makers from the defensive basket", () => {
    expect(models.defansif.picks.map((p) => p.ticker)).toEqual(["U1"]);
  });
});
