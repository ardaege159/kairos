import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StockTable } from "@/components/stocks/stock-table";
import { PAGE_SIZE, SORT_KEYS, searchStocks, type SortKey, type Universe } from "@/lib/data/stocks";
import { getWatchlist } from "@/lib/data/watchlist";
import { SECTOR_TR, sectorName } from "@/lib/sectors";

export const metadata: Metadata = { title: "Hisseler" };

type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function StockList({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const sort = (SORT_KEYS as readonly string[]).includes(one(sp.sirala) ?? "") ? (one(sp.sirala) as SortKey) : "market_cap";
  const dir = one(sp.yon) === "asc" ? "asc" : one(sp.yon) === "desc" ? "desc" : sort === "ticker" ? "asc" : "desc";
  const universe = (["sp500", "hisse", "etf"] as const).find((u) => u === one(sp.evren)) ?? ("tumu" as Universe);
  const page = Math.max(1, Number(one(sp.sayfa)) || 1);
  const [{ rows, total }, watchlist] = await Promise.all([
    searchStocks({ q: one(sp.q), sector: one(sp.sektor), universe, sort, dir, page }),
    getWatchlist(),
  ]);
  const watched = new Set(watchlist);
  const sectors = Object.keys(SECTOR_TR).sort((a, b) => sectorName(a).localeCompare(sectorName(b), "tr"));
  return <StockTable rows={rows.map((r) => ({ ...r, watched: watched.has(r.ticker) }))} total={total} page={page} pageSize={PAGE_SIZE} sectors={sectors} sort={sort} dir={dir} />;
}

export default function HisselerPage({ searchParams }: PageProps<"/hisseler">) {
  return (
    <>
      <PageHeader
        title="Hisseler"
        description="Borsada işlem gören tüm ABD hisseleri ve ETF'ler. S&P 500 dışındaki şirketler de SEC'e bilanço verdikçe aynı ayrıntıda görünür; ETF'lerde yalnızca fiyat verisi vardır."
      />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Hisseler yükleniyor" />}>
        <StockList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
