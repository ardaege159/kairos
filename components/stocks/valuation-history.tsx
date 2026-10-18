"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { AXIS, GRID, SERIES } from "@/components/stocks/chart-theme";
import { formatDate } from "@/lib/format";
import type { ValuationPoint } from "@/lib/metrics/history";

const METRICS = [
  { key: "pe", label: "F/K", name: "Fiyat/Kazanç" },
  { key: "ps", label: "F/S", name: "Fiyat/Satış" },
  { key: "pb", label: "PD/DD", name: "Piyasa değeri/Defter değeri" },
] as const;
type Key = (typeof METRICS)[number]["key"];

const x1 = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
function medianOf(vals: number[]) {
  if (vals.length < 3) return null;
  const s = [...vals].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** A multiple through time against its own median: is the stock cheap or expensive versus its own history? */
export function ValuationHistory({ points }: { points: ValuationPoint[] }) {
  const available = METRICS.filter((m) => points.filter((p) => p[m.key] != null).length >= 3);
  const [key, setKey] = useState<Key>(available[0]?.key ?? "pe");
  if (!available.length) return <p className="text-sm text-ink-muted">Değerleme geçmişi için yeterli çeyrek verisi yok.</p>;
  const m = available.find((a) => a.key === key) ?? available[0];
  const data = points.filter((p) => p[m.key] != null).map((p) => ({ date: p.date, v: p[m.key] as number }));
  const med = medianOf(data.map((d) => d.v));
  const now = data.at(-1)!.v;
  const diff = med ? now / med - 1 : null;

  const Tip = ({ active, payload }: TooltipContentProps) => {
    const p = payload?.[0]?.payload as { date: string; v: number } | undefined;
    if (!active || !p) return null;
    return (
      <div className="rounded-[var(--radius-control)] border border-outline-soft bg-white/95 px-3 py-2 text-sm shadow-lg num">
        <p className="text-xs text-ink-muted">{formatDate(p.date)}</p>
        <p className="font-semibold">{m.label} {x1(p.v)}</p>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Çarpan" className="flex rounded-[var(--radius-control)] bg-surface-container/70 p-1 text-xs">
          {available.map((a) => (
            <button key={a.key} type="button" aria-pressed={m.key === a.key} onClick={() => setKey(a.key)}
              className={`rounded-md px-3 py-1 font-medium ${m.key === a.key ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>{a.label}</button>
          ))}
        </div>
        {med != null && diff != null ? (
          <p className="text-sm">
            Bugün <b className="num">{x1(now)}</b>, dönem medyanı <span className="num">{x1(med)}</span>:{" "}
            <span className={Math.abs(diff) < 0.1 ? "text-ink-muted" : diff > 0 ? "text-loss" : "text-gain"}>
              kendi geçmişine göre {Math.abs(diff) < 0.1 ? "ortalama seviyede" : `%${Math.round(Math.abs(diff) * 100)} ${diff > 0 ? "daha pahalı" : "daha ucuz"}`}
            </span>
          </p>
        ) : null}
      </div>
      <div className="h-56" role="img" aria-label={`${m.name} geçmişi`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={40} tick={AXIS}
              tickFormatter={(d: string) => new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))} />
            <YAxis tickLine={false} axisLine={false} width={40} tick={AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => x1(v)} />
            <Tooltip content={Tip} cursor={{ stroke: "#767586", strokeDasharray: "3 3" }} />
            {med != null ? <ReferenceLine y={med} stroke="#767586" strokeDasharray="5 4" label={{ value: "medyan", position: "insideTopLeft", fill: "#464554", fontSize: 11 }} /> : null}
            <Line type="linear" dataKey="v" name={m.label} stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Her nokta bir çeyrek sonundaki fiyatın, o tarihte bilinen son 12 ay rakamlarına oranıdır; son nokta bugünkü fiyattır. Bir hisse kendi
        geçmişine göre ucuzsa bunun bir nedeni olabilir (büyümenin yavaşlaması gibi); tek başına alım işareti değildir.
      </p>
    </div>
  );
}
