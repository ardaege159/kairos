import { describe, expect, it } from "vitest";
import { cleanIssuer, cleanListingName, compareQuarters, normalizeUnits, parseInfoTable } from "./thirteenf.ts";
import { INVESTORS } from "./list.ts";

const XML = `<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip><value>1000</value>
    <shrsOrPrnAmt><sshPrnamt>10</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
  <infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip><value>500</value>
    <shrsOrPrnAmt><sshPrnamt>5</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
  <infoTable><nameOfIssuer>AT&amp;T INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>00206r102</cusip><value>200</value>
    <shrsOrPrnAmt><sshPrnamt>8</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
  <infoTable><nameOfIssuer>SPDR S&amp;P 500</nameOfIssuer><titleOfClass>PUT</titleOfClass><cusip>78462F103</cusip><value>300</value>
    <shrsOrPrnAmt><sshPrnamt>1</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt><putCall>Put</putCall></infoTable>
</informationTable>`;

describe("parseInfoTable", () => {
  it("sums sub-manager rows per security and keeps options separate", () => {
    const p = parseInfoTable(XML);
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual({ cusip: "037833100", issuer: "APPLE INC", title: "COM", putCall: "", value: 1500, shares: 15 });
    expect(p[1]).toMatchObject({ cusip: "00206R102", issuer: "AT&T INC" });
    expect(p[2]).toMatchObject({ putCall: "PUT", value: 300 });
  });
});

describe("units and names", () => {
  it("scales filings reported in thousands and leaves dollar filings alone", () => {
    const thousands = [{ cusip: "A", issuer: "A", title: "COM", putCall: "", value: 2500, shares: 10_000 }, { cusip: "B", issuer: "B", title: "COM", putCall: "", value: 800, shares: 2000 }];
    const r = normalizeUnits(thousands);
    expect(r.scaled).toBe(true);
    expect(r.rows[0].value).toBe(2_500_000);
    expect(normalizeUnits([{ cusip: "A", issuer: "A", title: "COM", putCall: "", value: 2_500_000, shares: 10_000 }]).scaled).toBe(false);
  });

  it("brings 13F issuer names and listing names to the same form", () => {
    expect(cleanIssuer("ASML HLDG NV")).toBe(cleanListingName("ASML Holding N.V. New York Registry Shares"));
    expect(cleanIssuer("BRUKER CORP")).toBe("BRUKER CORP");
    expect(cleanListingName("Bruker Corporation Common Stock")).toBe("BRUKER CORPORATION");
    expect(cleanIssuer("NEBIUS GROUP N.V.")).toBe(cleanListingName("Nebius Group N.V. Class A Ordinary Shares"));
    expect(cleanIssuer("ALLY FINL INC")).toBe("ALLY FINANCIAL INC");
    expect(cleanIssuer("CHUBB LTD SWITZ")).toBe("CHUBB");
    expect(cleanIssuer("ACCENTURE PLC IRELAND")).toBe("ACCENTURE");
  });
});

describe("compareQuarters", () => {
  it("labels new, increased, reduced, unchanged and sold positions", () => {
    const prev = [
      { cusip: "A", putCall: "", shares: 100 }, { cusip: "B", putCall: "", shares: 100 },
      { cusip: "C", putCall: "", shares: 100 }, { cusip: "D", putCall: "", shares: 100 },
    ];
    const cur = [
      { cusip: "A", putCall: "", shares: 150 }, { cusip: "B", putCall: "", shares: 50 },
      { cusip: "C", putCall: "", shares: 100.5 }, { cusip: "E", putCall: "", shares: 10 },
    ];
    const { rows, sold } = compareQuarters(cur, prev);
    expect(rows.map((r) => r.change)).toEqual(["artirdi", "azaltti", "ayni", "yeni"]);
    expect(rows[0].sharesChange).toBeCloseTo(0.5);
    expect(sold.map((s) => s.cusip)).toEqual(["D"]);
    expect(compareQuarters(cur, null).rows.every((r) => r.change === "ayni")).toBe(true);
  });

  it("has unique keys and CIKs in the investor list", () => {
    expect(new Set(INVESTORS.map((i) => i.key)).size).toBe(INVESTORS.length);
    expect(new Set(INVESTORS.map((i) => i.cik)).size).toBe(INVESTORS.length);
  });
});
