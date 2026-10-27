import { NextResponse, type NextRequest } from "next/server";
import { getPrices, getStock } from "@/lib/data/stocks";

/** Closing price on a date (or the last trading day before it), for prefilling purchase prices. */
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t")?.toUpperCase() ?? "";
  const d = request.nextUrl.searchParams.get("d") ?? "";
  if (!/^[A-Z0-9.\-]{1,10}$/.test(t) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  const stock = await getStock(t);
  if (!stock) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  const series = await getPrices(stock.ticker, stock.core);
  const hit = [...series].reverse().find((p) => p.date <= d);
  return NextResponse.json({ date: hit?.date ?? null, close: hit?.close ?? null });
}
