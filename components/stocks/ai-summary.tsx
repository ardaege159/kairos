import { getAiSummary } from "@/lib/data/ai";
import type { SummaryInput } from "@/lib/ai/summary";
import { AiSummaryView } from "@/components/stocks/ai-summary-view";

/** AI-written paragraph over the outlook's facts; renders nothing when no AI key is configured. */
export async function AiSummary({ input }: { input: SummaryInput }) {
  const s = await getAiSummary(input);
  if (!s) return null;
  return <AiSummaryView ticker={input.ticker} initial={s} />;
}
