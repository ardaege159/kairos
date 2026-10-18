import { describe, expect, it } from "vitest";
import { classifyEtf } from "./etf.ts";

const cat = (name: string) => classifyEtf(name)?.key ?? null;

describe("classifyEtf", () => {
  it("classifies well-known ETFs", () => {
    expect(cat("State Street SPDR S&P 500 ETF Trust")).toBe("genis");
    expect(cat("Invesco QQQ Trust, Series 1")).toBe("genis");
    expect(cat("iShares Russell 2000 ETF")).toBe("genis");
    expect(cat("VanEck Semiconductor ETF")).toBe("sektor");
    expect(cat("iShares 20 Year Treasury Bond ETF")).toBe("tahvil");
    expect(cat("iShares iBoxx $ High Yield Corporate Bond ETF")).toBe("tahvil");
    expect(cat("iShares MSCI Emerging Markets ETF")).toBe("uluslararasi");
    expect(cat("SPDR Gold Shares")).toBe("emtia");
    expect(cat("iShares Bitcoin Trust ETF")).toBe("kripto");
  });

  it("puts leveraged funds first even when they track a sector or index", () => {
    expect(cat("Direxion Daily Semiconductor Bull 3X ETF")).toBe("kaldirac");
    expect(cat("ProShares UltraPro QQQ")).toBe("kaldirac");
  });

  it("does not match words inside other words", () => {
    expect(cat("Shortline Tactical ETF")).toBeNull();
    expect(cat("Mainstay Fund")).toBeNull();
  });
});
