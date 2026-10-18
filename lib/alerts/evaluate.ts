// Alert and watchlist-event rules. Pure (tested); scripts/ingest/alerts.ts feeds them data and stores
// the resulting notifications, deduplicated by `dedupe`.

export type AlertKind = "price_above" | "price_below" | "move_abs" | "score_above" | "score_below";
export type Alert = { id: string; ticker: string; kind: AlertKind; threshold: number; note: string | null };
export type Snapshot = { ticker: string; name: string; price: number | null; change_1d: number | null; score: number | null; as_of: string | null };
export type Notice = { ticker: string; kind: string; title: string; body: string; link: string; dedupe: string; oneShot?: boolean };

export const ALERT_LABEL: Record<AlertKind, string> = {
  price_above: "Fiyat şunun üstüne çıkarsa ($)",
  price_below: "Fiyat şunun altına inerse ($)",
  move_abs: "Günlük hareket şu yüzdeyi aşarsa (%)",
  score_above: "Kairos Skoru şunun üstüne çıkarsa",
  score_below: "Kairos Skoru şunun altına inerse",
};

const usd = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const pct = (v: number) => `%${(Math.abs(v) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;

/** A user alert against the latest snapshot. Price and score alerts fire once; daily-move alerts once per trading day. */
export function evaluateAlert(a: Alert, s: Snapshot): Notice | null {
  const link = `/hisseler/${a.ticker}`;
  const note = a.note ? ` Notun: ${a.note}` : "";
  switch (a.kind) {
    case "price_above":
      return s.price != null && s.price >= a.threshold
        ? { ticker: a.ticker, kind: "alert", link, oneShot: true, dedupe: `alert|${a.id}`, title: `${a.ticker} ${usd(a.threshold)} seviyesini aştı`, body: `Son kapanış ${usd(s.price)}.${note}` } : null;
    case "price_below":
      return s.price != null && s.price <= a.threshold
        ? { ticker: a.ticker, kind: "alert", link, oneShot: true, dedupe: `alert|${a.id}`, title: `${a.ticker} ${usd(a.threshold)} seviyesinin altına indi`, body: `Son kapanış ${usd(s.price)}.${note}` } : null;
    case "move_abs":
      return s.change_1d != null && Math.abs(s.change_1d) * 100 >= a.threshold && s.as_of
        ? { ticker: a.ticker, kind: "alert", link, dedupe: `alert|${a.id}|${s.as_of}`, title: `${a.ticker} bir günde ${s.change_1d > 0 ? "yükseldi" : "düştü"}: ${s.change_1d > 0 ? "+" : "−"}${pct(s.change_1d)}`, body: `Alarm eşiğin %${a.threshold}.${note}` } : null;
    case "score_above":
      return s.score != null && s.score >= a.threshold
        ? { ticker: a.ticker, kind: "alert", link, oneShot: true, dedupe: `alert|${a.id}`, title: `${a.ticker} Kairos Skoru ${s.score} oldu`, body: `Eşiğin ${a.threshold} idi.${note}` } : null;
    case "score_below":
      return s.score != null && s.score <= a.threshold
        ? { ticker: a.ticker, kind: "alert", link, oneShot: true, dedupe: `alert|${a.id}`, title: `${a.ticker} Kairos Skoru ${s.score} seviyesine düştü`, body: `Eşiğin ${a.threshold} idi.${note}` } : null;
  }
}

export type WatchInput = {
  snapshot: Snapshot;
  today: string;                                            // YYYY-MM-DD
  earnings: { report_date: string; time_of_day: string | null } | null;
  insiderBuys: { id: string; owner: string; role: string | null; value: number | null; date: string }[];
  contracts: { id: string; amount: number; agency: string | null; action_date: string; what: string | null }[];
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const money = (v: number) => (v >= 1e9 ? `${(v / 1e9).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} milyar $` : `${(v / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} milyon $`);

export const WATCH_MOVE = 0.05;           // daily move that notifies for watchlist stocks
export const WATCH_CONTRACT = 50_000_000; // federal contract action size that notifies

/** Automatic notifications for a watchlist stock. */
export function watchlistEvents(w: WatchInput): Notice[] {
  const s = w.snapshot, t = s.ticker, link = `/hisseler/${t}`, out: Notice[] = [];
  if (w.earnings) {
    const d = daysBetween(w.today, w.earnings.report_date);
    if (d >= 0 && d <= 3) {
      const when = w.earnings.time_of_day === "pre-market" ? ", açılıştan önce" : w.earnings.time_of_day === "post-market" ? ", kapanıştan sonra" : "";
      out.push({ ticker: t, kind: "earnings", link, dedupe: `earnings|${t}|${w.earnings.report_date}`,
        title: `${t} ${d === 0 ? "bugün" : `${d} gün sonra`} bilanço açıklıyor`, body: `${s.name} çeyrek sonuçları ${w.earnings.report_date}${when}. Fiyat sert hareket edebilir.` });
    }
  }
  if (s.change_1d != null && Math.abs(s.change_1d) >= WATCH_MOVE && s.as_of && daysBetween(s.as_of, w.today) <= 4) {
    out.push({ ticker: t, kind: "move", link, dedupe: `move|${t}|${s.as_of}`,
      title: `${t} ${s.change_1d > 0 ? "yükseldi" : "düştü"}: ${s.change_1d > 0 ? "+" : "−"}${pct(s.change_1d)}`, body: `İzleme listendeki ${s.name} son işlem gününde sert hareket etti. Nedeni için haberlere bak.` });
  }
  for (const b of w.insiderBuys) {
    out.push({ ticker: t, kind: "insider", link, dedupe: `insider|${b.id}`,
      title: `${t}: ${b.owner} piyasadan hisse aldı`, body: `${b.role ?? "İçeriden"} ${b.date} tarihinde${b.value ? ` ${money(b.value)}` : ""} tutarında alım bildirdi.` });
  }
  for (const c of w.contracts.filter((c) => c.amount >= WATCH_CONTRACT)) {
    out.push({ ticker: t, kind: "federal", link: `/harcamalar/islem/${c.id}`, dedupe: `federal|${c.id}`,
      title: `${t}: ${money(c.amount)} federal sözleşme işlemi`, body: `${c.agency ?? "Federal kurum"}, ${c.action_date}${c.what ? `: ${c.what.toLowerCase()}` : ""}.` });
  }
  return out;
}
