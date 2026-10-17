import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Piyasa ve haberler" };

export default function PiyasaPage() {
  return (
    <>
      <PageHeader
        title="Piyasa ve haberler"
        description="Hisselerle eşleşmiş şirket haberleri ve piyasayı etkileyen küresel gelişmeler."
      />
      <EmptyState title="Haber akışı bağlı değil">
        Marketaux ve GDELT bağlantıları kurulunca haberler ilgili hisse ve sektörlerle birlikte burada listelenecek.
      </EmptyState>
    </>
  );
}
