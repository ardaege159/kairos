import { Sparkles } from "lucide-react";
import { getAiSummary } from "@/lib/data/ai";
import type { SummaryInput } from "@/lib/ai/summary";

/** AI-written paragraph over the outlook's facts; renders nothing when no AI key is configured. */
export async function AiSummary({ input }: { input: SummaryInput }) {
  const s = await getAiSummary(input);
  if (!s) return null;
  return (
    <div className="mt-4 rounded-[var(--radius-control)] bg-primary-soft/40 p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
        <Sparkles size={14} aria-hidden /> Yapay zekâ özeti
      </p>
      <p className="text-sm leading-relaxed">{s.text}</p>
      <p className="mt-2 text-[11px] text-ink-muted">
        {s.model ?? "Model"} ile, yalnızca yukarıdaki verilerden yazıldı · {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(s.at))}. Hata yapabilir; rakamları aşağıdaki bölümlerden doğrula.
      </p>
    </div>
  );
}
