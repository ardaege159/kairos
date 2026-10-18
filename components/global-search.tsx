"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StockSearch } from "@/components/stock-search";

const INPUT_ID = "global-search";

/** Site-wide ticker search; Ctrl+K (or ⌘K, or "/") focuses it from anywhere. */
export function GlobalSearch() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        document.getElementById(INPUT_ID)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <StockSearch id={INPUT_ID} placeholder="Hisse ya da ETF ara (Ctrl+K)" onSelect={(t) => router.push(`/hisseler/${t}`)} />
    </div>
  );
}
