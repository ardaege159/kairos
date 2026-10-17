import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Bugün" };

export default function BugunPage() {
  return (
    <>
      <PageHeader
        title="Bugün"
        description="Günün gelişmeleri, bugün açıklanacak ekonomik veriler ve bilanço açıklayacak şirketler."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState title="Günün gelişmeleri">
          İzleme listendeki hisselerin haberleri (Marketaux) ve piyasayı etkileyen küresel gelişmeler (GDELT) burada
          saat sırasıyla görünecek.
        </EmptyState>
        <EmptyState title="Bugün açıklanacak veriler">
          Enflasyon, istihdam, büyüme gibi ABD verilerinin açıklanma saatleri ve Fed toplantıları burada listelenecek.
        </EmptyState>
        <EmptyState title="Bugün bilanço açıklayacaklar">
          Bugün çeyrek sonuçlarını açıklayacak S&amp;P 500 şirketleri, piyasa açılışından önce ya da kapanıştan sonra
          olarak ayrılacak.
        </EmptyState>
      </div>
    </>
  );
}
