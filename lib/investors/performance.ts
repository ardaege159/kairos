// 13F-implied performance: each quarter's return is what the manager's quarter-start positions earned
// by the next quarter end (no trades in between, no dividends or fees). Prices come from the filings
// themselves: the median reported value per share across all filers of a CUSIP at a quarter end.
// Pure (tested).

export type Holdings = Map<string, number>;          // cusip -> reported value ($)
export type PriceTable = Map<string, number>;        // cusip -> price at a quarter end

/** Median of collected value/share samples per CUSIP (needs at least `min` filers to trust it). */
export function medianPrices(samples: Map<string, number[]>, min = 2): PriceTable {
  const out: PriceTable = new Map();
  for (const [cusip, xs] of samples) {
    if (xs.length < min) continue;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    out.set(cusip, s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
  }
  return out;
}

/**
 * Return from one quarter end to the next. Positions without a price at both ends are dropped and the
 * rest re-weighted; `coverage` is the share of start value that could be priced.
 */
export function quarterReturn(start: Holdings, p0: PriceTable, p1: PriceTable): { r: number; coverage: number } | null {
  let total = 0, priced = 0, acc = 0;
  for (const [cusip, value] of start) {
    total += value;
    const a = p0.get(cusip), b = p1.get(cusip);
    if (a == null || b == null || a <= 0) continue;
    priced += value;
    acc += value * (b / a - 1);
  }
  if (!total || !priced) return null;
  return { r: acc / priced, coverage: priced / total };
}

export type Track = { returns: number[]; bench: number[] };

/** Annualized growth, volatility, worst peak-to-trough fall and quarters ahead of the benchmark. */
export function trackStats({ returns, bench }: Track) {
  const n = returns.length;
  const grow = (rs: number[]) => rs.reduce((v, r) => v * (1 + r), 1);
  const ann = (rs: number[]) => (rs.length ? grow(rs) ** (4 / rs.length) - 1 : null);
  const mean = n ? returns.reduce((a, b) => a + b, 0) / n : 0;
  const vol = n > 1 ? Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)) * 2 : null; // quarterly -> annual
  let v = 1, peak = 1, dd = 0;
  for (const r of returns) { v *= 1 + r; peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); }
  const a = ann(returns), b = ann(bench);
  return {
    quarters: n, total: grow(returns) - 1, benchTotal: grow(bench) - 1,
    annual: a, benchAnnual: b, excess: a != null && b != null ? a - b : null,
    vol, maxDrawdown: dd, beat: returns.filter((r, i) => r > (bench[i] ?? 0)).length,
  };
}

export type Candidate = { totalValue: number; positions: number; maxWeight: number; fundShare: number; quarters: number; coverage: number };

/**
 * Small, concentrated stock pickers with a full record: $100M–$3B, 5–40 stock positions, no single
 * position above 40% (not a holding company), mostly individual stocks rather than funds/ETFs, and
 * well-priced returns for (nearly) every quarter.
 */
export function isSmallStockPicker(c: Candidate, needQuarters: number): boolean {
  return c.totalValue >= 100e6 && c.totalValue <= 3e9 && c.positions >= 5 && c.positions <= 40 && c.maxWeight <= 0.4
    && c.fundShare <= 0.2 && c.quarters >= needQuarters && c.coverage >= 0.85;
}
