import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Hisseler" };

export default function HisselerPage() {
  return (
    <>
      <PageHeader
        title="Hisseler"
        description="S&P 500 şirketlerinin çeyreklik bilançoları, F/K ve PD/DD gibi çarpanları ve Kairos Skoru."
      />
      <EmptyState title="Bilanço verisi bekleniyor">
        SEC EDGAR verileri içeri aktarılınca bir hisse seçip çeyrek çeyrek karşılaştırabileceksin.
      </EmptyState>
    </>
  );
}
