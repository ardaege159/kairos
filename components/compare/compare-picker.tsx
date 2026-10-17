"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { StockSearch } from "@/components/stock-search";
import { SERIES } from "@/components/stocks/chart-theme";
import { TickerLogo } from "@/components/ticker-logo";
import { MAX_COMPARE } from "@/lib/compare";

export function ComparePicker({ selected }: { selected: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (tickers: string[]) => start(() => router.push(tickers.length ? `/karsilastir?h=${tickers.join(",")}` : "/karsilastir"));

  return (
    <div className={`glass-card p-4 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-2 rounded-full border border-outline-soft bg-white/70 py-1 pr-1 pl-3 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
            <TickerLogo ticker={t} size={20} />
            {t}
            <button
              type="button"
              onClick={() => go(selected.filter((x) => x !== t))}
              aria-label={`${t} karşılaştırmadan çıkar`}
              className="rounded-full p-1 text-ink-muted hover:bg-surface-container hover:text-ink"
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        {selected.length < MAX_COMPARE ? (
          <div className="flex min-w-[16rem] flex-1">
            <StockSearch placeholder="Karşılaştırmaya hisse ya da ETF ekle" exclude={selected} onSelect={(t) => go([...selected, t])} />
          </div>
        ) : (
          <p className="text-sm text-ink-muted">En fazla {MAX_COMPARE} hisse. Yenisini eklemek için birini çıkar.</p>
        )}
      </div>
    </div>
  );
}
