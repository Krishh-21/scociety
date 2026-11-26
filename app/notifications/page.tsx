import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/session";
import { listNotifications, unreadCount } from "@/lib/notify";
import { markNotificationsRead } from "@/app/actions";
import { timeAgo } from "@/lib/pricing";
import { AppHeader, Icon, Phone, TabBar } from "@/components/ui";
import AutoRefresh from "@/components/AutoRefresh";
import { gateKindLabels, residentVisits, type GateStatus } from "@/lib/society-gate";
import { VisitDecisionForm } from "@/app/society/visitors/VisitorForms";
import { notificationHref, SUCCESS_UPDATES } from "./links";

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

const TICKET_STATUS: Record<Exclude<GateStatus, "pending">, string> = {
  approved: "Entry approved. The guard can check the visitor in.",
  denied: "Entry denied.",
  checked_in: "Visitor checked in.",
  checked_out: "Visitor checked out.",
  expired: "Ticket expired.",
  cancelled: "The guard closed this entry request.",
  host_unavailable: "The host is no longer verified for this flat.",
};

export default async function NotificationsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const member = me.user.role === "resident" || me.user.role === "secretary";
  if (member && me.residency?.status !== "verified") redirect("/onboarding");
  const [items, unread] = await Promise.all([listNotifications(me.user.id), unreadCount(me.user.id)]);
  const canRespond = member && me.residency?.status === "verified";
  const residentTickets = canRespond && items.some((item) => item.gateVisitId) ? await residentVisits(me) : [];
  const visits = new Map(residentTickets.map((visit) => [visit.id, visit]));

  return (
    <Phone>
      <AppHeader
        back={{ href: "/" }}
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're up to date"}
        right={
          unread > 0 ? (
            <form action={markNotificationsRead}>
              <button className="btn btn-quiet min-h-10 px-4 text-[13px]">Mark all read</button>
            </form>
          ) : undefined
        }
      />
      {canRespond && <div className="sr-only"><AutoRefresh intervalMs={8_000} /></div>}
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-2.5">
        {!items.length && (
          <div className="card p-6 sm:p-8 text-center">
            <span aria-hidden="true" className="mx-auto mb-3 w-12 h-12 rounded-full bg-canvas-alt text-ink-500 grid place-items-center">
              <Icon name="bell" />
            </span>
            <h2 className="font-extrabold mb-1">Nothing yet</h2>
            <p className="text-sm text-ink-500">
              Booking and society updates land here.
            </p>
          </div>
        )}

        {items.map((n) => {
          const ticket = n.type === "gate_request" && n.gateVisitId ? visits.get(n.gateVisitId) : undefined;
          const unreadDot = !n.readAt && (
            <span className="mt-2 flex items-center">
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-brand-600" />
              <span className="sr-only">Unread</span>
            </span>
          );

          if (ticket) {
            const waiting = ticket.status === "pending";
            const titleId = `notification-title-${n.id}`;
            return (
              <article
                key={n.id}
                id={`notification-${n.id}`}
                className={waiting ? "jd-alert" : "card p-3.5 flex gap-3 items-start"}
                aria-labelledby={titleId}
              >
                <span
                  aria-hidden="true"
                  className={waiting ? "jd-alert__icon" : "w-9 h-9 rounded-full grid place-items-center shrink-0 bg-brand-50 text-brand-700"}
                >
                  <Icon name="gate" size={waiting ? 20 : 17} />
                </span>
                <div className="flex-1 min-w-0">
                  {waiting && <p className="jd-alert__kicker">Needs your answer</p>}
                  <h2 id={titleId} className={waiting ? "text-[16px] font-extrabold break-words" : "text-sm font-bold break-words"}>
                    {n.title}
                    <span className="sr-only">: entry ticket for {ticket.visitorName}</span>
                  </h2>
                  <p className="text-[13px] text-ink-700 break-words">
                    <strong>{ticket.visitorName}</strong> · {gateKindLabels[ticket.kind]} · Flat {ticket.flat}
                  </p>
                  <p className="text-[11px] text-ink-500 mt-0.5">{timeAgo(n.createdAt)}</p>
                  {waiting ? (
                    <VisitDecisionForm visitId={ticket.id} />
                  ) : (
                    <p className="mt-2 text-[13px] font-bold text-ink-700" role="status">{TICKET_STATUS[ticket.status as Exclude<GateStatus, "pending">]}</p>
                  )}
                  <Link
                    href={`/society/visitors#visit-${ticket.id}`}
                    className="mt-1.5 inline-flex min-h-10 items-center gap-1 text-[13px] font-bold text-brand-700"
                  >
                    Open entry ticket <span aria-hidden="true">›</span>
                  </Link>
                </div>
                {unreadDot}
              </article>
            );
          }

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
                <p className={`text-sm break-words ${n.readAt ? "font-semibold" : "font-extrabold"}`}>{n.title}</p>
                <p className="text-[13px] text-ink-700 break-words">{n.body}</p>
                <p className="text-[11px] text-ink-500 mt-0.5">{timeAgo(n.createdAt)}</p>
              </div>
              {unreadDot}
            </>
          );
          const href = notificationHref(n);
          return href ? (
            <Link key={n.id} href={href} className="card jd-lift p-3.5 flex gap-3 items-start">
              {body}
            </Link>
          ) : (
            <div key={n.id} className="card p-3.5 flex gap-3 items-start">
              {body}
            </div>
          );
        })}
        <div className="h-4" />
      </div>
      <TabBar active="notifications" mobile={false} context={me.residency ? { society: me.residency.societyName, flat: me.residency.flat } : undefined} />
    </Phone>
  );
}
