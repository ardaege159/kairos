"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { InfoTip } from "@/components/info-tip";
import { formatMoney, formatPercent, formatPeriod } from "@/lib/format";
import { AXIS, GRID, LOSS, SERIES } from "./chart-theme";

export type QuarterPoint = {
  period: string;
  revenue: number | null;
  net_income: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
};

const compactMoney = (v: number) => formatMoney(v).replace(" $", "");

function MoneyTooltip({ active, payload, label }: TooltipContentProps) {
  const v = payload?.[0]?.value;
  if (!active || v == null) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-white/95 px-3 py-2 text-sm shadow-lg num">
      <p className="text-xs text-ink-muted">{formatPeriod(String(label))}</p>
      <p className="font-semibold">{formatMoney(Number(v))}</p>
    </div>
  );
}

function MarginTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-outline-soft bg-white/95 px-3 py-2 text-sm shadow-lg num">
      <p className="mb-1 text-xs text-ink-muted">{formatPeriod(String(label))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-ink-muted">{p.name}</span>
          <span className="ml-auto font-semibold">{formatPercent(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function MoneyBars({ title, data, dataKey, color }: { title: string; data: QuarterPoint[]; dataKey: "revenue" | "net_income"; color: string }) {
  const points = data.filter((d) => d[dataKey] != null);
  return (
    <section className="glass-card p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {points.length ? (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" minTickGap={8} />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={64} tick={AXIS} />
              <ReferenceLine y={0} stroke="#767586" />
              <Tooltip content={MoneyTooltip} cursor={{ fill: "rgb(70 72 212 / 0.06)" }} />
              <Bar dataKey={dataKey} radius={[4, 4, 4, 4]} isAnimationActive={false}>
                {points.map((p) => (
                  <Cell key={p.period} fill={(p[dataKey] ?? 0) < 0 ? LOSS : color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Şirket bu kalemi SEC&apos;e raporlamıyor.</p>
      )}
    </section>
  );
}

const MARGINS = [
  { key: "gross_margin", name: "Brüt marj", color: SERIES[0] },
  { key: "operating_margin", name: "Faaliyet marjı", color: SERIES[1] },
  { key: "net_margin", name: "Net marj", color: SERIES[2] },
] as const;

export function QuarterCharts({ data }: { data: QuarterPoint[] }) {
  const margins = MARGINS.filter((m) => data.some((d) => d[m.key] != null));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MoneyBars title="Çeyreklik gelir" data={data} dataKey="revenue" color={SERIES[0]} />
      <MoneyBars title="Çeyreklik net kâr" data={data} dataKey="net_income" color={SERIES[0]} />
      <section className="glass-card p-5">
        <h3 className="mb-3 flex items-center gap-1 font-semibold">
          Marjlar
          <InfoTip title="Marjlar" align="end">
            Her 100 dolarlık satıştan kalan pay. Brüt marj üretim maliyetinden sonra, faaliyet marjı tüm işletme giderlerinden
            sonra, net marj faiz ve vergi dahil her şeyden sonra kalanı gösterir. Çizgilerin yükselmesi şirketin daha kârlı
            çalıştığını gösterir.
          </InfoTip>
        </h3>
        {margins.length ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" minTickGap={8} />
                <YAxis tickFormatter={(v: number) => formatPercent(v)} tickLine={false} axisLine={false} width={48} tick={AXIS} />
                <Tooltip content={MarginTooltip} cursor={{ stroke: "#767586", strokeDasharray: "3 3" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#464554" }} />
                {margins.map((m) => (
                  <Line key={m.key} type="linear" dataKey={m.key} name={m.name} stroke={m.color} strokeWidth={2} connectNulls
                    dot={{ r: 3, strokeWidth: 0, fill: m.color }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Marj hesaplamak için gelir verisi yok.</p>
        )}
      </section>
    </div>
  );
}
