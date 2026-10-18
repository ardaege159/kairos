// Portfolio maths: P/L, value history and a rule-based risk assessment. Pure functions (tested).

export type Position = { id?: string; ticker: string; shares: number; buy_price: number; buy_date: string };
export type Series = { date: string; close: number }[];
export type Holding = Position & { price: number | null; cost: number; value: number | null; pnl: number | null; pnlPct: number | null; weight: number };
export type AssetInfo = { sector: string | null; asset_type: "stock" | "etf"; speculative: boolean };

export function holdings(positions: Position[], prices: Record<string, number | null>): { rows: Holding[]; cost: number; value: number; pnl: number; pnlPct: number | null } {
  const rows = positions.map((p) => {
    const price = prices[p.ticker] ?? null;
    const cost = p.shares * p.buy_price;
    const value = price != null ? p.shares * price : null;
    return { ...p, price, cost, value, pnl: value != null ? value - cost : null, pnlPct: value != null ? value / cost - 1 : null, weight: 0 };
  });
  const value = rows.reduce((s, r) => s + (r.value ?? r.cost), 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  for (const r of rows) r.weight = value ? (r.value ?? r.cost) / value : 0;
  return { rows, cost, value, pnl: value - cost, pnlPct: cost ? value / cost - 1 : null };
}

/** Daily portfolio value and invested amount since the first purchase (positions count from their buy date). */
export function valueHistory(positions: Position[], series: Record<string, Series>): { date: string; value: number; invested: number }[] {
  if (!positions.length) return [];
  const start = positions.map((p) => p.buy_date).sort()[0];
  const dates = [...new Set(Object.values(series).flat().map((x) => x.date))].filter((d) => d >= start).sort();
  const lookup = Object.fromEntries(Object.entries(series).map(([t, s]) => [t, new Map(s.map((x) => [x.date, x.close]))]));
  const last: Record<string, number> = {};
  return dates.map((date) => {
    let value = 0, invested = 0;
    for (const p of positions) {
      const c = lookup[p.ticker]?.get(date);
      if (c != null) last[p.ticker] = c;
      if (p.buy_date > date) continue;
      invested += p.shares * p.buy_price;
      value += p.shares * (last[p.ticker] ?? p.buy_price);
    }
    return { date, value, invested };
  });
}

/** Daily returns of a constant-weight mix of the given series over their common dates. */
export function weightedReturns(weights: Record<string, number>, series: Record<string, Series>): { date: string; r: number }[] {
  const tickers = Object.keys(weights).filter((t) => (series[t]?.length ?? 0) > 1);
  if (!tickers.length) return [];
  const maps = tickers.map((t) => new Map(series[t].map((x) => [x.date, x.close])));
  const dates = series[tickers[0]].map((x) => x.date).filter((d) => maps.every((m) => m.has(d))).sort();
  const total = tickers.reduce((s, t) => s + weights[t], 0);
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < dates.length; i++) {
    let r = 0;
    tickers.forEach((t, k) => (r += (weights[t] / total) * (maps[k].get(dates[i])! / maps[k].get(dates[i - 1])! - 1)));
    out.push({ date: dates[i], r });
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export function annualVol(rs: number[]): number | null {
  if (rs.length < 20) return null;
  const m = mean(rs);
  return Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / (rs.length - 1)) * Math.sqrt(252);
}
export function maxDrawdown(rs: number[]): number | null {
  if (!rs.length) return null;
  let v = 1, peak = 1, dd = 0;
  for (const r of rs) { v *= 1 + r; peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); }
  return dd;
}
export function beta(rs: { date: string; r: number }[], bench: { date: string; r: number }[]): number | null {
  const b = new Map(bench.map((x) => [x.date, x.r]));
  const pairs = rs.filter((x) => b.has(x.date)).map((x) => [x.r, b.get(x.date)!] as const);
  if (pairs.length < 20) return null;
  const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1]));
  const cov = pairs.reduce((s, [a, c]) => s + (a - mx) * (c - my), 0);
  const varB = pairs.reduce((s, [, c]) => s + (c - my) ** 2, 0);
  return varB ? cov / varB : null;
}

export type RiskLevel = "low" | "medium" | "high";
export const RISK_LABEL: Record<RiskLevel, string> = { low: "Düşük risk", medium: "Orta risk", high: "Yüksek risk" };
export type RiskReport = {
  level: RiskLevel; points: number;
  vol: number | null; drawdown: number | null; beta: number | null;
  maxWeight: number; effectiveHoldings: number; maxSector: { sector: string; weight: number } | null; speculativeShare: number;
  reasons: { text: string; tone: "positive" | "negative" | "neutral" }[];
};

/** Rule-based risk level: volatility sets the base, concentration and speculative assets push it up. */
export function assessRisk(input: { weights: Record<string, number>; series: Record<string, Series>; benchmark: Series; info: Record<string, AssetInfo> }): RiskReport {
  const { weights, info } = input;
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const w = Object.fromEntries(Object.entries(weights).map(([t, v]) => [t, v / total]));
  const rs = weightedReturns(w, input.series);
  const bench = weightedReturns({ SPY: 1 }, { SPY: input.benchmark });
  const vol = annualVol(rs.map((x) => x.r));
  const drawdown = maxDrawdown(rs.map((x) => x.r));
  const b = beta(rs, bench);
  const maxWeight = Math.max(0, ...Object.values(w));
  const hhi = Object.values(w).reduce((s, x) => s + x * x, 0);
  const effectiveHoldings = hhi ? 1 / hhi : 0;
  const sectors: Record<string, number> = {};
  for (const [t, x] of Object.entries(w)) {
    const key = info[t]?.asset_type === "etf" ? "ETF" : info[t]?.sector ?? "Bilinmiyor";
    sectors[key] = (sectors[key] ?? 0) + x;
  }
  const topSector = Object.entries(sectors).sort((a, c) => c[1] - a[1])[0];
  const speculativeShare = Object.entries(w).reduce((s, [t, x]) => s + (info[t]?.speculative ? x : 0), 0);

  const reasons: RiskReport["reasons"] = [];
  let points = 0;
  if (vol != null) {
    const v = `%${Math.round(vol * 100)}`;
    if (vol < 0.15) reasons.push({ tone: "positive", text: `Yıllık oynaklık ${v}: S&P 500'ün tipik seviyesinin (yaklaşık %15-20) altında.` });
    else if (vol < 0.25) { points += 1; reasons.push({ tone: "neutral", text: `Yıllık oynaklık ${v}: piyasa ortalamasına yakın.` }); }
    else { points += 2; reasons.push({ tone: "negative", text: `Yıllık oynaklık ${v}: piyasanın belirgin şekilde üstünde; kısa sürede büyük değer kaybı yaşanabilir.` }); }
  } else {
    points += 1;
    reasons.push({ tone: "neutral", text: "Oynaklığı hesaplamak için yeterli fiyat geçmişi yok." });
  }
  if (drawdown != null && drawdown < -0.25) { points += 1; reasons.push({ tone: "negative", text: `Son bir yılda zirveden en derin düşüş %${Math.round(-drawdown * 100)} olurdu.` }); }
  if (b != null && b > 1.3) { points += 1; reasons.push({ tone: "negative", text: `Beta ${b.toFixed(2)}: piyasa %1 hareket ettiğinde portföy ortalama %${b.toFixed(1)} hareket ediyor.` }); }
  else if (b != null && b < 0.8) reasons.push({ tone: "positive", text: `Beta ${b.toFixed(2)}: piyasa düşüşlerinden daha az etkileniyor.` });
  if (maxWeight > 0.4) { points += 1; reasons.push({ tone: "negative", text: `Tek bir varlık portföyün %${Math.round(maxWeight * 100)}'i: o varlıktaki sorun tüm portföyü etkiler.` }); }
  if (effectiveHoldings < 5) { points += 1; reasons.push({ tone: "negative", text: `Ağırlıklara göre etkin olarak yalnızca ${effectiveHoldings.toFixed(1)} varlığa yayılmış; çeşitlendirme düşük.` }); }
  else if (effectiveHoldings >= 10) reasons.push({ tone: "positive", text: `Etkin olarak ${Math.round(effectiveHoldings)} varlığa yayılmış; iyi çeşitlendirilmiş.` });
  if (topSector && topSector[0] !== "ETF" && topSector[1] > 0.5) { points += 1; reasons.push({ tone: "negative", text: `Portföyün %${Math.round(topSector[1] * 100)}'i tek sektörde; sektöre özgü bir şok tüm portföyü etkiler.` }); }
  if (speculativeShare > 0.2) { points += 2; reasons.push({ tone: "negative", text: `%${Math.round(speculativeShare * 100)}'i kaldıraçlı/kripto ETF ya da zarar eden şirketlerde.` }); }
  else if (speculativeShare > 0) reasons.push({ tone: "neutral", text: `%${Math.round(speculativeShare * 100)}'i spekülatif varlıklarda (kaldıraçlı/kripto ETF ya da zarar eden şirket).` });

  // "Low" only when nothing raised a flag; market-like volatility alone already means medium.
  const level: RiskLevel = points === 0 ? "low" : points <= 3 ? "medium" : "high";
  return { level, points, vol, drawdown, beta: b, maxWeight, effectiveHoldings, maxSector: topSector ? { sector: topSector[0], weight: topSector[1] } : null, speculativeShare, reasons };
}
