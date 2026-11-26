import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { all } from "@/lib/db";
import { isDemoMode } from "@/lib/auth-mode";
import { feed, listVendors, societySavings } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import {
  AppHeader, DealCard, type IconName, ModuleLink, NotificationBell, Phone, SectionHeader, StatTile, TabBar,
} from "@/components/ui";
import { translator } from "@/lib/i18n";
import { ApproveDealForm } from "@/components/forms";
import { can } from "@/lib/authz";
import { unreadCount } from "@/lib/notify";
import { complaintSummary } from "@/lib/society-complaints";
import { financeDateLabel, financeMoney, financeSummary, financeToday } from "@/lib/society-finance";
import { gateSummary, residentPendingVisits } from "@/lib/society-gate";

export const dynamic = "force-dynamic";

type Module = { href: string; label: string; description: string; icon: IconName; meta?: string };

/**
 * The society's module directory. Grouped by what a resident is trying to do
 * so a new module slots into an existing group (or adds one) without a redesign.
 */
function societyModules({ committee, gateWaiting, openComplaints, filling, demo }: {
  committee: boolean; gateWaiting: number; openComplaints: number; filling: number; demo: boolean;
}): { id: string; title: string; modules: Module[] }[] {
  return [
    {
      id: "gate",
      title: "Gate & security",
      modules: [
        {
          href: "/society/visitors", label: "Visitors", icon: "gate",
          description: "Approve arrivals and see your flat’s gate log.",
          meta: gateWaiting ? `${gateWaiting} waiting` : undefined,
        },
        { href: "/society/visitors#invite-guest", label: "Guest passes", icon: "key", description: "Create a one-time entry code for a guest." },
        ...(committee
          ? [{ href: "/society/guard-access", label: "Guard access", icon: "shield" as const, description: "Add guards and turn their access on or off." }]
          : []),
      ],
    },
    {
      id: "community",
      title: "Community",
      modules: [
        { href: "/society/community#notices", label: "Notices", icon: "megaphone", description: "Official updates from the committee." },
        { href: "/society/community#meetings", label: "Meetings", icon: "users", description: "Agendas, RSVPs and published minutes." },
        { href: "/society/community#polls", label: "Voting", icon: "vote", description: "Have your say on society decisions." },
        { href: "/society/community#amenities", label: "Amenities", icon: "calendar", description: "Reserve shared spaces." },
        ...(committee
          ? [{ href: "/society/membership", label: "Flat requests", icon: "users" as const, description: "Review requests to join your society." }]
          : []),
      ],
    },
    {
      id: "money",
      title: "Money",
      modules: [
        {
          href: "/society/finance", label: committee ? "Dues & bills" : "Maintenance dues", icon: "wallet",
          description: committee ? "Issue dues, record payments and send reminders." : "Your flat’s bills and receipts.",
        },
        ...(committee
          ? [
              { href: "/society/finance/expenses", label: "Expenses", icon: "receipt" as const, description: "Society spending and vendor bills." },
              { href: "/society/finance/statement", label: "Monthly statement", icon: "bookings" as const, description: "Printable income and expense summary." },
            ]
          : []),
      ],
    },
    {
      id: "helpdesk",
      title: "Helpdesk",
      modules: [
        {
          href: "/society/complaints", label: committee ? "Complaint queue" : "Complaints", icon: "wrench",
          description: committee ? "Assign and resolve residents’ issues." : "Report and track building issues.",
          meta: committee && openComplaints ? `${openComplaints} open` : undefined,
        },
      ],
    },
    ...(demo ? [{
      id: "services",
      title: "Home services",
      modules: [
        {
          href: "/explore", label: "Group services", icon: "services",
          description: "Book with neighbours on one visit day.",
          meta: filling ? `${filling} filling` : undefined,
        },
        { href: "/bookings", label: "My bookings", icon: "bookings", description: "Visit codes, receipts and revisits." },
        { href: "/create", label: "Start a group", icon: "plus", description: "Pick a service and a date for the building." },
      ],
    } satisfies { id: string; title: string; modules: Module[] }] : []),
  ];
}

export default async function SocietyPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (me.user.role !== "resident" && me.user.role !== "secretary") notFound();
  if (me.residency?.status !== "verified") redirect("/onboarding");

  const t = translator(me.user.lang);
  const demo = isDemoMode();
  const committee = me.user.role === "secretary";
  const societyId = me.residency.societyId;
  const [{ live, pending, confirmed, past }, neighbours, vendors, unread, gateWaiting] = await Promise.all([
    feed(societyId, me.user.id),
    all<{ name: string; flat: string }>(
      `SELECT u.name, r.flat FROM residency r JOIN user u ON u.id = r.userId
       WHERE r.societyId = ? AND r.status = 'verified' ORDER BY r.flat`,
      societyId,
    ),
    demo ? listVendors() : [],
    unreadCount(me.user.id),
    residentPendingVisits(me),
  ]);
  const [saved, pendingGroups] = await Promise.all([
    societySavings(societyId),
    Promise.all(pending.map(async (deal) => ({
      deal,
      canApprove: await can(me, { kind: "deal.approve", dealId: deal.id }),
    }))),
  ]);
  const completed = past.filter((d) => d.status === "completed");
  const [finances, thisMonth, complaints, gate] = committee ? await Promise.all([
    financeSummary(societyId),
    financeSummary(societyId, financeToday().slice(0, 7)),
    complaintSummary(societyId),
    gateSummary(societyId),
  ]) : [null, null, null, null];
  const dashboard = finances ? [
    { label: "This month’s dues collected", value: financeMoney(thisMonth?.collectedPaise ?? 0), href: "/society/finance" },
    { label: "Dues outstanding", value: financeMoney(finances.outstandingPaise), href: "/society/finance?status=outstanding" },
    { label: "Open complaints", value: String(complaints?.openComplaints ?? 0), href: "/society/complaints" },
    { label: "Visitors today", value: String(gate?.visitorsToday ?? 0), href: "/society/visitors#society-gate-activity" },
  ] : [];
  const groups = societyModules({
    committee, gateWaiting: gateWaiting.length, openComplaints: complaints?.openComplaints ?? 0, filling: live.length, demo,
  });

  return (
    <Phone wide>
      <AppHeader
        brand
        title={me.residency.societyName}
        subtitle={`${t("home.flat", "Flat")} ${me.residency.flat} · ${neighbours.length} verified ${neighbours.length === 1 ? "flat" : "flats"}`}
        right={<NotificationBell unread={unread} />}
      />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:pt-2 flex flex-col gap-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex flex-col gap-5 min-w-0">
            {committee && (
              <section className="jd-panel" aria-labelledby="committee-dashboard">
                <div className="jd-panel__head">
                  <h2 id="committee-dashboard" className="jd-panel__title">Committee dashboard</h2>
                  <Link href="/society/guard-access" className="jd-panel__link">
                    Guard access <span aria-hidden="true">›</span>
                  </Link>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {dashboard.map((card) => (
                    <StatTile key={card.label} label={card.label} value={card.value} href={card.href} />
                  ))}
                </div>
                {finances && (
                  <StatTile
                    label="Reported bank balance"
                    value={finances.bankBalancePaise === null ? "Record a balance" : financeMoney(finances.bankBalancePaise)}
                    note={finances.bankBalanceOn ? `As of ${financeDateLabel(finances.bankBalanceOn)}` : undefined}
                    href="/society/finance"
                  />
                )}
              </section>
            )}

            <nav aria-label="Society modules" className="grid gap-5 md:grid-cols-2 md:items-start">
              {groups.map((group) => (
                <section key={group.id} aria-labelledby={`modules-${group.id}`} className="min-w-0">
                  <h2 id={`modules-${group.id}`} className="jd-group-title">{group.title}</h2>
                  <ul className="jd-modules" role="list">
                    {group.modules.map((m) => (
                      <li key={m.href}>
                        <ModuleLink href={m.href} label={m.label} description={m.description} icon={m.icon} meta={m.meta} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>

            {pending.length > 0 && (
              <section className="flex flex-col gap-3 scroll-mt-24" id="society-pending-groups" aria-labelledby="society-pending">
                <SectionHeader id="society-pending" title="Group bookings waiting for approval" />
                <div className="jd-card-grid">
                  {pendingGroups.map(({ deal: d, canApprove }) => (
                    <div key={d.id} className="flex flex-col gap-2">
                      <DealCard deal={d} />
                      {canApprove && <ApproveDealForm dealId={d.id} />}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-5 min-w-0" aria-label="Society at a glance">
            <section className="jd-panel" aria-labelledby="society-neighbours">
              <h2 id="society-neighbours" className="jd-panel__title">Verified neighbours</h2>
              <ul className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-3 gap-y-1.5">
                {neighbours.map((n) => (
                  <li key={n.flat} className="text-[13px] text-ink-700 truncate">
                    {n.name} <span className="text-ink-500">· {n.flat}</span>
                  </li>
                ))}
              </ul>
            </section>

            {demo && <section className="jd-panel" aria-labelledby="society-saved">
              <h2 id="society-saved" className="jd-panel__title">Booking together</h2>
              <p>
                <span className="jd-figure text-save-700 block">{rupees(saved)}</span>
                <span className="block text-[13px] text-ink-500">saved by the society on group services</span>
              </p>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  [live.length, "filling"],
                  [confirmed.length, "confirmed"],
                  [completed.length, "completed"],
                ].map(([n, label]) => (
                  <div key={String(label)} className="rounded-xl bg-canvas-alt px-2 py-2.5 flex flex-col-reverse">
                    <dt className="text-[12px] text-ink-500">{label}</dt>
                    <dd className="tnum text-[20px] font-extrabold">{n}</dd>
                  </div>
                ))}
              </dl>
            </section>}

            {demo && vendors.length > 0 && <section className="jd-panel" aria-labelledby="society-vendors">
              <h2 id="society-vendors" className="jd-panel__title">Society-approved vendors</h2>
              <ul className="flex flex-col divide-y divide-line">
                {vendors.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{v.name}</p>
                      <p className="text-[12px] text-ink-500">
                        ★ {v.rating} · {v.jobsDone.toLocaleString("en-IN")} jobs
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap sm:justify-end">
                      {v.badges.map((b) => (
                        <span key={b} className="pill bg-canvas-alt text-ink-700">
                          {b}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>}
          </aside>
        </div>
        <div className="h-4" />
      </div>
      <TabBar active="society" t={t} context={{ society: me.residency.societyName, flat: me.residency.flat }} />
    </Phone>
  );
}
