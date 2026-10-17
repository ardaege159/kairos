import { describe, expect, it } from "vitest";
import { buildMatcher, normalizeName } from "./match.ts";

const companies = [
  { ticker: "LMT", name: "Lockheed Martin" },
  { ticker: "GD", name: "General Dynamics" },
  { ticker: "GM", name: "General Motors" },
  { ticker: "UNH", name: "UnitedHealth Group" },
  { ticker: "RTX", name: "RTX Corporation" },
  { ticker: "BA", name: "Boeing" },
  { ticker: "MCK", name: "McKesson" },
  { ticker: "GE", name: "GE Aerospace" },
];
const match = buildMatcher(companies);

describe("normalizeName", () => {
  it("drops legal suffixes and punctuation", () => {
    expect(normalizeName("The Boeing Company")).toBe("BOEING");
    expect(normalizeName("LOCKHEED MARTIN CORP.")).toBe("LOCKHEED MARTIN");
    expect(normalizeName("UNITEDHEALTH GROUP INCORPORATED")).toBe("UNITEDHEALTH");
  });
});

describe("buildMatcher", () => {
  it("matches parent names from USAspending", () => {
    expect(match("LOCKHEED MARTIN CORPORATION")).toEqual({ ticker: "LMT", method: "exact" });
    expect(match("UNITEDHEALTH GROUP INCORPORATED")).toEqual({ ticker: "UNH", method: "exact" });
    expect(match("GENERAL DYNAMICS CORP")).toEqual({ ticker: "GD", method: "exact" });
    expect(match("RTX CORPORATION")?.ticker).toBe("RTX");
    expect(match("THE BOEING COMPANY")?.ticker).toBe("BA");
  });

  it("matches subsidiaries that start with the parent's name", () => {
    expect(match("GENERAL DYNAMICS INFORMATION TECHNOLOGY INC")).toEqual({ ticker: "GD", method: "prefix" });
  });

  it("does not confuse companies that share a first word or match short names loosely", () => {
    expect(match("GENERAL ELECTRIC COMPANY")).toBeNull();
    expect(match("TRIWEST HEALTHCARE ALLIANCE CORP")).toBeNull();
    expect(match("GE HEALTHCARE")).toBeNull();
  });
});
