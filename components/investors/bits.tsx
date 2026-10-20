import { formatDate } from "@/lib/format";
import { CHANGE_LABEL, type Change } from "@/lib/investors/thirteenf";

/** "2026 2. çeyrek" from a quarter-end date. */
export function quarterLabel(period: string) {
  return `${period.slice(0, 4)} ${Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1}. çeyrek`;
}

/** A filing older than ~7 months means the investor stopped filing (fund closed or below the threshold). */
export function isStale(filedAt: string, now: number) {
  return now - Date.parse(`${filedAt}T00:00:00Z`) > 200 * 864e5;
}

export function FilingDate({ period, filedAt }: { period: string; filedAt: string }) {
  return <>{quarterLabel(period)} · {formatDate(filedAt)} tarihinde bildirildi</>;
}

const CHANGE_STYLE: Record<Change, string> = {
  yeni: "bg-primary-soft text-primary-strong",
  artirdi: "bg-gain-soft/60 text-gain",
  azaltti: "bg-loss-soft/70 text-loss",
  satti: "bg-loss-soft/70 text-loss",
  ayni: "text-ink-muted",
};

export function ChangeBadge({ change, sharesChange }: { change: Change; sharesChange?: number | null }) {
  if (change === "ayni") return <span className="text-xs text-ink-muted">Değişmedi</span>;
  const pct = sharesChange != null && (change === "artirdi" || change === "azaltti") ? ` %${Math.round(Math.abs(sharesChange) * 100)}` : "";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${CHANGE_STYLE[change]}`}>{CHANGE_LABEL[change]}{pct}</span>;
}
