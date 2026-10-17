import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StockTable, type StockListItem } from "@/components/stocks/stock-table";
import { listStocks } from "@/lib/data/stocks";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Hisseler" };

async function StockList() {
  const stocks = await listStocks();
  const items: StockListItem[] = stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    price: s.price,
    change_1d: s.change_1d,
    market_cap: s.metrics.market_cap ?? null,
    pe: s.metrics.pe ?? null,
    pb: s.metrics.pb ?? null,
    return_1y: s.metrics.return_1y ?? null,
    score: s.score,
  }));
  const sectors = [...new Set(stocks.map((s) => s.sector))].sort((a, b) => a.localeCompare(b));
  const asOf = stocks.map((s) => s.as_of).filter(Boolean).sort().at(-1);
  return (
    <>
      {asOf ? <p className="-mt-4 mb-4 text-xs text-ink-muted">Fiyatlar {formatDate(asOf)} kapanışı.</p> : null}
      <StockTable stocks={items} sectors={sectors} />
    </>
  );
}

export default function HisselerPage() {
  return (
    <>
      <PageHeader
        title="Hisseler"
        description="S&P 500 şirketleri. Bir hisseye tıklayınca çeyreklik bilançoları ve sektör karşılaştırmasını görürsün."
      />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Hisseler yükleniyor" />}>
        <StockList />
      </Suspense>
    </>
  );
}
