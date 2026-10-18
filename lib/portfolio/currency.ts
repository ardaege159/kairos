// Portfolio maths in Turkish lira and against an index. Pure (tested).
import type { Position, Series } from "./analytics.ts";

/** Rate on `date`, or the last one before it (weekends, holidays). `rates` sorted ascending. */
export function rateOn(rates: Series, date: string): number | null {
  let lo = 0, hi = rates.length - 1, hit: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rates[mid].date <= date) { hit = rates[mid].close; lo = mid + 1; } else hi = mid - 1;
  }
  return hit ?? rates[0]?.close ?? null;
}

/**
 * Lira P/L split in two: what the stocks earned (dollar gain at today's rate) and what the currency
 * added (each purchase's dollar cost revalued from its buy-date rate to today's).
 */
export function tryBreakdown(positions: Position[], prices: Record<string, number | null>, rates: Series, today: string) {
  const now = rateOn(rates, today);
  if (now == null || !positions.length) return null;
  let costUsd = 0, valueUsd = 0, costTry = 0;
  for (const p of positions) {
    const cost = p.shares * p.buy_price;
    costUsd += cost;
    valueUsd += p.shares * (prices[p.ticker] ?? p.buy_price);
    costTry += cost * (rateOn(rates, p.buy_date) ?? now);
  }
  const valueTry = valueUsd * now;
  return {
    rate: now, costTry, valueTry, pnlTry: valueTry - costTry, pnlPct: costTry ? valueTry / costTry - 1 : null,
    fromStocks: (valueUsd - costUsd) * now, fromCurrency: costUsd * now - costTry,
  };
}

/** Value history converted to lira: value at each day's rate, invested at each purchase's rate. */
export function historyInTry(positions: Position[], history: { date: string; value: number; invested: number }[], rates: Series) {
  return history.map((h) => {
    const r = rateOn(rates, h.date) ?? 0;
    const invested = positions.filter((p) => p.buy_date <= h.date).reduce((s, p) => s + p.shares * p.buy_price * (rateOn(rates, p.buy_date) ?? r), 0);
    return { date: h.date, value: h.value * r, invested };
  });
}

/** What the same purchases, on the same days, would be worth had they bought the benchmark (e.g. SPY). */
export function benchmarkHistory(positions: Position[], dates: string[], bench: Series): (number | null)[] {
  const units = positions.map((p) => {
    const c = rateOn(bench, p.buy_date);
    return { date: p.buy_date, units: c ? (p.shares * p.buy_price) / c : 0 };
  });
  return dates.map((d) => {
    const c = rateOn(bench, d);
    if (c == null) return null;
    return units.filter((u) => u.date <= d).reduce((s, u) => s + u.units * c, 0);
  });
}
