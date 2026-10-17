"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { SERIES } from "@/components/stocks/chart-theme";
import { MAX_COMPARE } from "@/lib/compare";

export function ComparePicker({ selected, options }: { selected: string[]; options: { ticker: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const go = (tickers: string[]) => start(() => router.push(tickers.length ? `/karsilastir?h=${tickers.join(",")}` : "/karsilastir"));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = value.trim().toUpperCase().split(" ")[0];
    if (!t) return;
    if (!options.some((o) => o.ticker === t)) return setError(`${t} listede yok. Hisse kodunu kontrol et ya da Hisseler sayfasından ara.`);
    if (selected.includes(t)) return setError(`${t} zaten karşılaştırmada.`);
    if (selected.length >= MAX_COMPARE) return setError(`En fazla ${MAX_COMPARE} hisse karşılaştırabilirsin. Önce birini çıkar.`);
    setError(null);
    setValue("");
    go([...selected, t]);
  };

  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-2 rounded-full border border-outline-soft bg-white/70 py-1 pr-1 pl-3 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
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
          <form onSubmit={add} className="flex min-w-[14rem] flex-1 items-center gap-2">
            <input
              list="compare-options"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Hisse ekle, ör. MSFT"
              aria-label="Karşılaştırmaya hisse ekle"
              className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-outline-soft bg-white/70 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <datalist id="compare-options">
              {options.map((o) => (
                <option key={o.ticker} value={o.ticker}>
                  {o.name}
                </option>
              ))}
            </datalist>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-gradient-to-r from-primary to-secondary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus size={16} aria-hidden /> Ekle
            </button>
          </form>
        ) : null}
      </div>
      {error ? <p role="status" className="mt-2 text-sm text-loss">{error}</p> : null}
    </div>
  );
}
