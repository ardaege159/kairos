import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadCount } from "@/lib/data/alerts";

/** Top-bar bell with the number of unread notifications. */
export async function NotificationBell() {
  const unread = await getUnreadCount();
  return (
    <Link href="/bildirimler" aria-label={unread ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
      className="relative inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-elevated/70 hover:text-ink">
      <Bell size={18} aria-hidden />
      {unread ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-secondary px-1 text-center text-[10px] leading-4 font-semibold text-white num">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function NotificationBellFallback() {
  return (
    <span className="inline-flex size-9 items-center justify-center text-ink-muted" aria-hidden>
      <Bell size={18} />
    </span>
  );
}
