import { NextResponse, type NextRequest } from "next/server";
import { suggestTickers } from "@/lib/data/stocks";

/** Typeahead suggestions for the stock search box. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 40) ?? "";
  const rows = await suggestTickers(q);
  return NextResponse.json(
    rows.map((r) => ({ ticker: r.ticker, name: r.name, asset_type: r.asset_type, price: r.price, change_1d: r.change_1d, in_sp500: r.in_sp500 })),
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
