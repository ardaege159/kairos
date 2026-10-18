import { describe, expect, it } from "vitest";
import { FILTERS, PRESETS, filterPath, parseRanges, toInput } from "./screener.ts";
import { METRIC_BY_KEY } from "./metrics/definitions.ts";

describe("screener", () => {
  it("converts typed values to stored units and ignores unknown or empty params", () => {
    const r = parseRanges({ pe_max: "15", roe_min: "20", market_cap_min: "2,5", foo_min: "1", pb_min: "", pb_max: "abc" });
    expect(r).toEqual([
      { key: "market_cap", min: 2.5e9, max: null },
      { key: "pe", min: null, max: 15 },
      { key: "roe", min: 0.2, max: null },
    ]);
  });

  it("round-trips input units", () => {
    expect(toInput("percent", 0.155)).toBe(15.5);
    expect(toInput("billions", 3e9)).toBe(3);
  });

  it("only offers metrics that exist, and presets only use known filters", () => {
    for (const f of FILTERS) if (f.key !== "score") expect(METRIC_BY_KEY[f.key], f.key).toBeDefined();
    for (const p of PRESETS) expect(parseRanges(p.params).length).toBe(Object.keys(p.params).length);
    expect(filterPath("score")).toBe("score");
    expect(filterPath("roe")).toBe("metrics->roe");
  });
});
