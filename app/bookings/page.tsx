import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { disputesForUser, issueWindowOpen, myBookings, myJob, paymentsForMember, queueAhead, revisitsForResident } from "@/lib/deals";
import { formatDate, rupees } from "@/lib/pricing";
import { formatRevisitDate } from "@/lib/revisits";
import { getMe } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { AppHeader, JourneySteps, Phone, StatusPill, TabBar } from "@/components/ui";
import { DisputeForm, RateForm } from "@/components/forms";
import AutoRefresh from "@/components/AutoRefresh";
import ServiceVisit from "@/components/ServiceVisit";
import type { JobStatus, RevisitVisit } from "@/lib/types";

export const dynamic = "force-dynamic";

const JOB_PROGRESS: Record<JobStatus, { step: number; label: string }> = {
  scheduled: { step: 1, label: "Scheduled" },
  en_route: { step: 1, label: "Slot ready" },
  in_progress: { step: 2, label: "Visit in progress" },
  completed: { step: 3, label: "Visit completed" },
};

const PAYMENT_LABEL: Record<string, string> = {
  authorisation: "Authorised (not charged)",
  capture: "Charged",
  release: "Released",
  refund: "Refunded",
};

const REVISIT_STATUS: Record<RevisitVisit["status"], string> = {
  awaiting_schedule: "Awaiting scheduling",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};

function RevisitDetails({ visit, showIssue }: { visit: RevisitVisit; showIssue: boolean }) {
  return (
    <section className="card bg-brand-50 p-3 text-[13px] text-ink-700">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-ink-900">Revisit</h3>
        <span className={`pill ${visit.status === "completed" ? "bg-save-50 text-save-700" : "bg-surface text-brand-700"}`}>
          {REVISIT_STATUS[visit.status]}
        </span>
      </div>
      {showIssue && <p className="mt-1">{visit.reason}</p>}
      {visit.status === "awaiting_schedule" && <p className="mt-1">The vendor will confirm a date and time slot here.</p>}
      {visit.serviceDate && (
        <p className="mt-1 font-bold text-ink-900">
          <time dateTime={visit.serviceDate}>{formatRevisitDate(visit.serviceDate)}</time> · {visit.slot}
        </p>
      )}
      {visit.serviceDate && visit.technician && <p className="mt-1">Technician {visit.technician}</p>}
      {visit.status === "scheduled" && (
        <p className="mt-2">Give the start code <strong className="tnum">{visit.startOtp}</strong> when the technician arrives.</p>
      )}
      {visit.status === "in_progress" && (
        <p className="mt-2">Give the completion code <strong className="tnum">{visit.endOtp}</strong> once you’re happy with the work.</p>
      )}
    </section>
  );
}

export default async function BookingsPage() {
  if (!isDemoMode()) notFound();
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.residency?.status !== "verified") redirect("/onboarding");
  const t = translator(me.user.lang);
  const [bookings, disputes, revisits] = await Promise.all([
    myBookings(me.user.id),
    disputesForUser(me.user.id),
    revisitsForResident(me.user.id),
  ]);
  const bookingDetails = await Promise.all(bookings.map(async (deal) => {
    const member = deal.joinedByMe;
    const [job, payments] = await Promise.all([
      myJob(deal.id, me.user.id),
      member ? paymentsForMember(member.id) : [],
    ]);
    const queue = job && deal.status === "in_progress" ? await queueAhead(deal.id, job.id) : null;
    return { deal, job, payments, queue };
  }));
  const active = bookings.some((d) => d.status === "open" || d.status === "locked" || d.status === "in_progress")
    || revisits.some((visit) => visit.status !== "completed");

  return (
    <Phone>
      <AppHeader
        back={{ href: "/explore", label: "Services" }}
        title={t("bookings.title", "My bookings")}
        subtitle={`${me.residency.societyName} · ${me.residency.flat}`}
        right={active ? <AutoRefresh intervalMs={15_000} /> : undefined}
      />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-4">
        {!bookings.length && (
          <div className="card p-6 sm:p-8 text-center">
            <h2 className="text-[17px] font-extrabold mb-1">{t("bookings.none", "Nothing booked yet")}</h2>
            <p className="text-sm text-ink-500 mb-5">Join a group in your society and the price falls for everyone.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/explore" className="btn btn-primary">
                See group services
              </Link>
            </div>
          </div>
        )}

        {bookingDetails.map(({ deal: d, job, payments, queue }) => {
          const member = d.joinedByMe;
          const units = member?.units ?? 1;
          const paid = (member?.finalPricePaise ?? d.currentPricePaise) * units;
          const latest = payments.at(-1);
          const jobDisputes = disputes.filter((x) => x.jobId === job?.id);
          const openIssue = jobDisputes.find((x) => x.status === "open");
          const dispute = openIssue ?? jobDisputes[0];
          const bookingRevisits = revisits.filter((visit) => visit.memberId === member?.id);
          const activeRevisits = bookingRevisits.filter((visit) => visit.status !== "completed");
          const shownRevisits = activeRevisits.length ? activeRevisits : bookingRevisits.slice(0, 1);
          const disputeHasRevisit = bookingRevisits.some((visit) => visit.disputeId === dispute?.id);
          const resolution = disputeHasRevisit ? dispute?.resolution?.replace(/^revisit:\s*/i, "") : dispute?.resolution;
          const progress = job ? JOB_PROGRESS[job.status] : undefined;

          // A group that didn't fill is not a failed booking — nobody was charged.
          if (d.status === "expired") {
            return (
              <article key={d.id} id={`booking-${d.id}`} tabIndex={-1} aria-labelledby={`booking-title-${d.id}`} className="card jd-target p-4 sm:p-5 scroll-mt-28">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <h2 id={`booking-title-${d.id}`} className="font-extrabold text-[16px] leading-snug">{d.sku.name}</h2>
                    <p className="text-[13px] text-ink-500">
                      {d.vendor.name} · {formatDate(d.serviceDate)}
                    </p>
                  </div>
                  <StatusPill deal={d} />
                </div>
                <p className="text-sm text-ink-700 my-2">
                  {d.basisCount < d.mvs
                    ? `${t("bookings.notCharged", "Didn't fill — you were not charged")}. ${d.basisCount} of ${d.mvs} ${d.basisLabel} joined.`
                    : "The group was closed without a charge."}
                </p>
                <div className="flex gap-2">
                  <Link href={`/create?sku=${d.skuId}`} className="btn btn-primary flex-1 h-10 min-h-10 text-[14px]">
                    Start it again
                  </Link>
                  <Link href={`/deal/${d.id}`} className="btn btn-quiet flex-1 h-10 min-h-10 text-[14px]">
                    Open group
                  </Link>
                </div>
              </article>
            );
          }

          return (
            <article key={d.id} id={`booking-${d.id}`} tabIndex={-1} aria-labelledby={`booking-title-${d.id}`} className="card jd-target p-4 sm:p-5 scroll-mt-28">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <h2 id={`booking-title-${d.id}`} className="font-extrabold text-[16px] leading-snug">{d.sku.name}</h2>
                  <p className="text-[13px] text-ink-500">
                    {d.vendor.name} · {formatDate(d.serviceDate)}
                    {job ? ` · ${job.slot}` : ""}
                  </p>
                </div>
                {progress ? (
                  <span className="pill shrink-0 bg-save-50 text-save-700">
                    {shownRevisits.length > 0 && job?.status === "completed" ? "Original visit completed" : progress.label}
                  </span>
                ) : (
                  <StatusPill deal={d} />
                )}
              </div>

              <JourneySteps
                status={d.status}
                joined={!!member}
                visitDone={job?.status === "completed"}
                className="my-4"
              />

              <div className="flex items-center justify-between gap-3 rounded-xl bg-canvas-alt px-3.5 py-3 text-sm">
                <span className="text-ink-700">
                  {units} × {d.sku.unitLabel}
                </span>
                <span className="tnum font-extrabold text-save-700 text-[16px]">
                  {rupees(paid)}{" "}
                  <span className="text-ink-500 line-through font-medium text-sm">
                    <span className="sr-only">instead of </span>{rupees(d.listPricePaise * units)}
                  </span>
                </span>
              </div>

              {latest && (
                <p className="text-[12px] text-ink-500 mt-1">
                  {PAYMENT_LABEL[latest.type] ?? latest.type} · {latest.method.toUpperCase()}
                  {latest.type === "authorisation" && " — money moves only when the group locks"}
                </p>
              )}

              {job && job.status !== "completed" && (
                <div className="mt-3">
                  <ServiceVisit job={job} queue={queue} />
                </div>
              )}

              {job?.status === "completed" && (
                <div className="mt-3 flex flex-col gap-2">
                  {d.sku.warrantyDays > 0 && (
                    <p className="text-[13px] text-ink-500">
                      {d.sku.warrantyDays}-day workmanship warranty from your {shownRevisits.length ? "original visit" : "visit"}.
                    </p>
                  )}
                  <RateForm jobId={job.id} current={job.ratingScore} />
                  {dispute && (
                    <div className="card p-3 bg-canvas-alt">
                      <p className="text-[13px] font-bold">
                        Issue: {dispute.reason} · {disputeHasRevisit ? "Revisit approved" : dispute.status}
                      </p>
                      {resolution && <p className="text-[12px] text-ink-700">{resolution}</p>}
                      {dispute.status === "open" && (
                        <p className="text-[12px] text-ink-500">Ops replies within 48 hours.</p>
                      )}
                    </div>
                  )}
                  {shownRevisits.map((visit) => (
                    <RevisitDetails
                      key={visit.id}
                      visit={visit}
                      showIssue={visit.disputeId !== dispute?.id}
                    />
                  ))}
                  {!openIssue && (issueWindowOpen(d.sku.warrantyDays, job.finishedAt) ? (
                    <DisputeForm jobId={job.id} />
                  ) : (
                    <p className="text-[13px] text-ink-500">The issue reporting window for this visit has closed.</p>
                  ))}
                </div>
              )}

              <Link href={`/deal/${d.id}`} className="btn btn-quiet w-full mt-3 h-10 min-h-10 text-[14px]">
                Open group
              </Link>
            </article>
          );
        })}
        <div className="h-4" />
      </div>
      <TabBar active="bookings" t={t} context={{ society: me.residency.societyName, flat: me.residency.flat }} />
    </Phone>
  );
}
