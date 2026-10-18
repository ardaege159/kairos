import { Clock } from "lucide-react";
import { timeAgo } from "@/components/news/news-list";
import { getFreshness } from "@/lib/data/freshness";
import { requestTime } from "@/lib/data/news";

const STALE_HOURS = 36;

/** "Fiyatlar 3 saat önce güncellendi" with every group's last successful load in the tooltip. */
export async function FreshnessBadge() {
  const [groups, now] = await Promise.all([getFreshness(), requestTime()]);
  const prices = groups.find((g) => g.key === "prices");
  if (!prices) return null;
  const stale = !prices.at || now - Date.parse(prices.at) > STALE_HOURS * 3600_000;
  const detail = groups.map((g) => `${g.label}: ${g.at ? timeAgo(g.at, now) : "hiç yüklenmedi"}`).join("\n");
  return (
    <p
      title={`Son başarılı veri yüklemeleri\n${detail}`}
      className={`flex shrink-0 items-center gap-1.5 text-xs ${stale ? "text-loss" : "text-ink-muted"}`}
    >
      <Clock size={13} aria-hidden />
      <span>
        Veriler {prices.at ? `${timeAgo(prices.at, now)} güncellendi` : "henüz yüklenmedi"}
        {stale ? " · güncelleme gerekli (npm run veri:fiyat)" : ""}
      </span>
      <span className="sr-only">. {detail.replaceAll("\n", ", ")}</span>
    </p>
  );
}
