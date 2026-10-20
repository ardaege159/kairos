"use client";

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatDate, formatPercent } from "@/lib/format";
import { AXIS, GRID, SERIES } from "@/components/stocks/chart-theme";

/** A dashed series is a benchmark (e.g. a sector ETF); it carries its own neutral colour and label. */
type Series = { ticker: string; points: { date: string; close: number }[]; color?: string; dashed?: boolean; label?: string };
const DASHES = ["6 4", "2 3", "8 3 2 3", "1 4"];

function PerfTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-elevated/95 px-3 py-2 text-sm shadow-lg num">
      <p className="mb-1 text-xs text-ink-muted">{formatDate(String(label))}</p>
      {[...payload].sort((a, b) => Number(b.value) - Number(a.value)).map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="font-medium">{p.name}</span>
          <span className="ml-auto">{formatPercent(Number(p.value), true)}</span>
        </p>
      ))}
    </div>
  );
}

/** All series rebased to 0% on the first common date so different price levels share one axis. */
export function PerformanceChart({ series }: { series: Series[] }) {
  const data = useMemo(() => {
    const maps = series.map((s) => new Map(s.points.map((p) => [p.date, p.close])));
    const dates = series[0]?.points.map((p) => p.date).filter((d) => maps.every((m) => m.has(d))) ?? [];
    if (!dates.length) return [];
    const base = maps.map((m) => m.get(dates[0])!);
    return dates.map((date) => {
      const row: Record<string, number | string> = { date };
      series.forEach((s, i) => (row[s.ticker] = maps[i].get(date)! / base[i] - 1));
      return row;
    });
  }, [series]);

  if (!data.length) return <p className="text-sm text-ink-muted">Ortak fiyat verisi yok.</p>;
  return (
    <div className="h-72" role="img" aria-label={`Son 1 yıl getiri karşılaştırması: ${series.map((s) => s.ticker).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS}
            tickFormatter={(d: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))} />
          <YAxis tickFormatter={(v: number) => formatPercent(v, true)} tickLine={false} axisLine={false} width={56} tick={AXIS} />
          <ReferenceLine y={0} stroke="var(--color-outline)" />
          <Tooltip content={PerfTooltip} cursor={{ stroke: "var(--color-outline)", strokeDasharray: "3 3" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-muted)" }} />
          {series.map((s, i) => (
            <Line key={s.ticker} type="linear" dataKey={s.ticker} name={s.label ?? s.ticker} stroke={s.color ?? SERIES[i]}
              strokeWidth={s.dashed ? 1.5 : 2} strokeDasharray={s.dashed ? DASHES[i % DASHES.length] : undefined} dot={false}
              activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
