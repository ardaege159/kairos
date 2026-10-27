import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GuestNote } from "@/components/guest-note";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { WatchButton } from "@/components/watch-button";
import { WatchlistAdd } from "@/components/watchlist-add";
import { getWatchlist } from "@/lib/data/watchlist";
import { getOwner } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Ayarlar" };

async function Account() {
  const owner = await getOwner();
  if (!owner) {
    return (
      <GuestNote title="Misafir olarak geziyorsun">
        Piyasa sayfaları herkese açık. İzleme listesi, portföyler, alarmlar ve ayarlar yalnızca sahibine görünür.
      </GuestNote>
    );
  }
  return (
    <section className="glass-card max-w-[65ch] p-6">
      <h2 className="font-semibold">Hesap</h2>
      <p className="mt-2 text-sm text-ink-muted">
        {owner ? `${owner.email} olarak giriş yaptın.` : "Oturum bulunamadı."}
      </p>
      <form action="/auth/cikis" method="post" className="mt-4">
        <button
          type="submit"
          className="rounded-[var(--radius-control)] border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-elevated/70"
        >
          Çıkış yap
        </button>
      </form>
      {owner ? (
        <div className="mt-6 border-t border-outline-soft/60 pt-4">
          <h3 className="text-sm font-semibold">Şifre</h3>
          <p className="mt-1 text-sm text-ink-muted">Şifre belirlersen giriş için e-postana bağlantı gelmesini beklemezsin.</p>
          <PasswordForm />
        </div>
      ) : null}
    </section>
  );
}

async function Watchlist() {
  if (!(await getOwner())) return null;
  const tickers = await getWatchlist();
  return (
    <section className="glass-card max-w-[65ch] p-6" aria-labelledby="wl-title">
      <h2 id="wl-title" className="font-semibold">İzleme listesi</h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">
        Panel bu listeyi gösterir. Haber güncellemelerinde listendeki hisselerin haberleri öncelikli çekilir.
      </p>
      <WatchlistAdd exclude={tickers} />
      {tickers.length ? (
        <ul className="mt-4 divide-y divide-outline-soft/40">
          {tickers.map((t) => (
            <li key={t} className="flex items-center gap-3 py-2">
              <TickerLogo ticker={t} size={24} />
              <Link href={`/hisseler/${t}`} className="flex-1 font-semibold hover:text-primary">{t}</Link>
              <WatchButton ticker={t} watched compact />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">Liste boş.</p>
      )}
    </section>
  );
}

export default function AyarlarPage() {
  return (
    <>
      <PageHeader title="Ayarlar" description="İzleme listesi ve hesap ayarları." />
      <div className="flex flex-col gap-4">
        <Suspense fallback={<section className="glass-card max-w-[65ch] p-6 text-sm text-ink-muted">Hesap yükleniyor…</section>}>
          <Account />
        </Suspense>
        <Suspense fallback={<section className="glass-card max-w-[65ch] p-6 text-sm text-ink-muted">İzleme listesi yükleniyor…</section>}>
          <Watchlist />
        </Suspense>
      </div>
    </>
  );
}
