"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { formatMoney, formatMultiple, formatPercent, formatPrice } from "@/lib/format";
import { METRIC_BY_KEY } from "@/lib/metrics/definitions";
import { sectorName } from "@/lib/sectors";

export type StockListItem = {
  ticker: string;
  name: string;
  sector: string;
  extra: boolean;
  price: number | null;
  change_1d: number | null;
  market_cap: number | null;
  pe: number | null;
  pb: number | null;
  return_1y: number | null;
  score: number | null;
};

type SortKey = "ticker" | "price" | "change_1d" | "market_cap" | "pe" | "pb" | "return_1y" | "score";

type Tip = { title: string; text: string; formula?: string };
const metricTip = (key: string): Tip => {
  const d = METRIC_BY_KEY[key];
  return { title: d.short ? `${d.short} (${d.label})` : d.label, text: d.meaning, formula: d.help };
};

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; tip?: Tip }[] = [
  { key: "ticker", label: "Hisse", align: "left" },
  { key: "price", label: "Fiyat", align: "right", tip: { title: "Fiyat", text: "Son işlem gününün kapanış fiyatı. Veriler en az 15 dakika gecikmelidir." } },
  { key: "change_1d", label: "Günlük", align: "right", tip: { title: "Günlük değişim", text: "Son kapanışın bir önceki işlem gününün kapanışına göre değişimi." } },
  { key: "market_cap", label: "Piyasa değeri", align: "right", tip: metricTip("market_cap") },
  { key: "pe", label: "F/K", align: "right", tip: metricTip("pe") },
  { key: "pb", label: "PD/DD", align: "right", tip: metricTip("pb") },
  { key: "return_1y", label: "1 yıl", align: "right", tip: metricTip("return_1y") },
  { key: "score", label: "Kairos Skoru", align: "right", tip: { title: "Kairos Skoru", text: "Hisseyi kendi sektöründeki S&P 500 şirketleriyle karşılaştıran 0–100 arası özet. 50 sektör ortalamasıdır. Ayrıntısı hisse sayfasında." } },
];

function Change({ v }: { v: number | null }) {
  if (v == null) return <span className="text-ink-muted">—</span>;
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? "text-gain" : "text-loss"}`}>
      {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
      {formatPercent(Math.abs(v))}
    </span>
  );
}

export function StockTable({ stocks, sectors, initialSector = "" }: { stocks: StockListItem[]; sectors: string[]; initialSector?: string }) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState(sectors.includes(initialSector) ? initialSector : "");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "market_cap", dir: -1 });

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const filtered = stocks.filter(
      (s) =>
        (!sector || s.sector === sector) &&
        (!q || s.ticker.toLocaleLowerCase("tr").includes(q) || s.name.toLocaleLowerCase("tr").includes(q)),
    );
    return filtered.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // empty values always last
      if (bv == null) return -1;
      return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
    });
  }, [stocks, query, sector, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "ticker" ? 1 : -1 }));

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-soft/50 p-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hisse kodu ya da şirket adı"
          aria-label="Hisse ara"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-outline-soft bg-white/70 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Sektör"
          className="rounded-[var(--radius-control)] border border-outline-soft bg-white/70 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Tüm sektörler</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {sectorName(s)}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-muted num">{rows.length} hisse</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-ink-muted">
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>
                  <span className="inline-flex items-center gap-0.5">
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                      {c.label}
                      {sort.key === c.key ? (sort.dir === 1 ? <ArrowUp size={12} aria-label="artan" /> : <ArrowDown size={12} aria-label="azalan" />) : null}
                    </button>
                    {c.tip ? (
                      <InfoTip title={c.tip.title} formula={c.tip.formula} align={c.key === "score" || c.key === "return_1y" ? "end" : "start"}>
                        {c.tip.text}
                      </InfoTip>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((s) => (
              <tr key={s.ticker} className="border-t border-outline-soft/40 hover:bg-white/50">
                <td className="px-4 py-2.5">
                  <Link href={`/hisseler/${s.ticker}`} className="group flex flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink group-hover:text-primary">{s.ticker}</span>
                      {s.extra ? <span className="rounded-full border border-outline-soft px-1.5 text-[10px] text-ink-muted">S&amp;P 500 dışı</span> : null}
                    </span>
                    <span className="max-w-[16rem] truncate text-xs text-ink-muted">{s.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right">{formatPrice(s.price)}</td>
                <td className="px-4 py-2.5 text-right"><Change v={s.change_1d} /></td>
                <td className="px-4 py-2.5 text-right">{formatMoney(s.market_cap)}</td>
                <td className="px-4 py-2.5 text-right">{formatMultiple(s.pe)}</td>
                <td className="px-4 py-2.5 text-right">{formatMultiple(s.pb)}</td>
                <td className="px-4 py-2.5 text-right"><Change v={s.return_1y} /></td>
                <td className="px-4 py-2.5 text-right font-semibold">{s.score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-ink-muted">Aramana uyan hisse yok. Filtreyi temizleyip tekrar dene.</p> : null}
      </div>
    </div>
  );
}
