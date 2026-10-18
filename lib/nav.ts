import {
  Briefcase,
  CalendarDays,
  ChartColumnBig,
  GitCompareArrows,
  Landmark,
  LayoutDashboard,
  Newspaper,
  Settings,
  Shapes,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/bugun", label: "Bugün", icon: CalendarDays },
  { href: "/hisseler", label: "Hisseler", icon: ChartColumnBig },
  { href: "/portfoy", label: "Portföy", icon: Briefcase },
  { href: "/karsilastir", label: "Karşılaştır", icon: GitCompareArrows },
  { href: "/sektorler", label: "Sektörler", icon: Shapes },
  { href: "/piyasa", label: "Piyasa ve haberler", icon: Newspaper },
  { href: "/harcamalar", label: "Federal harcamalar", icon: Landmark },
];

export const SETTINGS_ITEM: NavItem = { href: "/ayarlar", label: "Ayarlar", icon: Settings };
