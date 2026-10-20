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
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
        active ? "bg-nav-active font-medium text-nav-ink" : "text-nav-muted hover:bg-nav-hover hover:text-nav-ink"
      }`}
    >
      {/* Indicator bar: full height on the current page, a short hint on hover. */}
      <span
        aria-hidden
        className={`absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r-full bg-nav-accent transition-all duration-150 ${
          active ? "h-5 opacity-100" : "h-0 opacity-0 group-hover:h-3 group-hover:opacity-70"
        }`}
      />
      <Icon size={18} strokeWidth={1.6} aria-hidden className={active ? "text-nav-accent" : "transition-colors group-hover:text-nav-accent"} />
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
    <aside className="glass-pane sticky top-4 hidden h-[calc(100dvh-2rem)] w-60 shrink-0 flex-col rounded-[var(--radius-card)] p-3 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-3 pt-3 pb-1">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden className="text-primary">
          <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" />
          <path d="M6 16l4-4 3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="leading-tight">
          <span className="block text-lg font-semibold tracking-tight text-nav-ink">Kairos</span>
          <span className="block text-[11px] text-nav-muted">ABD hisse analizi</span>
        </span>
      </Link>

      <nav aria-label="Ana menü" className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className="border-t border-white/10 pt-2">
        <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
      </div>
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
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-primary text-white" : "text-nav-muted hover:bg-nav-hover hover:text-nav-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
