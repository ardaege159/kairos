"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from "@/lib/nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-primary-soft/70 font-semibold text-primary-strong"
          : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
      }`}
    >
      <Icon size={18} strokeWidth={1.5} aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  return <SidebarView pathname={usePathname()} />;
}

/** Hook-free render, also used as the Suspense fallback while the pathname streams in. */
export function SidebarView({ pathname }: { pathname: string }) {
  return (
    <aside className="glass-pane sticky top-4 hidden h-[calc(100dvh-2rem)] w-60 shrink-0 flex-col rounded-[var(--radius-card)] p-4 md:flex">
      <Link href="/" className="mb-8 px-3 pt-2">
        <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-2xl font-bold tracking-tight text-transparent">
          Kairos
        </span>
        <span className="block text-xs text-ink-muted">ABD hisse analizi</span>
      </Link>

      <nav aria-label="Ana menü" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
    </aside>
  );
}

/** Compact top navigation for screens narrower than md, where the sidebar is hidden. */
export function MobileNav() {
  return <MobileNavView pathname={usePathname()} />;
}

export function MobileNavView({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Ana menü"
      className="glass-pane sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 py-2 md:hidden"
    >
      {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              active ? "bg-primary text-white" : "text-ink-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
