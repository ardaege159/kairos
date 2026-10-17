import { Suspense } from "react";
import { MobileNav, MobileNavView, Sidebar, SidebarView } from "@/components/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-4">
      <Suspense fallback={<SidebarView pathname="" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-h-[calc(100dvh-2rem)] min-w-0 flex-1 flex-col">
        <Suspense fallback={<MobileNavView pathname="" />}>
          <MobileNav />
        </Suspense>
        <main className="flex-1 py-2">{children}</main>
        <footer className="mt-10 border-t border-outline-soft/60 pt-4 text-xs text-ink-muted">
          Kairos kişisel bir analiz aracıdır; buradaki veriler ve skorlar yatırım tavsiyesi değildir.
          Fiyatlar en az 15 dakika gecikmelidir.
        </footer>
      </div>
    </div>
  );
}
