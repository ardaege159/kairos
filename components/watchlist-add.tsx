"use client";

import { useTransition } from "react";
import { StockSearch } from "@/components/stock-search";
import { toggleWatch } from "@/app/(app)/watchlist-actions";

export function WatchlistAdd({ exclude }: { exclude: string[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex ${pending ? "opacity-60" : ""}`}>
      <StockSearch placeholder="İzleme listesine hisse ekle: kod veya şirket adı" exclude={exclude} onSelect={(t) => start(() => toggleWatch(t, true))} />
    </div>
  );
}
