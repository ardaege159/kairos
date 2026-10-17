import { describe, expect, it } from "vitest";
import { classify, matchCompanies, shortName } from "./topics.ts";

describe("classify", () => {
  it("finds the main topic and all affected sectors", () => {
    const r = classify("Brent oil touches $110 as Iran escalates Hormuz attacks");
    expect(r.topic).toBe("energy");
    expect(r.sectors).toContain("Energy");
    expect(r.sectors).toContain("Industrials"); // geopolitics also matched
  });

  it("returns no topic for unrelated text", () => {
    expect(classify("Local team wins the cup").topic).toBeNull();
  });
});

describe("company matching", () => {
  const companies = [
    { ticker: "AAPL", name: "Apple Inc." },
    { ticker: "GOOGL", name: "Alphabet Inc. (Class A)" },
    { ticker: "TGT", name: "Target Corporation" },
    { ticker: "NVDA", name: "Nvidia" },
  ];

  it("builds short names", () => {
    expect(shortName("Alphabet Inc. (Class A)")).toBe("alphabet");
    expect(shortName("Coca-Cola Company (The)")).toBe("coca-cola");
  });

  it("matches names and explicit ticker mentions, skipping ambiguous words", () => {
    expect(matchCompanies("Apple's iPhone demand soars; Nvidia slips", companies).sort()).toEqual(["AAPL", "NVDA"]);
    expect(matchCompanies("Retailers miss their sales target", companies)).toEqual([]);
    expect(matchCompanies("Shares of Alphabet (NASDAQ: GOOGL) rose", companies)).toEqual(["GOOGL"]);
  });
});
