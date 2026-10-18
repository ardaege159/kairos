"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { squarify } from "@/lib/treemap";
import { formatMoney, formatPercent } from "@/lib/format";
import { sectorName } from "@/lib/sectors";

export type HeatItem = { ticker: string; name: string; sector: string; cap: number; d1: number | null; m1: number | null; m3: number | null };

const PERIODS = [
  { key: "d1", label: "Günlük", range: 0.03 },
  { key: "m1", label: "1 ay", range: 0.1 },
  { key: "m3", label: "3 ay", range: 0.2 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

// Diverging scale: loss red -> neutral grey -> gain green, saturating at ±range.
const LOSS = [186, 26, 26], NEUTRAL = [120, 124, 140], GAIN = [0, 128, 84];
function color(v: number | null, range: number): string {
  if (v == null) return "rgb(200 202 210)";
  const t = Math.max(-1, Math.min(1, v / range));
  const to = t < 0 ? LOSS : GAIN, a = Math.abs(t);
  const c = NEUTRAL.map((n, i) => Math.round(n + (to[i] - n) * a));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

const HEADER = 18; // sector label strip

/** S&P 500 treemap: sectors, then companies sized by market cap and coloured by return. */
export function Heatmap({ items, height = 560 }: { items: HeatItem[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("d1");
  const [hover, setHover] = useState<HeatItem | null>(null);
  const range = PERIODS.find((p) => p.key === period)!.range;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = width < 640 ? Math.round(height * 1.4) : height;
  const layout = useMemo(() => {
    if (!width) return [];
    const bySector = new Map<string, HeatItem[]>();
    for (const it of items) bySector.set(it.sector, [...(bySector.get(it.sector) ?? []), it]);
    const sectors = [...bySector].map(([sector, list]) => ({ sector, list, cap: list.reduce((s, x) => s + x.cap, 0) }));
    return squarify(sectors, (s) => s.cap, { x: 0, y: 0, w: width, h }).map((s) => {
      const inner = { x: s.x + 1, y: s.y + HEADER, w: Math.max(0, s.w - 2), h: Math.max(0, s.h - HEADER - 1) };
      return { ...s, cells: squarify(s.item.list, (x) => x.cap, inner) };
    });
  }, [items, width, h]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Dönem" className="flex rounded-[var(--radius-control)] bg-surface-container/70 p-1 text-xs">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1 font-medium ${period === p.key ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted num" aria-hidden>
          <span>{formatPercent(-range, true)}</span>
          <span className="h-2.5 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${color(-range, range)}, ${color(0, range)}, ${color(range, range)})` }} />
          <span>{formatPercent(range, true)}</span>
        </div>
      </div>
      <div ref={box} className="relative w-full overflow-hidden rounded-[var(--radius-control)] bg-white/40" style={{ height: h }}
        onMouseLeave={() => setHover(null)}>
        {layout.map((s) => (
          <div key={s.item.sector}>
            <div className="absolute truncate px-1 text-[11px] font-semibold text-ink-muted" style={{ left: s.x, top: s.y + 2, width: s.w }}>
              {sectorName(s.item.sector)}
            </div>
            {s.cells.map((c) => {
              const v = c.item[period];
              const big = c.w > 46 && c.h > 30;
              return (
                <Link key={c.item.ticker} href={`/hisseler/${c.item.ticker}`}
                  aria-label={`${c.item.ticker} ${c.item.name}: ${formatPercent(v, true)}`}
                  onMouseEnter={() => setHover(c.item)} onFocus={() => setHover(c.item)}
                  className="absolute flex flex-col items-center justify-center overflow-hidden border border-white/70 text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary"
                  style={{ left: c.x, top: c.y, width: c.w, height: c.h, background: color(v, range) }}>
                  {big ? (
                    <>
                      <span className="font-semibold leading-tight" style={{ fontSize: Math.min(18, Math.max(10, c.w / 6)) }}>{c.item.ticker}</span>
                      <span className="leading-tight num" style={{ fontSize: Math.min(13, Math.max(9, c.w / 9)) }}>{formatPercent(v, true)}</span>
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 min-h-5 text-sm num" aria-live="polite">
        {hover ? (
          <>
            <span className="font-semibold">{hover.ticker}</span> <span className="text-ink-muted">{hover.name} · {formatMoney(hover.cap)}</span>
            {PERIODS.map((p) => (
              <span key={p.key} className={`ml-3 ${(hover[p.key] ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>{p.label} {formatPercent(hover[p.key], true)}</span>
            ))}
          </>
        ) : (
          <span className="text-ink-muted">Kutu büyüklüğü piyasa değerini, rengi seçilen dönemdeki fiyat değişimini gösterir. Ayrıntı için bir kutunun üstüne gel.</span>
        )}
      </p>
    </div>
  );
}
