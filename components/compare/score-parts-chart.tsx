"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { AXIS, GRID } from "@/components/stocks/chart-theme";

type Row = Record<string, number | string | null>;

function PartsTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-white/95 px-3 py-2 text-sm shadow-lg num">
      <p className="mb-1 text-xs text-ink-muted">{String(label)}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="font-medium">{p.name}</span>
          <span className="ml-auto">{p.value ?? "—"}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Kairos Score parts side by side: one group per part, one bar per stock (0–100, single axis).
 * Colours follow each stock's slot on the page, so a skipped ETF never repaints the others.
 */
export function ScorePartsChart({ series, rows }: { series: { ticker: string; color: string }[]; rows: Row[] }) {
  return (
    <div className="h-72" role="img" aria-label={`Kairos Skoru bölümleri: ${series.map((s) => s.ticker).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="part" tickLine={false} axisLine={false} tick={AXIS} interval={0} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={32} tick={AXIS} />
          <Tooltip content={PartsTooltip} cursor={{ fill: "rgb(70 72 212 / 0.06)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#464554" }} />
          {series.map((s) => (
            <Bar key={s.ticker} dataKey={s.ticker} name={s.ticker} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
