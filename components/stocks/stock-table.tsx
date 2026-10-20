"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { TickerLogo } from "@/components/ticker-logo";
import { WatchButton } from "@/components/watch-button";
import { formatMoney, formatMultiple, formatPercent, formatPrice } from "@/lib/format";
import { METRIC_BY_KEY } from "@/lib/metrics/definitions";
import { ETF_CATEGORIES, classifyEtf } from "@/lib/etf";
import { sectorName } from "@/lib/sectors";

export type StockListItem = {
  ticker: string;
  name: string;
  asset_type: "stock" | "etf";
  in_sp500: boolean;
  price: number | null;
  change_1d: number | null;
  market_cap: number | null;
  pe: number | null;
  pb: number | null;
  return_1y: number | null;
  score: number | null;
  dollar_volume: number | null;
  watched?: boolean;
};

type SortKey = "ticker" | "price" | "change_1d" | "market_cap" | "pe" | "pb" | "return_1y" | "score" | "dollar_volume";
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
  { key: "dollar_volume", label: "Hacim", align: "right", tip: metricTip("dollar_volume") },
  { key: "pe", label: "F/K", align: "right", tip: metricTip("pe") },
  { key: "pb", label: "PD/DD", align: "right", tip: metricTip("pb") },
  { key: "return_1y", label: "1 yıl", align: "right", tip: metricTip("return_1y") },
  { key: "score", label: "Kairos Skoru", align: "right", tip: { title: "Kairos Skoru", text: "Hisseyi kendi sektöründeki S&P 500 şirketleriyle karşılaştıran 0–100 arası özet. 50 sektör ortalamasıdır. ETF'lerde hesaplanmaz." } },
];

const UNIVERSES = [
  { key: "tumu", label: "Tümü" },
  { key: "sp500", label: "S&P 500" },
  { key: "hisse", label: "Hisseler" },
  { key: "etf", label: "ETF'ler" },
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

/** Server-paginated list; every control writes to the URL so the server renders the next page. */
export function StockTable({
  rows,
  total,
  page,
  pageSize,
  sectors,
  sort,
  dir,
}: {
  rows: StockListItem[];
  total: number;
  page: number;
  pageSize: number;
  sectors: string[];
  sort: SortKey;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("sayfa" in changes)) next.delete("sayfa");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search-as-you-type.
  useEffect(() => {
    if ((params.get("q") ?? "") === query) return;
    const t = setTimeout(() => update({ q: query.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should trigger this
  }, [query]);

  const toggle = (key: SortKey) => {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "ticker" ? "asc" : "desc";
    update({ sirala: key, yon: nextDir });
  };

  // ETFs have no market cap, ratios or score: hide those columns in the ETF view.
  const etfView = params.get("evren") === "etf";
  const hidden = new Set<SortKey>(etfView ? ["market_cap", "pe", "pb", "score"] : []);
  const columns = COLUMNS.filter((c) => !hidden.has(c.key));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={`glass-card overflow-hidden transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-soft/50 p-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hisse kodu ya da şirket adı"
          aria-label="Listede ara"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-outline-soft bg-elevated/70 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div role="group" aria-label="Kapsam" className="flex rounded-[var(--radius-control)] bg-surface-container/70 p-1">
          {UNIVERSES.map((u) => {
            const activeU = (params.get("evren") ?? "tumu") === u.key;
            return (
              <button
                key={u.key}
                type="button"
                aria-pressed={activeU}
                onClick={() => update({ evren: u.key === "tumu" ? null : u.key, tur: null, ...(u.key === "etf" ? { sirala: "dollar_volume", yon: "desc" } : {}) })}
                className={`rounded-md px-3 py-1 text-xs font-medium ${activeU ? "bg-elevated text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {u.label}
              </button>
            );
          })}
        </div>
        <select
          value={params.get("sektor") ?? ""}
          onChange={(e) => update({ sektor: e.target.value || null })}
          aria-label="Sektör"
          className="rounded-[var(--radius-control)] border border-outline-soft bg-elevated/70 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Tüm sektörler</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {sectorName(s)}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-muted num">{total.toLocaleString("tr-TR")} sonuç</span>
      </div>
      {params.get("evren") === "etf" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-soft/50 px-4 py-3" role="group" aria-label="ETF türü">
          {[{ key: "", label: "Tüm türler", help: "" }, ...ETF_CATEGORIES, { key: "diger", label: "Diğer", help: "Adından türü anlaşılamayan ETF'ler." }].map((c) => {
            const active = (params.get("tur") ?? "") === c.key;
            return (
              <span key={c.key || "all"} className="inline-flex items-center">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ tur: c.key || null })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-primary text-white" : "bg-elevated/60 text-ink-muted hover:text-ink"}`}
                >
                  {c.label}
                </button>
                {c.help ? <InfoTip title={c.label}>{c.help}</InfoTip> : null}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-ink-muted">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                  <span className="inline-flex items-center gap-0.5">
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                      {c.label}
                      {sort === c.key ? (dir === "asc" ? <ArrowUp size={12} aria-label="artan" /> : <ArrowDown size={12} aria-label="azalan" />) : null}
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
              <tr key={s.ticker} className="border-t border-outline-soft/40 hover:bg-elevated/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <WatchButton ticker={s.ticker} watched={!!s.watched} compact />
                    <Link href={`/hisseler/${s.ticker}`} className="group flex items-center gap-3">
                      <TickerLogo ticker={s.ticker} size={30} etf={s.asset_type === "etf"} />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink group-hover:text-primary">{s.ticker}</span>
                          {s.asset_type === "etf" ? (
                            <span className="rounded-full border border-outline-soft px-1.5 text-[10px] text-ink-muted">
                              ETF{classifyEtf(s.name) ? ` · ${classifyEtf(s.name)!.label}` : ""}
                            </span>
                          ) : null}
                        </span>
                        <span className="max-w-[18rem] truncate text-xs text-ink-muted">{s.name}</span>
                      </span>
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatPrice(s.price)}</td>
                <td className="px-4 py-2.5 text-right"><Change v={s.change_1d} /></td>
                {!etfView ? <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatMoney(s.market_cap)}</td> : null}
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-ink-muted">{formatMoney(s.dollar_volume)}</td>
                {!etfView ? <td className="px-4 py-2.5 text-right">{formatMultiple(s.pe)}</td> : null}
                {!etfView ? <td className="px-4 py-2.5 text-right">{formatMultiple(s.pb)}</td> : null}
                <td className="px-4 py-2.5 text-right"><Change v={s.return_1y} /></td>
                {!etfView ? <td className="px-4 py-2.5 text-right font-semibold">{s.score ?? "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-ink-muted">Aramana uyan hisse yok. Filtreleri temizleyip tekrar dene.</p> : null}
      </div>
      <div className="flex items-center justify-between border-t border-outline-soft/50 px-4 py-3 text-sm">
        <span className="text-ink-muted num">
          {from.toLocaleString("tr-TR")}–{to.toLocaleString("tr-TR")} / {total.toLocaleString("tr-TR")}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => update({ sayfa: String(page - 1) })}
            className="inline-flex items-center gap-1 rounded-[var(--radius-control)] px-3 py-1.5 text-ink-muted hover:bg-elevated/70 hover:text-ink disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden /> Önceki
          </button>
          <span className="num text-ink-muted">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => update({ sayfa: String(page + 1) })}
            className="inline-flex items-center gap-1 rounded-[var(--radius-control)] px-3 py-1.5 text-ink-muted hover:bg-elevated/70 hover:text-ink disabled:opacity-40"
          >
            Sonraki <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
