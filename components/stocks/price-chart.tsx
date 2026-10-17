"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatDate, formatPercent, formatPrice } from "@/lib/format";
import { AXIS, GRID, SERIES } from "./chart-theme";

type Point = { date: string; close: number };
const RANGES = [
  { key: "1A", label: "1 ay", days: 31 },
  { key: "3A", label: "3 ay", days: 92 },
  { key: "6A", label: "6 ay", days: 183 },
  { key: "1Y", label: "1 yıl", days: 366 },
] as const;

function PriceTooltip({ active, payload }: TooltipContentProps) {
  const p = payload?.[0]?.payload as Point | undefined;
  if (!active || !p) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-white/95 px-3 py-2 text-sm shadow-lg num">
      <p className="text-xs text-ink-muted">{formatDate(p.date)}</p>
      <p className="font-semibold">{formatPrice(p.close)}</p>
    </div>
  );
}

export function PriceChart({ points }: { points: Point[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1Y");
  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const last = points.at(-1);
    if (!last) return [];
    const cutoff = new Date(Date.parse(`${last.date}T00:00:00Z`) - days * 864e5).toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoff);
  }, [points, range]);

  const change = data.length > 1 ? data.at(-1)!.close / data[0].close - 1 : null;

  return (
    <section className="glass-card p-5" aria-labelledby="price-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="price-title" className="font-semibold">Fiyat</h2>
          {change != null ? (
            <p className={`text-sm num ${change >= 0 ? "text-gain" : "text-loss"}`}>
              {formatPercent(change, true)} <span className="text-ink-muted">seçili dönemde</span>
            </p>
          ) : null}
        </div>
        <div role="group" aria-label="Dönem" className="flex rounded-[var(--radius-control)] bg-surface-container/70 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              aria-label={r.label}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${range === r.key ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>
      {data.length ? (
        <div className="h-64" role="img" aria-label={`Kapanış fiyatı, ${formatDate(data[0].date)} – ${formatDate(data.at(-1)!.date)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={48} tick={AXIS}
                tickFormatter={(d: string) => new Intl.DateTimeFormat("tr-TR", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))} />
              <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={56} tick={AXIS}
                tickFormatter={(v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} />
              <Tooltip content={PriceTooltip} cursor={{ stroke: "#767586", strokeDasharray: "3 3" }} />
              <Area type="linear" dataKey="close" stroke={SERIES[0]} strokeWidth={2} fill="url(#priceFill)" isAnimationActive={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Bu hisse için fiyat verisi yok.</p>
      )}
    </section>
  );
}
