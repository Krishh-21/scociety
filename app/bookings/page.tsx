import Link from "next/link";
import { redirect } from "next/navigation";
import { disputesForUser, issueWindowOpen, myBookings, myJob, paymentsForMember, queueAhead, revisitsForResident } from "@/lib/deals";
import { formatDate, rupees } from "@/lib/pricing";
import { formatRevisitDate } from "@/lib/revisits";
import { getMe } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { AppHeader, Phone, StatusPill, TabBar } from "@/components/ui";
import { DisputeForm, RateForm } from "@/components/forms";
import AutoRefresh from "@/components/AutoRefresh";
import ServiceVisit from "@/components/ServiceVisit";
import type { JobStatus, RevisitVisit } from "@/lib/types";

export const dynamic = "force-dynamic";

const STEPS = ["Joined", "Scheduled", "In progress", "Completed"];

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
        <h2 className="font-bold text-ink-900">Revisit</h2>
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
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.residency) redirect("/onboarding");
  const t = translator(me.user.lang);
  const bookings = myBookings(me.user.id);
  const disputes = disputesForUser(me.user.id);
  const revisits = revisitsForResident(me.user.id);
  const active = bookings.some((d) => d.status === "open" || d.status === "locked" || d.status === "in_progress")
    || revisits.some((visit) => visit.status !== "completed");

  return (
    <Phone>
      <AppHeader
        title={t("bookings.title", "My bookings")}
        subtitle={`${me.residency.societyName} · ${me.residency.flat}`}
        right={active ? <AutoRefresh intervalMs={15_000} /> : undefined}
      />
      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        {!bookings.length && (
          <div className="card p-6 text-center">
            <p className="font-bold mb-1">{t("bookings.none", "Nothing booked yet")}</p>
            <p className="text-sm text-ink-500 mb-4">Join a group in your society and the price falls for everyone.</p>
            <Link href="/" className="btn btn-primary w-full">
              See live groups
            </Link>
          </div>
        )}

        {bookings.map((d) => {
          const job = myJob(d.id, me.user.id);
          const member = d.joinedByMe;
          const units = member?.units ?? 1;
          const paid = (member?.finalPricePaise ?? d.currentPricePaise) * units;
          const payments = member ? paymentsForMember(member.id) : [];
          const latest = payments.at(-1);
          const queue = job && d.status === "in_progress" ? queueAhead(d.id, job.id) : null;
          const jobDisputes = disputes.filter((x) => x.jobId === job?.id);
          const openIssue = jobDisputes.find((x) => x.status === "open");
          const dispute = openIssue ?? jobDisputes[0];
          const bookingRevisits = revisits.filter((visit) => visit.memberId === member?.id);
          const activeRevisits = bookingRevisits.filter((visit) => visit.status !== "completed");
          const shownRevisits = activeRevisits.length ? activeRevisits : bookingRevisits.slice(0, 1);
          const disputeHasRevisit = bookingRevisits.some((visit) => visit.disputeId === dispute?.id);
          const resolution = disputeHasRevisit ? dispute?.resolution?.replace(/^revisit:\s*/i, "") : dispute?.resolution;
          const progress = job ? JOB_PROGRESS[job.status] : undefined;
          const idx = progress?.step ?? 0;

          // A group that didn't fill is not a failed booking — nobody was charged.
          if (d.status === "expired") {
            return (
              <article key={d.id} id={`booking-${d.id}`} tabIndex={-1} className="card p-4 scroll-mt-24">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-bold text-[15px]">{d.sku.name}</p>
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
            <article key={d.id} id={`booking-${d.id}`} tabIndex={-1} className="card p-4 scroll-mt-24">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="font-bold text-[15px]">{d.sku.name}</p>
                  <p className="text-[13px] text-ink-500">
                    {d.vendor.name} · {formatDate(d.serviceDate)}
                    {job ? ` · ${job.slot}` : ""}
                  </p>
                </div>
                {progress ? (
                  <span className="pill bg-save-50 text-save-700">
                    {shownRevisits.length > 0 && job?.status === "completed" ? "Original visit completed" : progress.label}
                  </span>
                ) : (
                  <StatusPill deal={d} />
                )}
              </div>

              <div className="flex gap-1 my-3">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={`h-1.5 rounded-full ${i <= idx ? "bg-brand-600" : "bg-canvas-alt"}`} />
                    <p aria-current={i === idx ? "step" : undefined} className={`text-[10px] mt-1 ${i === idx ? "font-bold text-brand-700" : "text-ink-300"}`}>{s}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">
                  {units} × {d.sku.unitLabel}
                </span>
                <span className="tnum font-extrabold text-save-700">
                  {rupees(paid)}{" "}
                  <span className="text-ink-300 line-through font-medium">{rupees(d.listPricePaise * units)}</span>
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
      <TabBar active="bookings" t={t} />
    </Phone>
  );
}
