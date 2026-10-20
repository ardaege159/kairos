"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatDate, formatMoney } from "@/lib/format";
import { AXIS, GRID, SERIES } from "@/components/stocks/chart-theme";

type Point = { date: string; value: number; invested: number; benchmark?: number | null };

function makeTooltip(symbol: "$" | "₺") {
  return function ValueTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as Point | undefined;
    if (!active || !p) return null;
    const pnl = p.value - p.invested;
    return (
      <div className="rounded-[var(--radius-control)] border border-outline-soft bg-elevated/95 px-3 py-2 text-sm shadow-lg num">
        <p className="text-xs text-ink-muted">{formatDate(p.date)}</p>
        <p className="font-semibold">Değer {formatMoney(p.value, symbol)}</p>
        <p className="text-ink-muted">Yatırılan {formatMoney(p.invested, symbol)}</p>
        <p className={pnl >= 0 ? "text-gain" : "text-loss"}>{pnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pnl), symbol)}</p>
        {p.benchmark != null ? <p className="text-ink-muted">SPY olsaydı {formatMoney(p.benchmark, symbol)}</p> : null}
      </div>
    );
  };
}

export function ValueChart({ points, symbol = "$" }: { points: Point[]; symbol?: "$" | "₺" }) {
  if (points.length < 2) return <p className="text-sm text-ink-muted">Grafik için en az iki işlem günü gerekiyor; yeni eklenen pozisyonlar yarından itibaren çizilir.</p>;
  const hasBench = points.some((p) => p.benchmark != null);
  return (
    <div className="h-64" role="img" aria-label="Portföy değeri, yatırılan tutar ve S&P 500 kıyası">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS}
            tickFormatter={(d: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))} />
          <YAxis tickFormatter={(v: number) => formatMoney(v, symbol).replace(` ${symbol}`, "")} tickLine={false} axisLine={false} width={64} tick={AXIS} domain={["auto", "auto"]} />
          <Tooltip content={makeTooltip(symbol)} cursor={{ stroke: "var(--color-outline)", strokeDasharray: "3 3" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-muted)" }} />
          <Area type="linear" dataKey="value" name="Portföy değeri" stroke={SERIES[0]} strokeWidth={2} fill="url(#pfFill)" isAnimationActive={false} />
          <Line type="stepAfter" dataKey="invested" name="Yatırılan tutar" stroke="var(--color-outline)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          {hasBench ? <Line type="linear" dataKey="benchmark" name="Aynı alımlar SPY olsaydı" stroke={SERIES[1]} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls /> : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
