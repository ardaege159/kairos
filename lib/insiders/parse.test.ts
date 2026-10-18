import { describe, expect, it } from "vitest";
import { displayName, parseForm4, summarize } from "./parse.ts";

// Trimmed Form 4 in the SEC's ownershipDocument schema.
const XML = `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerCik>0000320193</issuerCik><issuerName>Apple Inc.</issuerName><issuerTradingSymbol>AAPL</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0001214156</rptOwnerCik><rptOwnerName>COOK TIMOTHY D</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship><isDirector>1</isDirector><isOfficer>1</isOfficer><officerTitle>Chief Executive Officer</officerTitle></reportingOwnerRelationship>
  </reportingOwner>
  <aff10b5One>1</aff10b5One>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-10-01</value></transactionDate>
      <transactionCoding><transactionFormType>4</transactionFormType><transactionCode>S</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>10000</value></transactionShares>
        <transactionPricePerShare><value>250.5</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <postTransactionAmounts><sharesOwnedFollowingTransaction><value>3280000</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-10-01</value></transactionDate>
      <transactionCoding><transactionCode>M</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>5000</value></transactionShares>
        <transactionPricePerShare><value>0</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
  <footnotes><footnote id="F1">Weighted average price.</footnote></footnotes>
</ownershipDocument>`;

describe("parseForm4", () => {
  it("reads issuer, owner, role and each transaction", () => {
    const { issuerCik, trades } = parseForm4(XML);
    expect(issuerCik).toBe(320193);
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      owner: "Timothy D Cook", role: "Chief Executive Officer, Yönetim kurulu üyesi", date: "2026-10-01", code: "S",
      acquired: false, shares: 10000, price: 250.5, value: 2505000, owned_after: 3280000, plan: true,
    });
    expect(trades[1]).toMatchObject({ code: "M", acquired: true, value: null });
  });

  it("detects 10b5-1 plans from footnotes in older filings", () => {
    const old = XML.replace("<aff10b5One>1</aff10b5One>", "").replace("Weighted average price.", "Sold pursuant to a Rule 10b5-1 trading plan.");
    expect(parseForm4(old).trades[0].plan).toBe(true);
    expect(parseForm4(XML.replace("<aff10b5One>1</aff10b5One>", "")).trades[0].plan).toBe(false);
  });

  it("formats names and summarizes open-market trades", () => {
    expect(displayName("SMITH JOHN A")).toBe("John A Smith");
    expect(displayName("BERKSHIRE HATHAWAY INC")).toBe("Berkshire Hathaway Inc");
    const t = parseForm4(XML).trades;
    const buy = { ...t[0], owner: "X", code: "P", value: 1e6, plan: false };
    expect(summarize([...t, buy])).toMatchObject({ buyValue: 1e6, sellValue: 2505000, buyers: 1, sellers: 1, plannedSellShare: 1 });
  });
});
