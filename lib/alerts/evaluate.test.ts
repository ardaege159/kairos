import { describe, expect, it } from "vitest";
import { evaluateAlert, watchlistEvents, type Snapshot } from "./evaluate.ts";

const snap: Snapshot = { ticker: "ABC", name: "Abc Corp", price: 105, change_1d: -0.062, score: 72, as_of: "2026-10-16" };

describe("evaluateAlert", () => {
  it("fires price and score alerts once, daily-move alerts per day", () => {
    const above = evaluateAlert({ id: "1", ticker: "ABC", kind: "price_above", threshold: 100, note: "kâr al" }, snap);
    expect(above).toMatchObject({ oneShot: true, dedupe: "alert|1" });
    expect(above?.body).toContain("kâr al");
    expect(evaluateAlert({ id: "2", ticker: "ABC", kind: "price_below", threshold: 100, note: null }, snap)).toBeNull();
    const move = evaluateAlert({ id: "3", ticker: "ABC", kind: "move_abs", threshold: 5, note: null }, snap);
    expect(move).toMatchObject({ dedupe: "alert|3|2026-10-16" });
    expect(move?.title).toContain("düştü");
    expect(evaluateAlert({ id: "4", ticker: "ABC", kind: "move_abs", threshold: 7, note: null }, snap)).toBeNull();
    expect(evaluateAlert({ id: "5", ticker: "ABC", kind: "score_below", threshold: 75, note: null }, snap)?.oneShot).toBe(true);
    expect(evaluateAlert({ id: "6", ticker: "ABC", kind: "score_above", threshold: 75, note: null }, { ...snap, score: null })).toBeNull();
  });
});

describe("watchlistEvents", () => {
  it("notifies earnings within 3 days, big moves, insider buys and large contracts", () => {
    const ev = watchlistEvents({
      snapshot: snap, today: "2026-10-18",
      earnings: { report_date: "2026-10-20", time_of_day: "post-market" },
      insiderBuys: [{ id: "acc|0", owner: "Jane Doe", role: "CEO", value: 2e6, date: "2026-10-15" }],
      contracts: [{ id: "c1", amount: 80e6, agency: "Department of Defense", action_date: "2026-10-10", what: "MISSILE PARTS" }, { id: "c2", amount: 5e6, agency: null, action_date: "2026-10-10", what: null }],
    });
    expect(ev.map((e) => e.kind)).toEqual(["earnings", "move", "insider", "federal"]);
    expect(ev[0].title).toBe("ABC 2 gün sonra bilanço açıklıyor");
    expect(ev[3].dedupe).toBe("federal|c1");
  });

  it("stays quiet for distant earnings, small moves and stale prices", () => {
    expect(watchlistEvents({ snapshot: { ...snap, change_1d: 0.01 }, today: "2026-10-18", earnings: { report_date: "2026-11-30", time_of_day: null }, insiderBuys: [], contracts: [] })).toEqual([]);
    expect(watchlistEvents({ snapshot: { ...snap, as_of: "2026-09-01" }, today: "2026-10-18", earnings: null, insiderBuys: [], contracts: [] })).toEqual([]);
  });
});
