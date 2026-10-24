import { describe, expect, it } from "vitest";
import { surpriseSummary } from "./earnings.ts";

const q = (d: string, rep: number | null, est: number | null, pct: number | null) => ({ fiscal_date_ending: d, reported_date: d, reported_eps: rep, estimated_eps: est, surprise_pct: pct });

describe("surpriseSummary", () => {
  it("counts beats and misses over the most recent reported quarters", () => {
    const s = surpriseSummary([
      q("2025-03-31", 1.0, 1.1, -9.1), q("2026-06-30", 2.0, 1.8, 11.1), q("2026-03-31", 1.9, 1.9, 0),
      q("2025-12-31", 2.1, 2.0, 5), q("2025-09-30", 1.5, 1.6, -6.25), q("2026-09-30", null, 2.1, null),
    ], 4);
    expect(s.quarters).toBe(4);
    expect(s.beats).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.last?.fiscal_date_ending).toBe("2026-06-30");
    expect(s.avgSurprise).toBeCloseTo((0 + 5) / 2); // median of -6.25, 0, 5, 11.1
    expect(s.recentMisses).toBe(1);
  });

  it("ignores surprise % on estimates near zero", () => {
    const s = surpriseSummary([q("2026-06-30", 0.29, 0.01, 2800), q("2026-03-31", 1.1, 1.0, 10), q("2025-12-31", 1.05, 1.0, 5)]);
    expect(s.beats).toBe(3);
    expect(s.avgSurprise).toBeCloseTo(7.5);
  });

  it("handles no data", () => {
    expect(surpriseSummary([])).toMatchObject({ quarters: 0, beats: 0, avgSurprise: null, last: null });
  });
});
