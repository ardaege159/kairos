import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Sektörler" };

export default function SektorlerPage() {
  return (
    <>
      <PageHeader
        title="Sektörler"
        description="11 S&P 500 sektörünün yönü, ortalama çarpanları ve sektör içi en yüksek skorlu hisseler."
      />
      <EmptyState title="Sektör istatistikleri hesaplanmadı">
        Sektör ortalamaları, tüm S&amp;P 500 bilançoları içeri aktarıldıktan sonra hesaplanacak.
      </EmptyState>
    </>
  );
}
