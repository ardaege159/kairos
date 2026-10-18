import { InfoTip } from "@/components/info-tip";
import type { InsiderRow } from "@/lib/data/insiders";
import { formatDate, formatMoney, formatPrice } from "@/lib/format";
import { CODE_LABEL, summarize } from "@/lib/insiders/parse";

/** Form 4 activity: open-market buys and sells in focus; awards, exercises and tax withholdings counted but not listed. */
export function InsiderTrades({ trades }: { trades: InsiderRow[] }) {
  const market = trades.filter((t) => t.code === "P" || t.code === "S");
  const s = summarize(trades);
  const other = trades.length - market.length;
  return (
    <section className="glass-card mt-8 p-5" aria-labelledby="insider-title">
      <h2 id="insider-title" className="flex items-center gap-1 font-semibold">
        Yönetici ve büyük ortak işlemleri <span className="font-normal text-ink-muted">· son 6 ay</span>
        <InfoTip title="İçeriden işlemler (Form 4)">
          Şirket yöneticileri, yönetim kurulu üyeleri ve %10&apos;dan fazla hisseye sahip ortaklar hisse alıp sattıklarında 2 iş günü içinde
          SEC&apos;e bildirmek zorundadır. Piyasadan kendi parasıyla alım güçlü bir güven işaretidir; satışlar ise vergi, çeşitlendirme ya da
          önceden planlanmış (10b5-1) programlar yüzünden sık görülür ve tek başına olumsuz sayılmaz.
        </InfoTip>
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-ink-muted">Piyasadan alım</p>
          <p className={`text-xl font-bold num ${s.buyValue > 0 ? "text-gain" : ""}`}>{s.buyValue ? formatMoney(s.buyValue) : "yok"}</p>
          <p className="text-xs text-ink-muted">{s.buyers} kişi</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Piyasada satış</p>
          <p className="text-xl font-bold num">{s.sellValue ? formatMoney(s.sellValue) : "yok"}</p>
          <p className="text-xs text-ink-muted">
            {s.sellers} kişi{s.plannedSellShare != null ? ` · planlı oranı %${Math.round(s.plannedSellShare * 100)}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Diğer işlemler</p>
          <p className="text-xl font-bold num">{other}</p>
          <p className="text-xs text-ink-muted">hisse ödülü, opsiyon, vergi kesintisi</p>
        </div>
      </div>
      {market.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Tarih</th>
                <th scope="col" className="py-2 pr-4 font-medium">Kişi</th>
                <th scope="col" className="py-2 pr-4 font-medium">İşlem</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Fiyat</th>
                <th scope="col" className="py-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {market.slice(0, 15).map((t) => (
                <tr key={t.id} className="border-t border-outline-soft/40">
                  <td className="py-2 pr-4 whitespace-nowrap text-ink-muted num">{formatDate(t.date)}</td>
                  <td className="py-2 pr-4">
                    <span className="block">{t.owner}</span>
                    <span className="block text-xs text-ink-muted">{t.role}</span>
                  </td>
                  <td className={`py-2 pr-4 ${t.code === "P" ? "font-semibold text-gain" : ""}`}>
                    {CODE_LABEL[t.code]}
                    {t.plan ? <span className="ml-1 rounded-full border border-outline-soft px-1.5 text-[10px] text-ink-muted">planlı</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-right num">{formatPrice(t.price)}</td>
                  <td className="py-2 text-right font-medium num">{formatMoney(t.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">Son 6 ayda piyasadan alım ya da satış bildirilmemiş.</p>
      )}
    </section>
  );
}
