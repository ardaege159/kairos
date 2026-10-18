"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatDate, formatMoney } from "@/lib/format";
import { AXIS, GRID, SERIES } from "@/components/stocks/chart-theme";

type Point = { date: string; value: number; invested: number };

function ValueTooltip({ active, payload }: TooltipContentProps) {
  const p = payload?.[0]?.payload as Point | undefined;
  if (!active || !p) return null;
  const pnl = p.value - p.invested;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-white/95 px-3 py-2 text-sm shadow-lg num">
      <p className="text-xs text-ink-muted">{formatDate(p.date)}</p>
      <p className="font-semibold">Değer {formatMoney(p.value)}</p>
      <p className="text-ink-muted">Yatırılan {formatMoney(p.invested)}</p>
      <p className={pnl >= 0 ? "text-gain" : "text-loss"}>{pnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pnl))}</p>
    </div>
  );
}

export function ValueChart({ points }: { points: Point[] }) {
  if (points.length < 2) return <p className="text-sm text-ink-muted">Grafik için en az iki işlem günü gerekiyor; yeni eklenen pozisyonlar yarından itibaren çizilir.</p>;
  return (
    <div className="h-64" role="img" aria-label="Portföy değeri ve yatırılan tutar">
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
          <YAxis tickFormatter={(v: number) => formatMoney(v).replace(" $", "")} tickLine={false} axisLine={false} width={64} tick={AXIS} domain={["auto", "auto"]} />
          <Tooltip content={ValueTooltip} cursor={{ stroke: "#767586", strokeDasharray: "3 3" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#464554" }} />
          <Area type="linear" dataKey="value" name="Portföy değeri" stroke={SERIES[0]} strokeWidth={2} fill="url(#pfFill)" isAnimationActive={false} />
          <Line type="stepAfter" dataKey="invested" name="Yatırılan tutar" stroke="#767586" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
