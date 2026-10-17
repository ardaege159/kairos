import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Karşılaştır" };

export default function KarsilastirPage() {
  return (
    <>
      <PageHeader
        title="Karşılaştır"
        description="İki ya da daha fazla hisseyi çarpanlar, büyüme ve sektör ortalamasına göre yan yana gör."
      />
      <EmptyState title="Karşılaştırılacak veri yok">
        Bilanço ve fiyat verileri geldiğinde buradan hisse ekleyerek karşılaştırma yapabileceksin.
      </EmptyState>
    </>
  );
}
