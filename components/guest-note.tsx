import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown to signed-out visitors in place of the owner's personal data (watchlist, portfolios, alerts…). */
export function GuestNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card max-w-[65ch] p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Lock size={16} aria-hidden className="text-ink-muted" />
        {title}
      </h2>
      <div className="mt-2 text-sm text-ink-muted">{children}</div>
      <Link
        href="/giris"
        className="mt-4 inline-flex rounded-[var(--radius-control)] border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-elevated/70"
      >
        Sahibi olarak giriş yap
      </Link>
    </section>
  );
}
