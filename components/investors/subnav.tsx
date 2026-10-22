import Link from "next/link";

const TABS = [
  { href: "/yatirimcilar", key: "kucuk", label: "Başarılı küçük fonlar" },
  { href: "/yatirimcilar/gorusler", key: "gorusler", label: "Hisse görüşleri" },
  { href: "/yatirimcilar/taninmis", key: "taninmis", label: "Tanınmış isimler" },
] as const;

export function InvestorTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Yatırımcı bölümleri" className="mb-6 flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-surface-container/70 p-1 text-sm sm:inline-flex">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${active === t.key ? "bg-elevated text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
