import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Federal harcamalar" };

export default function HarcamalarPage() {
  return (
    <>
      <PageHeader
        title="Federal harcamalar"
        description="ABD federal sözleşmeleri ve bunları alan S&P 500 şirketleri."
      />
      <EmptyState title="Harcama verisi bekleniyor">
        USAspending verileri çekilince sözleşmeler, alan şirketin hissesiyle eşleştirilerek burada görünecek.
      </EmptyState>
    </>
  );
}
