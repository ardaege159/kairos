"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatPercent } from "@/lib/format";
import { AXIS, GRID, LOSS } from "@/components/stocks/chart-theme";

const GAIN = "var(--color-gain)";
type Row = { sector: string; value: number };

function ReturnTooltip({ active, payload }: TooltipContentProps) {
  const p = payload?.[0]?.payload as Row | undefined;
  if (!active || !p) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-elevated/95 px-3 py-2 text-sm shadow-lg num">
      <p className="text-xs text-ink-muted">{p.sector}</p>
      <p className="font-semibold">{formatPercent(p.value, true)}</p>
      <p className="text-xs text-ink-muted">Sektördeki hisselerin medyan getirisi</p>
    </div>
  );
}

/** Horizontal bars of each sector's median return; sign is shown by colour, arrow-free label and position. */
export function SectorReturnsChart({ rows }: { rows: Row[] }) {
  const data = [...rows].sort((a, b) => b.value - a.value);
  return (
    <div className="h-[22rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tickFormatter={(v: number) => formatPercent(v)} tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis type="category" dataKey="sector" width={140} tickLine={false} axisLine={false} tick={{ ...AXIS, fill: "var(--color-ink-muted)" }} />
          <ReferenceLine x={0} stroke="var(--color-outline)" />
          <Tooltip content={ReturnTooltip} cursor={{ fill: "rgb(70 72 212 / 0.06)" }} />
          <Bar dataKey="value" radius={4} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.sector} fill={d.value >= 0 ? GAIN : LOSS} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v) => formatPercent(Number(v), true)} style={{ fontSize: 12, fill: "var(--color-ink)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
