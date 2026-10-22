import {
  Briefcase,
  CalendarDays,
  ChartColumnBig,
  Gauge,
  GitCompareArrows,
  Landmark,
  LayoutDashboard,
  ListFilter,
  Newspaper,
  Settings,
  Shapes,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/bugun", label: "Bugün", icon: CalendarDays },
  { href: "/hisseler", label: "Hisseler", icon: ChartColumnBig },
  { href: "/tarayici", label: "Tarayıcı", icon: ListFilter },
  { href: "/portfoy", label: "Portföy", icon: Briefcase },
  { href: "/yatirimcilar", label: "Yatırımcılar", icon: Users },
  { href: "/karsilastir", label: "Karşılaştır", icon: GitCompareArrows },
  { href: "/sektorler", label: "Sektörler", icon: Shapes },
  { href: "/makro", label: "Makro", icon: Gauge },
  { href: "/piyasa", label: "Piyasa ve haberler", icon: Newspaper },
  { href: "/harcamalar", label: "Federal harcamalar", icon: Landmark },
];

export const SETTINGS_ITEM: NavItem = { href: "/ayarlar", label: "Ayarlar", icon: Settings };
