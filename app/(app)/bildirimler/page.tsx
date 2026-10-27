import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BellRing, CalendarClock, Landmark, TrendingUp, UserCheck } from "lucide-react";
import { AlertForm, DeleteAlertButton } from "@/components/alerts/alert-form";
import { timeAgo } from "@/components/news/news-list";
import { GuestNote } from "@/components/guest-note";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { getAlerts, getNotifications } from "@/lib/data/alerts";
import { requestTime } from "@/lib/data/news";
import { ALERT_SHORT } from "@/lib/alerts/evaluate";
import { getOwner } from "@/lib/supabase/server";
import { clearRead, markAllRead } from "./actions";

export const metadata: Metadata = { title: "Bildirimler" };

const ICON = { alert: BellRing, earnings: CalendarClock, move: TrendingUp, insider: UserCheck, federal: Landmark } as const;

async function Content() {
  if (!(await getOwner())) {
    return (
      <GuestNote title="Bildirimler ve alarmlar kişiseldir">
        Sahibi fiyat, günlük hareket ve skor alarmları kurar; Kairos her veri güncellemesinden sonra bunları kontrol edip bildirim gönderir.
      </GuestNote>
    );
  }
  const [notes, alerts, now] = await Promise.all([getNotifications(), getAlerts(), requestTime()]);
  const unread = notes.filter((n) => !n.read_at).length;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className="glass-card p-5 lg:col-span-3" aria-labelledby="notes-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="notes-title" className="font-semibold">Bildirimler {unread ? <span className="font-normal text-ink-muted">· {unread} okunmamış</span> : null}</h2>
          <div className="flex gap-3 text-sm">
            {unread ? <form action={markAllRead}><button className="text-primary hover:underline">Tümünü okundu say</button></form> : null}
            {notes.length > unread ? <form action={clearRead}><button className="text-ink-muted hover:text-loss">Okunanları temizle</button></form> : null}
          </div>
        </div>
        {notes.length ? (
          <ul className="divide-y divide-outline-soft/40">
            {notes.map((n) => {
              const Icon = ICON[n.kind as keyof typeof ICON] ?? BellRing;
              return (
                <li key={n.id} className={`flex gap-3 py-3 ${n.read_at ? "opacity-70" : ""}`}>
                  {n.ticker ? <TickerLogo ticker={n.ticker} size={28} /> : <Icon size={20} className="mt-1 text-primary" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start justify-between gap-2">
                      {n.link ? <Link href={n.link} className="font-medium hover:text-primary">{n.title}</Link> : <span className="font-medium">{n.title}</span>}
                      <span className="shrink-0 text-xs text-ink-muted">{timeAgo(n.created_at, now)}</span>
                    </p>
                    {n.body ? <p className="text-sm text-ink-muted">{n.body}</p> : null}
                  </div>
                  {!n.read_at ? <span className="mt-2 size-2 shrink-0 rounded-full bg-secondary" aria-label="okunmamış" /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            Henüz bildirim yok. İzleme listendeki hisseler için bilanço yaklaşınca, günlük %5&apos;ten fazla hareket olunca, yöneticiler
            piyasadan hisse alınca ya da 50 milyon $&apos;ı aşan bir federal sözleşme gelince otomatik bildirim alırsın. Ayrıca sağdan kendi
            alarmını kurabilirsin.
          </p>
        )}
        <p className="mt-4 text-xs text-ink-muted">Bildirimler veriler her güncellendiğinde (<code>npm run veri:fiyat</code>, <code>veri:haber</code>) üretilir.</p>
      </section>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <section className="glass-card p-5" aria-labelledby="new-alert">
          <h2 id="new-alert" className="mb-3 font-semibold">Yeni alarm</h2>
          <AlertForm />
        </section>
        <section className="glass-card p-5" aria-labelledby="alerts-title">
          <h2 id="alerts-title" className="mb-3 font-semibold">Alarmlarım</h2>
          {alerts.length ? (
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li key={a.id} className={`flex items-center gap-2 ${a.active ? "" : "opacity-60"}`}>
                  <TickerLogo ticker={a.ticker} size={20} />
                  <Link href={`/hisseler/${a.ticker}`} className="font-semibold hover:text-primary">{a.ticker}</Link>
                  <span className="min-w-0 flex-1 truncate text-ink-muted" title={a.note ?? undefined}>
                    {ALERT_SHORT[a.kind]} <span className="num">{a.threshold.toLocaleString("tr-TR")}{a.kind === "move_abs" ? "%" : a.kind.startsWith("price") ? " $" : ""}</span>
                    {a.active ? "" : " · tetiklendi"}
                  </span>
                  <DeleteAlertButton id={a.id} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-muted">Kurulu alarm yok.</p>}
        </section>
      </div>
    </div>
  );
}

export default function BildirimlerPage() {
  return (
    <>
      <PageHeader title="Bildirimler" description="Alarmların ve izleme listendeki hisselerle ilgili önemli gelişmeler." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Bildirimler yükleniyor" />}>
        <Content />
      </Suspense>
    </>
  );
}
