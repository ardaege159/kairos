// TEMPORARY: server-side timing of shared data readers (owner only). Remove after measuring.
import { NextResponse } from "next/server";
import { getOwner } from "@/lib/supabase/server";
import { getAllSectorStats, getStock, listSp500 } from "@/lib/data/stocks";
import { getMacro } from "@/lib/data/macro";
import { getEarnings, getEconCalendar, getNews } from "@/lib/data/news";
import { getFreshness } from "@/lib/data/freshness";
import { getSpendingThemes } from "@/lib/data/spending";
import { getHoldersOf } from "@/lib/data/investors";

export async function GET() {
  const t0 = Date.now();
  if (!(await getOwner())) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const out: Record<string, string> = { owner: `${Date.now() - t0}ms` };
  const time = async (k: string, f: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      const v = await f();
      out[k] = `${Date.now() - t}ms ${Math.round(JSON.stringify(v).length / 1024)}KB`;
    } catch (e) {
      out[k] = `${Date.now() - t}ms HATA ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`;
    }
  };
  for (let pass = 1; pass <= 2; pass++) {
    await time(`${pass} getStock`, () => getStock("AMZN"));
    await time(`${pass} listSp500`, () => listSp500());
    await time(`${pass} sectorStats`, () => getAllSectorStats());
    await time(`${pass} macro`, () => getMacro());
    await time(`${pass} news`, () => getNews({ kind: "global", limit: 30 }));
    await time(`${pass} econ`, () => getEconCalendar("2026-10-20", "2026-11-05"));
    await time(`${pass} earnings`, () => getEarnings("2026-10-20", "2026-11-05"));
    await time(`${pass} freshness`, () => getFreshness());
    await time(`${pass} themes`, () => getSpendingThemes());
    await time(`${pass} holders`, () => getHoldersOf("AMZN"));
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
