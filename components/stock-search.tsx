"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { TickerLogo } from "@/components/ticker-logo";
import { formatPercent, formatPrice } from "@/lib/format";

export type Suggestion = {
  ticker: string;
  name: string;
  asset_type: "stock" | "etf";
  price: number | null;
  change_1d: number | null;
  in_sp500: boolean;
};

/**
 * Accessible combobox (ARIA 1.2 pattern) backed by /api/arama. Calls onSelect with the chosen
 * ticker; arrow keys move, Enter picks, Escape closes.
 */
export function StockSearch({
  onSelect,
  placeholder = "Hisse ya da ETF ara: kod veya şirket adı",
  exclude = [],
  autoFocus = false,
}: {
  onSelect: (ticker: string) => void;
  placeholder?: string;
  exclude?: string[];
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const excludeKey = exclude.join(","); // stable dependency even when callers pass a new array

  useEffect(() => {
    const term = query.trim();
    if (!term) return; // empty input shows nothing (see showList), no state reset needed
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/arama?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (r.ok) {
          const skip = new Set(excludeKey.split(","));
          const data = ((await r.json()) as Suggestion[]).filter((s) => !skip.has(s.ticker));
          setItems(data);
          setActive(0);
          setOpen(true);
        }
      } catch {
        // aborted by a newer keystroke
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, excludeKey]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const pick = (s: Suggestion) => {
    onSelect(s.ticker);
    setQuery("");
    setItems([]);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = items[active];
      if (open && s) pick(s);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length > 0;
  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline" aria-hidden />
      <input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && items[active] ? `${listId}-${items[active].ticker}` : undefined}
        aria-label={placeholder}
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-control)] border border-outline-soft bg-white/70 py-2 pr-3 pl-9 text-sm outline-none focus:border-primary focus:bg-white"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-30 mt-1 max-h-80 w-full overflow-auto rounded-[var(--radius-control)] border border-outline-soft bg-white py-1 shadow-[0_10px_30px_rgb(99_102_241/0.18)]"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{loading ? "Aranıyor…" : "Eşleşen hisse ya da ETF yok."}</li>
          ) : (
            items.map((s, i) => (
              <li
                key={s.ticker}
                id={`${listId}-${s.ticker}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === active ? "bg-primary-soft/60" : ""}`}
              >
                <TickerLogo ticker={s.ticker} size={24} />
                <span className="w-14 shrink-0 font-semibold">{s.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{s.name}</span>
                {s.asset_type === "etf" ? (
                  <span className="rounded-full border border-outline-soft px-1.5 text-[10px] text-ink-muted">ETF</span>
                ) : null}
                <span className="shrink-0 text-right num">
                  {formatPrice(s.price)}
                  {s.change_1d != null ? (
                    <span className={`ml-2 text-xs ${s.change_1d >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(s.change_1d, true)}</span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
