import Link from "next/link";
import { redirect } from "next/navigation";
import { disputesForUser, myBookings, myJob, paymentsForMember, queueAhead } from "@/lib/deals";
import { formatDate, rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { translator } from "@/lib/i18n";
import { AppHeader, Phone, StatusPill, TabBar } from "@/components/ui";
import { DisputeForm, RateForm } from "@/components/forms";

export const dynamic = "force-dynamic";

const STEPS = ["Joined", "Locked", "Scheduled", "In progress", "Completed"];

function stepIndex(status: string) {
  switch (status) {
    case "open": return 0;
    case "locked": return 2;
    case "in_progress": return 3;
    case "completed": return 4;
    default: return 0;
  }
}

const PAYMENT_LABEL: Record<string, string> = {
  authorisation: "Authorised (not charged)",
  capture: "Charged",
  release: "Released",
  refund: "Refunded",
};

export default async function BookingsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.residency) redirect("/onboarding");
  const t = translator(me.user.lang);
  const bookings = myBookings(me.user.id);
  const disputes = disputesForUser(me.user.id);

  return (
    <Phone>
      <AppHeader
        title={t("bookings.title", "My bookings")}
        subtitle={`${me.residency.societyName} · ${me.residency.flat}`}
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
          const dispute = disputes.find((x) => x.jobId === job?.id);
          const idx = stepIndex(d.status);

          // A group that didn't fill is not a failed booking — nobody was charged.
          if (d.status === "expired") {
            return (
              <article key={d.id} className="card p-4">
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
                  {t("bookings.notCharged", "Didn't fill — you were not charged")}. {d.basisCount} of {d.mvs}{" "}
                  {d.basisLabel} joined.
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
            <article key={d.id} className="card p-4">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="font-bold text-[15px]">{d.sku.name}</p>
                  <p className="text-[13px] text-ink-500">
                    {d.vendor.name} · {formatDate(d.serviceDate)}
                    {job ? ` · ${job.slot}` : ""}
                  </p>
                </div>
                <StatusPill deal={d} />
              </div>

              <div className="flex gap-1 my-3">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={`h-1.5 rounded-full ${i <= idx ? "bg-brand-600" : "bg-canvas-alt"}`} />
                    <p className={`text-[10px] mt-1 ${i === idx ? "font-bold text-brand-700" : "text-ink-300"}`}>{s}</p>
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

              {queue && (
                <p className="tnum text-[13px] font-bold text-warn-600 mt-2">
                  {queue.ahead === 0 ? "You're next" : `${queue.ahead} flats ahead · about ${queue.etaMin} min`}
                </p>
              )}

              {d.status === "locked" && job && (
                <p className="text-[13px] text-ink-700 mt-2">
                  Technician {job.technician} · start code <strong className="tnum">{job.startOtp}</strong> · completion
                  code <strong className="tnum">{job.endOtp}</strong>
                </p>
              )}

              {d.status === "completed" && job && (
                <div className="mt-3 flex flex-col gap-2">
                  <RateForm jobId={job.id} current={job.ratingScore} />
                  {dispute ? (
                    <div className="card p-3 bg-canvas-alt">
                      <p className="text-[13px] font-bold">
                        Issue: {dispute.reason} · {dispute.status}
                      </p>
                      {dispute.resolution && <p className="text-[12px] text-ink-700">{dispute.resolution}</p>}
                      {dispute.status === "open" && (
                        <p className="text-[12px] text-ink-500">Ops replies within 48 hours.</p>
                      )}
                    </div>
                  ) : (
                    <DisputeForm jobId={job.id} />
                  )}
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
