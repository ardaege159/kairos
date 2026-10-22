import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { ChangeBadge, quarterLabel } from "@/components/investors/bits";
import type { HolderOf } from "@/lib/data/investors";
import { formatMoney } from "@/lib/format";

/** Famous investors holding this stock in their latest 13F, with their quarter-over-quarter change. */
export function FamousHolders({ holders }: { holders: HolderOf[] }) {
  return (
    <section className="glass-card mt-8 p-5" aria-labelledby="famous-title">
      <h2 id="famous-title" className="flex items-center gap-1 font-semibold">
        Takip ettiğimiz yatırımcılardan kimler tutuyor?
        <InfoTip title="Kaynak: 13F">
          Takip ettiğimiz tanınmış yatırımcıların ve S&amp;P 500&apos;ü geçen küçük fonların SEC&apos;e bildirdiği son çeyrek sonu portföyleri. Bildirimler çeyrek bitiminden 45 gün sonraya kadar
          gelir; o tarihten sonra satmış ya da almış olabilirler.
        </InfoTip>
      </h2>
      {holders.length ? (
        <ul className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
          {holders.map((h) => (
            <li key={h.investor.key} className="flex items-center gap-3 text-sm">
              <Link href={`/yatirimcilar/${h.investor.key}`} className="min-w-0 flex-1 hover:text-primary">
                <span className="font-medium">{h.investor.person}</span>
                <span className="block truncate text-xs text-ink-muted">{h.investor.fund} · {quarterLabel(h.period)}</span>
              </Link>
              <span className="text-right text-xs num">
                <span className="block font-semibold">portföyün %{(h.weight * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span>
                <span className="text-ink-muted">{formatMoney(h.value)}</span>
              </span>
              <ChangeBadge change={h.change} sharesChange={h.sharesChange} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Takip ettiğimiz yatırımcıların son bildirimlerinde bu hisse yok.</p>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Tüm liste: <Link href="/yatirimcilar" className="text-primary hover:underline">Yatırımcılar</Link>
      </p>
    </section>
  );
}
