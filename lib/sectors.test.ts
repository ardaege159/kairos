import { describe, expect, it } from "vitest";
import { sicToSector } from "./sectors.ts";

describe("sicToSector", () => {
  it("maps real companies' SIC codes to their GICS sectors", () => {
    expect(sicToSector(3760)).toBe("Industrials"); // Rocket Lab, Kratos
    expect(sicToSector(3674)).toBe("Information Technology"); // semiconductors (Nvidia)
    expect(sicToSector(2834)).toBe("Health Care"); // pharma
    expect(sicToSector(7372)).toBe("Information Technology"); // prepackaged software
    expect(sicToSector(6798)).toBe("Real Estate"); // REIT
    expect(sicToSector(6022)).toBe("Financials"); // state banks
    expect(sicToSector(1311)).toBe("Energy"); // crude petroleum
    expect(sicToSector(3711)).toBe("Consumer Discretionary"); // motor vehicles (Tesla)
    expect(sicToSector(4911)).toBe("Utilities");
    expect(sicToSector(5331)).toBe("Consumer Staples"); // Walmart
  });

  it("returns null for unknown codes", () => {
    expect(sicToSector(null)).toBeNull();
    expect(sicToSector(9999)).toBeNull();
  });
});
