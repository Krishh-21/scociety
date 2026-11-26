import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isDemoMode } from "@/lib/auth-mode";
import { feed } from "@/lib/deals";
import { formatDate, timeAgo } from "@/lib/pricing";
import { getMe, type Me } from "@/lib/session";
import { listNotifications, unreadCount, type Notification } from "@/lib/notify";
import { translator, type T } from "@/lib/i18n";
import {
  formatSocietyDateTime, listSocietyAmenities, listSocietyMeetings, listSocietyNotices, listSocietyPolls,
} from "@/lib/society-community";
import { gateKindLabels, gateSummary, residentPendingVisits, type GateVisit } from "@/lib/society-gate";
import { COMPLAINT_STATUS, complaintPreview } from "@/lib/society-complaints";
import {
  financeDateLabel, financeMoney, financeMonthLabel, financeSummary, financeToday, listFinanceBills,
} from "@/lib/society-finance";
import {
  AppHeader, EmptyNote, Icon, type IconName, NotificationBell, Panel, Phone, Shortcut, StatTile, TabBar,
} from "@/components/ui";
import AutoRefresh from "@/components/AutoRefresh";
import Landing from "@/components/Landing";
import { VisitDecisionForm } from "@/app/society/visitors/VisitorForms";
import { notificationArea, notificationHref } from "@/app/notifications/links";

export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";
const todayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: IST });
const istHour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: IST });

/** How many gate requests the dashboard answers inline before pointing to the full queue. */
const GATE_INLINE = 3;

export default async function HomePage() {
  const me = await getMe();
  // Signed out, "/" is the public landing page; signed in, it's your society.
  if (!me) return <Landing />;
  if (me.user.role === "vendor") redirect("/vendor");
  if (me.user.role === "ops") redirect("/ops");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (me.residency?.status !== "verified") redirect("/onboarding");

  const t = translator(me.user.lang);
  const hour = Number(istHour.format(new Date()));
  const greeting =
    hour < 12 ? t("feed.goodMorning", "Good morning")
      : hour < 17 ? t("feed.goodAfternoon", "Good afternoon")
        : t("feed.goodEvening", "Good evening");
  const firstName = me.user.name.split(" ")[0];
  const [unread, updates] = await Promise.all([unreadCount(me.user.id), listNotifications(me.user.id, 6)]);

  return (
    <Phone wide>
      <AppHeader
        brand
        kicker={todayLabel.format(new Date())}
        title={me.residency.societyName}
        subtitle={`${t("home.flat", "Flat")} ${me.residency.flat} · ${greeting}, ${firstName}`}
        right={
          <>
            <NotificationBell unread={unread} />
            <Link
              href="/profile"
              aria-label="Account"
              className="jd-icon-btn bg-canvas-alt text-ink-900 font-semibold border-transparent"
            >
              <span aria-hidden="true">{me.user.name.slice(0, 1)}</span>
            </Link>
          </>
        }
      />
      <ResidentDashboard me={me} t={t} updates={updates} />
      <TabBar active="home" t={t} context={{ society: me.residency.societyName, flat: me.residency.flat }} />
    </Phone>
  );
}

/* --------------------------------------------------------------- verified */

async function ResidentDashboard({ me, t, updates }: { me: Me; t: T; updates: Notification[] }) {
  const residency = me.residency!;
  const { societyId } = residency;
  const committee = me.user.role === "secretary";
  const [gate, bills, { count: openCount, recent: openTickets }, notices, meetings, polls, amenities, services, desk] = await Promise.all([
    residentPendingVisits(me),
    listFinanceBills(me, "mine"),
    complaintPreview(me),
    listSocietyNotices(societyId, 3),
    listSocietyMeetings(societyId, me.user.id),
    listSocietyPolls(societyId, me.user.id),
    listSocietyAmenities(societyId, me.user.id),
    feed(societyId, me.user.id),
    committee
      ? Promise.all([
          financeSummary(societyId, financeToday().slice(0, 7)),
          financeSummary(societyId),
          gateSummary(societyId),
        ])
      : null,
  ]);

  const now = new Date().toISOString();
  const unpaid = bills.filter((b) => !b.paidOn).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const duePaise = unpaid.reduce((sum, b) => sum + b.totalPaise, 0);
  const overdue = unpaid.some((b) => b.daysOverdue > 0);
  const lastPaid = bills.find((b) => b.paidOn);
  const nextMeeting = meetings.find((m) => m.startsAt > now);
  const openPolls = polls.filter((p) => !p.closedAt);
  const unvoted = openPolls.filter((p) => !p.myVote);
  const myReservations = amenities
    .flatMap((a) => a.reservations.filter((r) => r.mine).map((r) => ({ ...r, amenity: a.name })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pinned = notices.find((n) => n.pinned);
  const latest = notices.filter((n) => n !== pinned).slice(0, pinned ? 2 : 3);
  const myUpcoming = [...services.confirmed, ...services.live]
    .filter((d) => d.joinedByMe)
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  const approvalsWaiting = committee ? services.pending.length : 0;

  return (
    <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:pt-2 flex flex-col gap-4 sm:gap-5">
      {/* ------------------------------------------------ status + shortcuts */}
      <section className="jd-masthead flex flex-col gap-4" aria-labelledby="home-today">
        <h2 id="home-today" className="sr-only">{t("home.today", "Today at a glance")}</h2>
        <ul className="jd-status" role="list">
          {gate.length > 0 ? (
            <li data-tone="alert">
              <span className="jd-status__dot" aria-hidden="true" />
              {gate.length === 1 ? "1 visitor waiting" : `${gate.length} visitors waiting`}
            </li>
          ) : (
            <li data-tone="ok">
              <Icon name="check" size={14} /> No one waiting at the gate
            </li>
          )}
          {unpaid.length > 0 ? (
            <li data-tone={overdue ? "alert" : undefined}>
              <Icon name="wallet" size={14} /> {financeMoney(duePaise)} {overdue ? "overdue" : "due"}
            </li>
          ) : bills.length > 0 ? (
            <li data-tone="ok">
              <Icon name="check" size={14} /> Maintenance paid
            </li>
          ) : null}
          {openCount > 0 && (
            <li>
              <Icon name="wrench" size={14} />
              {openCount} open {committee ? "in queue" : openCount === 1 ? "complaint" : "complaints"}
            </li>
          )}
          {unvoted.length > 0 && (
            <li>
              <Icon name="vote" size={14} /> {unvoted.length} {unvoted.length === 1 ? "poll needs" : "polls need"} your vote
            </li>
          )}
        </ul>
        <nav aria-label={t("home.shortcuts", "Society shortcuts")}>
          <ul className="jd-shortcuts" role="list">
            <li>
              <Shortcut
                href="/society/visitors" icon="gate" label={t("nav.visitors", "Visitors")}
                badge={gate.length || undefined} badgeLabel={gate.length ? `${gate.length} waiting` : undefined}
              />
            </li>
            <li>
              <Shortcut href="/society/community#notices" icon="megaphone" label={t("home.notices", "Notices")} />
            </li>
            <li>
              <Shortcut
                href="/society/finance" icon="wallet" label={t("home.dues", "Dues")}
                badge={unpaid.length || undefined} badgeLabel={unpaid.length ? `${unpaid.length} unpaid` : undefined}
              />
            </li>
            <li>
              <Shortcut
                href="/society/complaints" icon="wrench" label={t("nav.helpdesk", "Helpdesk")}
                badge={!committee && openCount ? openCount : undefined}
                badgeLabel={!committee && openCount ? `${openCount} open` : undefined}
              />
            </li>
            <li>
              <Shortcut href="/society/community#amenities" icon="calendar" label={t("home.amenities", "Amenities")} />
            </li>
          </ul>
        </nav>
      </section>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
          {/* -------------------------------------------------------- gate */}
          {/* The live region stays mounted so a refresh that brings a new request is announced. */}
          <div aria-live="polite">
            <GatePanel visits={gate} />
          </div>

          {/* ---------------------------------------------- your flat: money + helpdesk */}
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
            <Panel
              id="home-dues" icon="wallet" title={t("home.yourDues", "Maintenance")}
              action={{ href: "/society/finance", label: bills.length ? "Bills" : "Open" }}
            >
              {unpaid.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="jd-figure">{financeMoney(duePaise)}</p>
                  <p className="text-[13px] text-ink-700">
                    {unpaid.length === 1
                      ? `${financeMonthLabel(unpaid[0].month)} bill · `
                      : `${unpaid.length} unpaid bills · oldest `}
                    {unpaid[0].daysOverdue > 0 ? (
                      <strong className="text-warn-600">
                        {unpaid[0].daysOverdue} {unpaid[0].daysOverdue === 1 ? "day" : "days"} overdue
                      </strong>
                    ) : (
                      <>due {financeDateLabel(unpaid[0].dueOn)}</>
                    )}
                  </p>
                  <Link href={`/society/finance/${unpaid[0].id}`} className="btn btn-primary min-h-11 text-[14px] mt-1">
                    View bill<span className="sr-only"> for {financeMonthLabel(unpaid[0].month)}</span>
                  </Link>
                </div>
              ) : lastPaid ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold text-save-700">All dues paid</p>
                  <p className="text-[13px] text-ink-500">
                    {financeMonthLabel(lastPaid.month)} paid on {financeDateLabel(lastPaid.paidOn!)}
                  </p>
                  <Link href={`/society/finance/${lastPaid.id}/receipt`} className="jd-empty__action self-start">
                    Receipt <span aria-hidden="true">›</span>
                  </Link>
                </div>
              ) : (
                <EmptyNote>No maintenance bills for flat {residency.flat} yet.</EmptyNote>
              )}
            </Panel>

            <Panel
              id="home-helpdesk" icon="wrench"
              title={committee ? t("home.helpdeskQueue", "Helpdesk queue") : t("nav.helpdesk", "Helpdesk")}
              action={{ href: "/society/complaints", label: committee ? "Manage" : "Raise" }}
            >
              {openTickets.length > 0 ? (
                <ul className="jd-rows" role="list">
                  {openTickets.map((c) => (
                    <li key={c.id}>
                      <Link href="/society/complaints" className="jd-row">
                        <span className="min-w-0 flex-1">
                          <span className="jd-row__title block">{c.title}</span>
                          <span className="jd-row__meta block">
                            {c.category}{committee ? ` · ${c.flat}` : ""} · {COMPLAINT_STATUS[c.status]}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {openCount > openTickets.length && (
                    <li>
                      <Link href="/society/complaints" className="jd-row jd-row__meta font-medium">
                        +{openCount - openTickets.length} more open
                      </Link>
                    </li>
                  )}
                </ul>
              ) : (
                <EmptyNote action={committee ? undefined : { href: "/society/complaints", label: "Report an issue" }}>
                  {committee ? "No open complaints in the society." : "Nothing open. Lift, water or parking trouble?"}
                </EmptyNote>
              )}
            </Panel>
          </div>

          {/* ---------------------------------------------------- notice board */}
          <Panel
            id="home-notices" icon="megaphone" title={t("home.noticeBoard", "Notice board")}
            action={{ href: "/society/community#notices", label: "All notices" }}
          >
            {pinned && (
              <Link href={`/society/community#notice-${pinned.id}`} className="jd-pinned">
                <span className="text-[12px] font-medium text-ink-500">
                  {t("feed.announcement", "Society announcement")} · pinned
                </span>
                <span className="jd-row__title block text-[16px] mt-1">{pinned.title}</span>
                <span className="block text-[13.5px] text-ink-700 mt-1 line-clamp-3 whitespace-pre-line break-words">
                  {pinned.body}
                </span>
                <span className="jd-row__meta block mt-2">
                  {pinned.authorName} · {timeAgo(pinned.createdAt)}
                  {pinned.dealName ? ` · linked booking: ${pinned.dealName}` : ""}
                </span>
              </Link>
            )}
            {latest.length > 0 && (
              <ul className="jd-rows" role="list">
                {latest.map((n) => (
                  <li key={n.id}>
                    <Link href={`/society/community#notice-${n.id}`} className="jd-row">
                      <span className="min-w-0 flex-1">
                        <span className="jd-row__title block">{n.title}</span>
                        <span className="jd-row__meta block">{n.authorName} · {timeAgo(n.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {notices.length === 0 && <EmptyNote>The committee hasn’t published a notice yet.</EmptyNote>}
          </Panel>

          {/* -------------------------------------------------------- updates */}
          <Panel
            id="home-updates" icon="bell" title={t("home.updates", "Updates for you")}
            action={updates.length ? { href: "/notifications", label: "All" } : undefined}
          >
            <UpdatesList updates={updates} />
          </Panel>
        </div>

        {/* ---------------------------------------------------- right rail */}
        <aside className="flex flex-col gap-4 sm:gap-5 min-w-0" aria-label={t("home.alsoInSociety", "Also in your society")}>
          <Panel
            id="home-coming-up" icon="calendar" title={t("home.comingUp", "Coming up")}
            action={{ href: "/society/community#meetings", label: "Community" }}
          >
            {nextMeeting || unvoted.length || myReservations.length ? (
              <ul className="jd-rows" role="list">
                {nextMeeting && (
                  <li>
                    <Link href={`/society/community#meeting-${nextMeeting.id}`} className="jd-row">
                      <RowIcon name="users" />
                      <span className="min-w-0 flex-1">
                        <span className="jd-row__title block">{nextMeeting.title}</span>
                        <span className="jd-row__meta block">
                          <time dateTime={nextMeeting.startsAt}>{formatSocietyDateTime(nextMeeting.startsAt)}</time>
                          {" · "}
                          {nextMeeting.myResponse === "going"
                            ? "You’re going"
                            : nextMeeting.myResponse === "not_going"
                              ? "You can’t attend"
                              : "RSVP needed"}
                        </span>
                      </span>
                    </Link>
                  </li>
                )}
                {unvoted.slice(0, 2).map((p) => (
                  <li key={p.id}>
                    <Link href="/society/community#polls" className="jd-row">
                      <RowIcon name="vote" />
                      <span className="min-w-0 flex-1">
                        <span className="jd-row__title block">{p.question}</span>
                        <span className="jd-row__meta block">Open poll · you haven’t voted</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {myReservations.slice(0, 2).map((r) => (
                  <li key={r.id}>
                    <Link href="/society/community#amenities" className="jd-row">
                      <RowIcon name="calendar" />
                      <span className="min-w-0 flex-1">
                        <span className="jd-row__title block">{r.amenity}</span>
                        <span className="jd-row__meta block">
                          Your booking · <time dateTime={r.startsAt}>{formatSocietyDateTime(r.startsAt)}</time>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote
                action={amenities.length ? { href: "/society/community#amenities", label: "Reserve an amenity" } : undefined}
              >
                No meetings, open polls or amenity bookings ahead.
              </EmptyNote>
            )}
          </Panel>

          {desk && (
            <Panel
              id="home-committee" icon="shield" title={t("home.committeeDesk", "Committee desk")}
              action={{ href: "/society", label: "Society" }}
            >
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Collected this month" value={financeMoney(desk[0].collectedPaise)} href="/society/finance" />
                <StatTile label="Dues outstanding" value={financeMoney(desk[1].outstandingPaise)} href="/society/finance?status=outstanding" />
                <StatTile label="Open complaints" value={String(openCount)} href="/society/complaints" />
                <StatTile label="Visitors today" value={String(desk[2].visitorsToday)} href="/society/visitors#society-gate-activity" />
              </div>
              {approvalsWaiting > 0 && (
                <Link href="/society#society-pending-groups" className="jd-row font-medium text-[14px] text-warn-600">
                  {approvalsWaiting} group {approvalsWaiting === 1 ? "booking needs" : "bookings need"} committee approval ›
                </Link>
              )}
              <Link href="/society/guard-access" className="jd-empty__action">
                Manage guard access <span aria-hidden="true" className="ms-1">›</span>
              </Link>
            </Panel>
          )}

          {isDemoMode() && <Panel
            id="home-services" icon="services" title={t("home.services", "Home services")}
            action={{ href: "/bookings", label: t("nav.bookings", "Bookings") }}
          >
            {myUpcoming.length > 0 ? (
              <Link href={`/bookings#booking-${myUpcoming[0].id}`} className="jd-row">
                <span className="min-w-0 flex-1">
                  <span className="jd-row__meta block">Your next booking</span>
                  <span className="jd-row__title block">{myUpcoming[0].sku.name}</span>
                  <span className="jd-row__meta block">
                    {formatDate(myUpcoming[0].serviceDate)} · {myUpcoming[0].status === "open" ? "group still filling" : "confirmed"}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="text-[13.5px] text-ink-500">
                Book cleaning, repairs and servicing with neighbours on one visit day.
              </p>
            )}
            <Link href="/explore" className="btn btn-quiet min-h-11 text-[14px]">
              {services.live.length > 0
                ? `${services.live.length} ${services.live.length === 1 ? "group" : "groups"} filling in your society`
                : t("home.browseServices", "Browse group services")}
            </Link>
          </Panel>}
        </aside>
      </div>
      <div className="h-2" />
    </div>
  );
}

function GatePanel({ visits }: { visits: GateVisit[] }) {
  if (!visits.length) {
    return (
      <Panel id="home-gate" icon="gate" title="Gate" action={{ href: "/society/visitors", label: "Visitors" }}>
        <EmptyNote action={{ href: "/society/visitors#invite-guest", label: "Invite a guest" }}>
          No one is waiting for your approval.
        </EmptyNote>
        <span className="sr-only"><AutoRefresh intervalMs={8_000} /></span>
      </Panel>
    );
  }
  const shown = visits.slice(0, GATE_INLINE);
  return (
    <Panel
      id="home-gate" icon="gate" tone="alert"
      title={visits.length === 1 ? "Visitor at the gate" : `${visits.length} visitors at the gate`}
      action={{ href: "/society/visitors#gate-entry-requests", label: "Queue" }}
    >
      <p className="jd-alert__kicker -mt-2">Needs your answer</p>
      <ul className="flex flex-col gap-3" role="list">
        {shown.map((visit) => (
          <li key={visit.id} className="jd-visit">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[16px] font-semibold break-words min-w-0">{visit.visitorName}</p>
              <span className="text-[12px] text-ink-500 shrink-0">{timeAgo(visit.createdAt)}</span>
            </div>
            <p className="text-[13px] text-ink-700 flex flex-wrap items-center gap-2">
              {gateKindLabels[visit.kind]}
              <span className="jd-flat">Flat {visit.flat}</span>
            </p>
            <VisitDecisionForm visitId={visit.id} />
            <Link
              href={`/society/visitors#visit-${visit.id}`}
              className="self-start inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-brand-700"
            >
              Open entry ticket<span className="sr-only"> for {visit.visitorName}</span> <span aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
      {visits.length > GATE_INLINE && (
        <Link href="/society/visitors#gate-entry-requests" className="btn btn-quiet min-h-11 text-[14px]">
          Review all {visits.length} requests
        </Link>
      )}
      <span className="sr-only"><AutoRefresh intervalMs={8_000} /></span>
    </Panel>
  );
}

/* ----------------------------------------------------------------- shared */

const AREA_ICON: Record<ReturnType<typeof notificationArea>, IconName> = {
  gate: "gate", notice: "megaphone", dues: "wallet", helpdesk: "wrench", meeting: "users", booking: "services",
};

function UpdatesList({ updates }: { updates: Notification[] }) {
  if (!updates.length) {
    return <EmptyNote>Gate, notice, dues and booking updates for you will collect here.</EmptyNote>;
  }
  return (
    <ul className="jd-rows" role="list">
      {updates.map((n) => {
        const href = notificationHref(n);
        const body: ReactNode = (
          <>
            <RowIcon name={AREA_ICON[notificationArea(n.type)]} />
            <span className="min-w-0 flex-1">
              <span className={`jd-row__title block ${n.readAt ? "font-semibold" : ""}`}>{n.title}</span>
              <span className="jd-row__meta block line-clamp-2">{n.body}</span>
            </span>
            <span className="text-[12px] text-ink-500 shrink-0 flex items-center gap-1.5">
              {!n.readAt && (
                <>
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-600" />
                  <span className="sr-only">Unread,</span>
                </>
              )}
              {timeAgo(n.createdAt)}
            </span>
          </>
        );
        return (
          <li key={n.id}>
            {href ? <Link href={href} className="jd-row">{body}</Link> : <div className="jd-row">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function RowIcon({ name }: { name: IconName }) {
  return (
    <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-lg bg-canvas-alt text-ink-700 grid place-items-center">
      <Icon name={name} size={16} />
    </span>
  );
}
