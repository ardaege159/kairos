import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { getOwner } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ayarlar" };

async function Account() {
  const owner = await getOwner();
  return (
    <section className="glass-card max-w-[65ch] p-6">
      <h2 className="font-semibold">Hesap</h2>
      <p className="mt-2 text-sm text-ink-muted">
        {owner ? `${owner.email} olarak giriş yaptın.` : "Oturum bulunamadı."}
      </p>
      <form action="/auth/cikis" method="post" className="mt-4">
        <button
          type="submit"
          className="rounded-[var(--radius-control)] border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-white/70"
        >
          Çıkış yap
        </button>
      </form>
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
        <EmptyState title="İzleme listesi">
          Hisse verileri içeri aktarılınca takip ettiğin hisseleri buradan ekleyip çıkarabileceksin.
        </EmptyState>
      </div>
    </>
  );
}
