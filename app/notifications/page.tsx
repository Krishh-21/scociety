import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/session";
import { listNotifications, unreadCount } from "@/lib/notify";
import { markNotificationsRead } from "@/app/actions";
import { AppHeader, Phone, TabBar } from "@/components/ui";

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
  repeat_due: "↻",
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function NotificationsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const items = listNotifications(me.user.id);
  const unread = unreadCount(me.user.id);

  return (
    <Phone>
      <AppHeader
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
              Price drops, confirmations and service-day updates land here.
            </p>
          </div>
        )}

        {items.map((n) => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className={`w-9 h-9 rounded-full grid place-items-center font-bold shrink-0 ${
                  n.type === "price_drop" || n.type === "locked" || n.type === "job_done"
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
                <p className="text-[11px] text-ink-300 mt-0.5">{ago(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-brand-600 mt-2" aria-label="Unread" />}
            </>
          );
          return n.dealId ? (
            <Link key={n.id} href={`/deal/${n.dealId}`} className="card p-3 flex gap-3 items-start">
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
      <TabBar active="home" />
    </Phone>
  );
}
