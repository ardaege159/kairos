import { describe, expect, it } from "vitest";
import { MACRO_BY_ID, macroView, realRate, transform, valueAt } from "./series.ts";

const monthly = (values: number[], start = 2024) =>
  values.map((value, i) => ({ date: `${start + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, value }));

describe("macro transforms", () => {
  it("computes year-over-year % and monthly differences", () => {
    const cpi = monthly(Array.from({ length: 14 }, (_, i) => 100 + i)); // Jan 2024 .. Feb 2025
    const yoy = transform(cpi, "yoy");
    expect(yoy).toHaveLength(2);
    expect(yoy[0]).toEqual({ date: "2025-01-01", value: expect.closeTo(12, 6) });
    expect(transform(monthly([100, 150, 120]), "mom_diff").map((o) => o.value)).toEqual([50, -30]);
  });

  it("finds the last observation on or before a date", () => {
    const obs = [{ date: "2026-01-02", value: 1 }, { date: "2026-01-05", value: 2 }];
    expect(valueAt(obs, "2026-01-04")?.value).toBe(1);
    expect(valueAt(obs, "2026-01-01")).toBeNull();
  });
});

describe("macro readings", () => {
  it("reads an inverted curve, high inflation and rising unemployment", () => {
    expect(macroView(MACRO_BY_ID.T10Y2Y, [{ date: "2026-10-01", value: -0.3 }]).reading?.tone).toBe("negative");
    const cpi = monthly(Array.from({ length: 13 }, (_, i) => (i < 12 ? 100 : 104)));
    expect(macroView(MACRO_BY_ID.CPIAUCSL, cpi).reading?.text).toContain("%4");
    const un = macroView(MACRO_BY_ID.UNRATE, monthly([...Array(12).fill(3.8), 4.5]));
    expect(un.yearAgo?.value).toBe(3.8);
    expect(un.reading?.tone).toBe("negative");
  });

  it("computes the real policy rate", () => {
    expect(realRate(4, 2.5)?.value).toBeCloseTo(1.5);
    expect(realRate(null, 2)).toBeNull();
  });
});
