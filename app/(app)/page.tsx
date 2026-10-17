import { EmptyState, PageHeader } from "@/components/page-header";

export default function PanelPage() {
  return (
    <>
      <PageHeader
        title="Panel"
        description="İzleme listendeki hisselerin fiyatı, Kairos Skoru ve günün öne çıkan gelişmeleri."
      />
      <EmptyState title="Veriler henüz bağlı değil">
        Veri hattı kurulunca S&amp;P 500 hisseleri, fiyatlar ve haberler burada görünecek. İlk adım: Supabase
        veritabanını bağlamak.
      </EmptyState>
    </>
  );
}
