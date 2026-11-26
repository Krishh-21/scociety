import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import AutoRefresh from "@/components/AutoRefresh";
import { AppHeader, Icon, NotificationBell, Phone, TabBar } from "@/components/ui";
import { unreadCount } from "@/lib/notify";
import { getMe, type Me } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { requireSocietyGuard, requireSocietyMember, SocietyAccessError } from "@/lib/society-access";
import {
  committeeGateVisits, GATE_TICKET_WINDOW_MINUTES, gateDirectory, gateKindLabels, gateSummary, guardVisits, residentPasses, residentVisits,
  type GateStatus, type GateVisit,
} from "@/lib/society-gate";
import {
  CancelVisitForm, CreateGuestPassForm, LogVisitForm, RedeemGuestPassForm, RevokeGuestPassForm, VisitDecisionForm, VisitMovementForm,
} from "./VisitorForms";

export const dynamic = "force-dynamic";

const gateTime = new Intl.DateTimeFormat("en-IN", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
});

const visitStatus: Record<GateStatus, { label: string; style: string }> = {
  pending: { label: "Awaiting approval", style: "bg-warn-50 text-warn-600" },
  approved: { label: "Approved", style: "bg-brand-50 text-brand-700" },
  denied: { label: "Denied", style: "bg-danger-50 text-danger-600" },
  checked_in: { label: "Checked in", style: "bg-save-50 text-save-700" },
  checked_out: { label: "Checked out", style: "bg-canvas-alt text-ink-700" },
  cancelled: { label: "Cancelled", style: "bg-canvas-alt text-ink-700" },
  expired: { label: "Expired", style: "bg-canvas-alt text-ink-700" },
  host_unavailable: { label: "Host unavailable", style: "bg-canvas-alt text-ink-700" },
};

const mainClass = "flex flex-1 flex-col gap-5 px-4 py-4 pb-7 sm:px-6 lg:px-8";

function Stamp({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <time dateTime={value}>{gateTime.format(new Date(value))}</time>
    </span>
  );
}

function VisitCard({ id, visit, alert = false, children }: { id: string; visit: GateVisit; alert?: boolean; children?: ReactNode }) {
  const status = visitStatus[visit.status];
  return (
    <li
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-name`}
      className={`jd-target block scroll-mt-28 focus-visible:ring-2 focus-visible:ring-brand-500 ${alert ? "jd-alert" : "card p-4"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {alert && <p className="jd-alert__kicker">Waiting at the gate</p>}
          <p id={`${id}-name`} className="text-[15px] font-extrabold break-words">{visit.visitorName}</p>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {gateKindLabels[visit.kind]} · Flat {visit.flat}{visit.passId ? " · Guest pass" : ""}
          </p>
        </div>
        <span className={`pill shrink-0 ${status.style}`}>{visit.status === "expired" && visit.passId ? "Pass expired" : status.label}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-500">
        <Stamp label="Logged" value={visit.createdAt} />
        {visit.decidedAt && <Stamp label={visit.status === "denied" ? "Denied" : "Approved"} value={visit.decidedAt} />}
        {visit.checkedInAt && <Stamp label="In" value={visit.checkedInAt} />}
        {visit.checkedOutAt && <Stamp label="Out" value={visit.checkedOutAt} />}
        {visit.cancelledAt && <Stamp label="Cancelled" value={visit.cancelledAt} />}
      </div>
      {children}
    </li>
  );
}

function VisitList({
  id, title, description, visits, empty, live, action, heading: Heading = "h2", cardIdPrefix = "visit", alertPending = false,
}: {
  id?: string;
  title: string;
  description?: string;
  visits: GateVisit[];
  empty?: string;
  live?: boolean;
  action?: (visit: GateVisit) => ReactNode;
  heading?: "h2" | "h3";
  cardIdPrefix?: string;
  /** Pending requests addressed to this resident get the alert treatment. */
  alertPending?: boolean;
}) {
  if (!visits.length && !empty) return null;
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className="scroll-mt-28 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <Heading className={Heading === "h3" ? "text-sm font-bold text-ink-700" : "jd-section-title"}>
          {title}
          {visits.length > 0 && <span className="ms-2 tnum text-ink-500 font-bold">{visits.length}</span>}
        </Heading>
        {live && <AutoRefresh intervalMs={6_000} />}
      </div>
      {description && <p className="text-[13px] text-ink-500">{description}</p>}
      {visits.length ? (
        <ul className="space-y-2.5">
          {visits.map((visit) => (
            <VisitCard
              key={visit.id}
              id={`${cardIdPrefix}-${visit.id}`}
              visit={visit}
              alert={alertPending && visit.status === "pending"}
            >
              {action?.(visit)}
            </VisitCard>
          ))}
        </ul>
      ) : (
        <p className="card p-4 text-sm text-ink-500">{empty}</p>
      )}
    </section>
  );
}

function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="btn btn-quiet min-h-9 px-3 text-[13px]">Sign out</button>
    </form>
  );
}

async function renderGuardDesk(me: Me) {
  const { societyId, societyName } = await requireSocietyGuard(me);
  const now = new Date();
  const [flats, visits, { visitorsToday }] = await Promise.all([
    gateDirectory(me), guardVisits(me, now), gateSummary(societyId, now),
  ]);
  const inside = visits.filter(({ status }) => status === "checked_in");
  const approved = visits.filter(({ status }) => status === "approved");
  const pending = visits.filter(({ status }) => status === "pending");
  const history = visits.filter(({ status }) => status !== "checked_in" && status !== "approved" && status !== "pending");

  return (
    <Phone wide>
      <AppHeader title="Gate desk" subtitle={societyName} right={<SignOutButton />} />
      <main className={`${mainClass} lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6`}>
        <div className="flex flex-col gap-5 min-w-0">
        <dl className="card grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse py-3 text-center">
          {[
            { label: "Pending", count: pending.length },
            { label: "On site", count: inside.length },
            { label: "Arrivals today", count: visitorsToday },
          ].map(({ label, count }) => (
            <div className="flex flex-col gap-0.5 px-1" key={label}>
              <dt className="text-[12px] font-bold text-ink-500">{label}</dt>
              <dd className={`tnum text-2xl font-extrabold ${label === "Pending" && count > 0 ? "text-warn-600" : ""}`}>{count}</dd>
            </div>
          ))}
        </dl>

        <section className="card space-y-3 p-4 sm:p-5">
          <h2 className="jd-section-title">Log an arrival</h2>
          <p className="text-[13px] text-ink-500">
            Entry requests go to the resident’s JODO inbox. If the resident does not respond or JODO is offline,
            use the society’s phone or intercom procedure.
          </p>
          <p className="text-[13px] text-ink-500">
            Each request allows {GATE_TICKET_WINDOW_MINUTES} minutes for a response. Once approved, there are {GATE_TICKET_WINDOW_MINUTES} minutes to check in.
          </p>
          <LogVisitForm flats={flats} />
        </section>
        <section className="card space-y-3 p-4 sm:p-5">
          <h2 className="jd-section-title">Guest pass</h2>
          <RedeemGuestPassForm />
        </section>
        </div>

        <div className="flex flex-col gap-5 min-w-0">
        <section aria-labelledby="gate-log-title" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="gate-log-title" className="jd-section-title">Gate log</h2>
            <AutoRefresh intervalMs={6_000} />
          </div>
          <VisitList
            title="Ready to check in" heading="h3" visits={approved}
            action={(visit) => (
              <div className="flex flex-wrap items-start gap-x-2">
                <VisitMovementForm visitId={visit.id} direction="in" />
                <CancelVisitForm visitId={visit.id} />
              </div>
            )}
          />
          <VisitList
            title="Waiting for resident" heading="h3" visits={pending}
            action={(visit) => <CancelVisitForm visitId={visit.id} />}
          />
          <VisitList
            title="Checked in" heading="h3" visits={inside}
            action={(visit) => <VisitMovementForm visitId={visit.id} direction="out" />}
          />
          {!approved.length && !pending.length && !inside.length && (
            <p className="card p-4 text-sm text-ink-500">There are no active visitors at the gate.</p>
          )}
        </section>
        <VisitList title="Recent activity" visits={history} />
        </div>
      </main>
    </Phone>
  );
}

async function renderResidentVisitors(me: Me) {
  const residency = requireSocietyMember(me);
  const now = new Date();
  const [visits, passes, committeeActivity, unread] = await Promise.all([
    residentVisits(me, now),
    residentPasses(me),
    me.user.role === "secretary" ? committeeGateVisits(me, now) : null,
    unreadCount(me.user.id),
  ]);
  const pending = visits.filter(({ status }) => status === "pending");
  const history = visits.filter(({ status }) => status !== "pending");
  const at = now.toISOString();
  const passActivity = passes.map((pass) => ({
    ...pass,
    status: pass.usedAt ? "Used" : pass.revokedAt ? "Revoked" : pass.expiresAt <= at ? "Expired" : "Active",
  }));

  return (
    <Phone>
      <AppHeader
        brand title="Visitors" subtitle={`${residency.societyName} · Flat ${residency.flat}`}
        right={<NotificationBell unread={unread} />}
      />
      <main className={mainClass}>
        <VisitList
          id="gate-entry-requests" title="Entry requests" visits={pending} empty="New requests from the gate will appear here." live
          description={`Each request expires after ${GATE_TICKET_WINDOW_MINUTES} minutes. Once approved, the visitor has ${GATE_TICKET_WINDOW_MINUTES} minutes to check in.`}
          action={(visit) => <VisitDecisionForm visitId={visit.id} />} alertPending
        />
        <section id="invite-guest" tabIndex={-1} aria-labelledby="invite-guest-title" className="card space-y-3 p-4 sm:p-5 scroll-mt-28">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">
              <Icon name="key" size={18} />
            </span>
            <div>
              <h2 id="invite-guest-title" className="jd-section-title">Invite a guest</h2>
              <p className="mt-1 text-[13px] text-ink-500">Create a pass for one guest to use at the gate within 24 hours.</p>
            </div>
          </div>
          <CreateGuestPassForm activePassIds={passActivity.filter(({ status }) => status === "Active").map(({ id }) => id)} />
        </section>
        {passActivity.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="jd-section-title">Guest passes</h2>
            <ul className="mt-2 divide-y divide-line">
              {passActivity.map((pass) => {
                const { status } = pass;
                return (
                  <li key={pass.id} className="py-2.5 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 break-words">
                        <p className="text-sm font-bold">{pass.guestName}</p>
                        <p className="text-[12px] text-ink-500">
                          <Stamp label={status === "Active" ? "Expires" : status} value={pass.usedAt ?? pass.revokedAt ?? pass.expiresAt} />
                        </p>
                      </div>
                      <span className={`pill ${status === "Active" ? "bg-save-50 text-save-700" : "bg-canvas-alt text-ink-700"}`}>{status}</span>
                    </div>
                    {status === "Active" && <RevokeGuestPassForm passId={pass.id} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <VisitList title="Visit activity" visits={history} />
        {committeeActivity && (
          <VisitList id="society-gate-activity" title="Society gate activity" visits={committeeActivity} empty="The gate has not logged any visits yet." cardIdPrefix="committee-visit" />
        )}
      </main>
      <TabBar active="visitors" t={translator(me.user.lang)} context={{ society: residency.societyName, flat: residency.flat }} />
    </Phone>
  );
}

export default async function VisitorsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if ((me.user.role === "resident" || me.user.role === "secretary") && me.residency?.status !== "verified") redirect("/onboarding");

  try {
    return await (me.user.role === "guard" ? renderGuardDesk(me) : renderResidentVisitors(me));
  } catch (error) {
    if (!(error instanceof SocietyAccessError)) throw error;
    return (
      <Phone>
        <AppHeader title="Visitors" right={<SignOutButton />} />
        <main className="p-4">
          <p className="card p-4 text-sm text-ink-700">{error.message}</p>
        </main>
      </Phone>
    );
  }
}
