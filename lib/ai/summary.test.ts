import { describe, expect, it } from "vitest";
import { summaryMessages } from "./summary.ts";

describe("summaryMessages", () => {
  it("passes only the computed facts and forbids recommendations", () => {
    const [sys, user] = summaryMessages({
      ticker: "LMT", name: "Lockheed Martin", sector: "Sanayi", price: 550, score: 74, stanceLabel: "Olumlu ağırlıklı",
      reasons: [
        { category: "Şirket", title: "Borç yükü yüksek", text: "Borç/özsermaye 2,3.", tone: "negative", weight: 0.7 },
        { category: "Makro", title: "Petrol yükseldi", text: "Maliyet artar.", tone: "negative", weight: 0.5 },
      ],
    });
    expect(sys.content).toContain("uydurma");
    expect(sys.content).toContain("'Al', 'sat'");
    expect(user.content).toContain("LMT (Lockheed Martin)");
    expect(user.content).toContain("- [Şirket] [olumsuz] Borç yükü yüksek: Borç/özsermaye 2,3.");
    expect(user.content).toContain("Genel görünüm: Olumlu ağırlıklı.");
  });
});
