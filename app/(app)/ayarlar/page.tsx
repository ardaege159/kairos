import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Ayarlar" };

export default function AyarlarPage() {
  return (
    <>
      <PageHeader title="Ayarlar" description="İzleme listesi ve hesap ayarları." />
      <EmptyState title="Giriş henüz kurulmadı">
        Supabase girişi bağlanınca izleme listeni buradan düzenleyebileceksin.
      </EmptyState>
    </>
  );
}
