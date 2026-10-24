import { NextResponse, type NextRequest } from "next/server";
import { readAiSummary } from "@/lib/data/ai";

/** Latest stored AI summary for a ticker (owner only); polled by the stock page while a rewrite runs. */
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase().slice(0, 12) ?? "";
  const s = await readAiSummary(ticker);
  if (!s) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
}
