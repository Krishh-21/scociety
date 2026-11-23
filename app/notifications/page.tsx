import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/session";
import { listNotifications, unreadCount } from "@/lib/notify";
import { markNotificationsRead } from "@/app/actions";
import { timeAgo } from "@/lib/pricing";
import { AppHeader, Phone } from "@/components/ui";

export const dynamic = "force-dynamic";

const ICONS: Record<string, string> = {
  price_drop: "₹",
  new_deal: "+",
  locked: "✓",
  expired: "—",
  extended: "⏱",
  service_day: "→",
  job_done: "✓",
  comment: "💬",
  approval_needed: "!",
  dispute: "!",
  dispute_resolved: "✓",
  revisit_requested: "↻",
  revisit_scheduled: "⏱",
  revisit_started: "→",
  revisit_completed: "✓",
  repeat_due: "↻",
  society_complaint: "!",
  society_notice: "●",
  society_dues_reminder: "₹",
  gate_request: "→",
};

const SOCIETY_UPDATES: Record<string, string> = {
  society_complaint: "/society/complaints",
  society_notice: "/society/community",
  society_meeting: "/society/community",
  society_poll: "/society/community",
  society_dues_reminder: "/society/finance",
  gate_request: "/society/visitors",
};

const BOOKING_UPDATES = new Set([
  "locked", "service_day", "job_done", "dispute_resolved",
  "revisit_requested", "revisit_scheduled", "revisit_started", "revisit_completed",
]);

const SUCCESS_UPDATES = new Set(["price_drop", "locked", "job_done", "revisit_completed"]);

export default async function NotificationsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const items = listNotifications(me.user.id);
  const unread = unreadCount(me.user.id);

  return (
    <Phone>
      <AppHeader
        back={{ href: "/" }}
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're up to date"}
        right={
          unread > 0 ? (
            <form action={markNotificationsRead}>
              <button className="pill bg-canvas-alt text-ink-700">Mark all read</button>
            </form>
          ) : undefined
        }
      />
      <div className="flex-1 px-4 py-4 flex flex-col gap-2">
        {!items.length && (
          <div className="card p-6 text-center">
            <p className="font-bold mb-1">Nothing yet</p>
            <p className="text-sm text-ink-500">
              Booking and society updates land here.
            </p>
          </div>
        )}

        {items.map((n) => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className={`w-9 h-9 rounded-full grid place-items-center font-bold shrink-0 ${
                  SUCCESS_UPDATES.has(n.type)
                    ? "bg-save-50 text-save-700"
                    : n.type === "expired" || n.type === "dispute"
                      ? "bg-canvas-alt text-ink-500"
                      : "bg-brand-50 text-brand-700"
                }`}
              >
                {ICONS[n.type] ?? "•"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{n.title}</p>
                <p className="text-[13px] text-ink-700">{n.body}</p>
                <p className="text-[11px] text-ink-300 mt-0.5">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-brand-600 mt-2" aria-label="Unread" />}
            </>
          );
          const href = n.dealId
            ? BOOKING_UPDATES.has(n.type) ? `/bookings#booking-${n.dealId}` : `/deal/${n.dealId}`
            : SOCIETY_UPDATES[n.type];
          return href ? (
            <Link key={n.id} href={href} className="card p-3 flex gap-3 items-start">
              {body}
            </Link>
          ) : (
            <div key={n.id} className="card p-3 flex gap-3 items-start">
              {body}
            </div>
          );
        })}
        <div className="h-4" />
      </div>
    </Phone>
  );
}
