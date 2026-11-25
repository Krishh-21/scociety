import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDealView, myJob, queueAhead, tickDeal } from "@/lib/deals";
import { formatDate, rupees, timeAgo } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/authz";
import { dealReturnHref, dealReturnPath } from "@/lib/deal-return";
import { shareText } from "@/lib/share";
import { translator } from "@/lib/i18n";
import {
  AppHeader, FailSafeNote, FlatCounter, JourneySteps, LadderMeter, NeighbourStack, Phone,
  PriceBlock, ScopeList, SlotLoad, StatusPill, TabBar, VendorCard,
} from "@/components/ui";
import Countdown from "@/components/Countdown";
import AutoRefresh from "@/components/AutoRefresh";
import TrackView from "@/components/TrackView";
import JoinSheet from "@/components/JoinSheet";
import ServiceVisit from "@/components/ServiceVisit";
import { ApproveDealForm, CommentForm, QuickReplies, ShareButton } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const me = await getMe();
  const next = dealReturnPath(`/deal/${id}`);
  if (!me) redirect(dealReturnHref("/login", next));
  if (!me.residency && (me.user.role === "resident" || me.user.role === "secretary")) {
    redirect(dealReturnHref("/onboarding", next));
  }
  // A group is private to its own society, ops and the deal's vendor.
  const canView = await can(me, { kind: "deal.view", dealId: id }).catch((error: unknown) => {
    if (error instanceof ForbiddenError) return false;
    throw error;
  });
  if (!canView) notFound();

  // Close the deal first if its deadline has passed, so this page can never show
  // a live Join button on a group that is already locked or expired.
  await tickDeal(id);
  const [deal, job, canJoin, { created }, h] = await Promise.all([
    getDealView(id, me.user.id),
    myJob(id, me.user.id),
    can(me, { kind: "deal.join", dealId: id }),
    searchParams,
    headers(),
  ]);
  if (!deal) notFound();

  const t = translator(me.user.lang);
  const [queue, canApprove] = await Promise.all([
    job && deal.status === "in_progress" ? queueAhead(deal.id, job.id) : null,
    deal.status === "pending" && can(me, { kind: "deal.approve", dealId: id }),
  ]);
  const myUnits = deal.joinedByMe?.units ?? 1;
  const live = deal.status === "open" || (job && job.status !== "completed");

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";
  const share = shareText(deal, origin);

  return (
    <Phone wide>
      <TrackView name="deal_view" props={{ dealId: deal.id, status: deal.status }} />
      <AppHeader
        back={{ href: "/", label: t("common.back", "Back") }}
        title={deal.sku.name}
        subtitle={`${deal.society.name} · ${formatDate(deal.serviceDate)}`}
        right={live ? <AutoRefresh intervalMs={deal.status === "open" ? 30_000 : 15_000} /> : undefined}
      />

      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 grid gap-4 content-start lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4 min-w-0">
          {created && (
            <div role="status" className="card p-4 bg-save-50 border-save-500/30">
              <p className="text-sm font-bold text-save-700 mb-2">
                {deal.status === "pending"
                  ? "Sent to the committee for approval."
                  : "Group created. Now share it in your society WhatsApp group."}
              </p>
              {deal.status !== "pending" && <ShareButton text={share} />}
            </div>
          )}

          {deal.status === "pending" && (
            <section className="card p-4 sm:p-5 bg-warn-50 border-warn-500/30">
              <h2 className="font-extrabold text-warn-600 mb-1">Waiting for committee approval</h2>
              <p className="text-sm text-ink-700 mb-3">
                {deal.society.name} asks the managing committee to approve a group before it goes live. Nobody can join
                until then.
              </p>
              {canApprove && <ApproveDealForm dealId={deal.id} />}
            </section>
          )}

          {/* ---------------------------------------------------------- hero */}
          <section className="card p-4 sm:p-6" aria-labelledby="deal-price-title">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 id="deal-price-title" className="eyebrow">{deal.sku.category} · group price</h2>
              <StatusPill deal={deal} />
            </div>
            <PriceBlock deal={deal} />
            <div className="mt-5">
              <FlatCounter deal={deal} />
            </div>
            {deal.status === "open" && (
              <>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <Countdown to={deal.joinDeadline} prefix={`${t("deal.closesIn", "Closes in")} `} />
                  <span className="text-[12px] text-ink-500">
                    Service {formatDate(deal.serviceDate)} · {deal.vendor.name}
                  </span>
                </div>
                {deal.extendedAt && (
                  <p className="text-[12px] text-warn-600 mt-2">
                    The vendor held the date for 48 more hours — this is the last extension.
                  </p>
                )}
                <div className="mt-3">
                  <FailSafeNote deal={deal} />
                </div>
              </>
            )}
            <JourneySteps
              status={deal.status}
              joined={!!deal.joinedByMe}
              visitDone={job?.status === "completed"}
              className="mt-5 pt-5 border-t border-line"
            />
            {deal.status === "open" && (
              <div className="mt-5">
                <ShareButton text={share} label={t("deal.share", "Share to WhatsApp")} />
              </div>
            )}
          </section>

          {/* ------------------------------------------------- state banners */}
          {deal.status === "locked" && (
            <section className="card p-4 sm:p-5 bg-save-50 border-save-500/30">
              <h2 className="font-extrabold text-save-700 mb-1">Group booking confirmed</h2>
              <p className="text-sm text-ink-700">
                {deal.basisCount} {deal.basisLabel} booked together with one vendor on {formatDate(deal.serviceDate)}.
                Final price <strong>{rupees(deal.currentPricePaise)}</strong> per {deal.sku.unitLabel} — everyone pays the
                same, including whoever joined first.
              </p>
            </section>
          )}

          {deal.status === "in_progress" && (
            <section className="card p-4 sm:p-5 bg-warn-50 border-warn-500/30">
              <h2 className="font-extrabold text-warn-600 mb-1">Service day in progress</h2>
              <p className="text-sm text-ink-700">
                {deal.vendor.name} is working through the building.
              </p>
            </section>
          )}

          {deal.status === "expired" && (
            <section className="card p-4 sm:p-5">
              <h2 className="font-extrabold mb-1">This group closed</h2>
              <p className="text-sm text-ink-700 mb-3">
                {deal.basisCount < deal.mvs && `Only ${deal.basisCount} of the ${deal.mvs} ${deal.basisLabel} needed joined. `}
                <strong>Nobody was charged.</strong>
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href={`/create?sku=${deal.skuId}`} className="btn btn-primary w-full sm:flex-1">
                  Start a new group
                </Link>
                <Link href="/explore" className="btn btn-quiet w-full sm:flex-1">
                  Explore services
                </Link>
              </div>
            </section>
          )}

          {job && job.status !== "completed" && (
            <section className="card p-4 sm:p-5">
              <h2 className="font-extrabold mb-2">Your visit · {job.slot}</h2>
              <ServiceVisit job={job} queue={queue} />
            </section>
          )}

          {job?.status === "completed" && (
            <section className="card p-4 sm:p-5">
              <h2 className="font-extrabold mb-1">Your visit is complete</h2>
              <p className="text-sm text-ink-700 mb-3">
                Your final price was <strong>{rupees((deal.joinedByMe?.finalPricePaise ?? deal.currentPricePaise) * myUnits)}</strong>{" "}
                instead of {rupees(deal.listPricePaise * myUnits)}.
                {deal.sku.warrantyDays > 0 && ` Workmanship warranty: ${deal.sku.warrantyDays} days.`}
              </p>
              <Link href={`/bookings#booking-${deal.id}`} className="btn btn-quiet w-full">
                Rate your visit or get help
              </Link>
            </section>
          )}

          {deal.status === "open" && <LadderMeter deal={deal} />}
          {deal.status === "open" && <SlotLoad deal={deal} />}
        </div>

        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-2" aria-label="About this service">
          <VendorCard deal={deal} />
          <ScopeList deal={deal} />
          <section className="card p-4 sm:p-5">
            <h2 className="jd-section-title mb-2">How group pricing works</h2>
            <ul className="text-[13px] text-ink-700 flex flex-col gap-1.5 list-disc ps-4">
              <li>One vendor serves the whole building on one day, so travel and acquisition cost collapses.</li>
              <li>The saving is passed on as a published ladder — not a coupon, and it can only fall.</li>
              <li>You are charged when the group locks, never before, and never more than the final price.</li>
              <li>If a neighbour leaves, the price you were shown is held — it never goes back up.</li>
            </ul>
          </section>
        </aside>

        <div className="flex flex-col gap-4 min-w-0">
          {/* -------------------------------------------------- neighbours */}
          <section className="card p-4 sm:p-5" aria-labelledby="deal-neighbours">
            <h2 id="deal-neighbours" className="jd-section-title mb-3">{t("deal.neighbours", "Neighbours in this group")}</h2>
            <NeighbourStack deal={deal} />
            {deal.members.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-line max-h-56 overflow-auto" tabIndex={0} aria-label="Members">
                {deal.members.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 py-2 text-[13px]">
                    <span className="text-ink-700 min-w-0 truncate">
                      {m.name} <span className="text-ink-500">· {m.flat}</span>
                    </span>
                    <span className="text-ink-500 tnum shrink-0">
                      {m.units} {deal.sku.unitLabel}
                      {m.units > 1 ? "s" : ""} · {m.slot}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------------------------------------------- comments */}
          <section className="card p-4 sm:p-5" aria-labelledby="deal-comments">
            <h2 id="deal-comments" className="jd-section-title mb-3">{t("deal.comments", "Comments")}</h2>
            <ul className="flex flex-col gap-3 mb-4">
              {deal.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-canvas-alt text-ink-700 text-[11px] font-bold grid place-items-center">
                    {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">
                      {c.name} <span className="text-ink-500 font-medium">· {c.flat} · {timeAgo(c.at)}</span>
                    </p>
                    <p className="text-sm text-ink-700 break-words">{c.body}</p>
                  </div>
                </li>
              ))}
              {!deal.comments.length && <li className="text-sm text-ink-500">No comments yet.</li>}
            </ul>
            <div className="flex flex-col gap-2">
              <CommentForm dealId={deal.id} />
              <QuickReplies dealId={deal.id} skuId={deal.skuId} joined={!!deal.joinedByMe} />
            </div>
          </section>
          <div className="h-2" />
        </div>
      </div>

      <JoinSheet
        deal={deal}
        canJoin={canJoin}
        share={share}
        labels={{
          join: t("deal.join", "Join group"),
          youreIn: t("deal.youreIn", "You're in"),
          leave: t("deal.leave", "Leave"),
          howMany: t("join.howMany", "How many"),
          pickSlot: t("join.pickSlot", "Pick your slot"),
          howPay: t("join.howPay", "How will you pay?"),
          confirm: t("join.confirm", "Confirm & join"),
          continue: t("join.continue", "Continue"),
          back: t("join.back", "Back"),
          cancel: t("join.cancel", "Cancel"),
          nothingNow: t("deal.nothingNow", "₹0 charged now · you pay the final group price, whatever it falls to."),
          share: t("deal.share", "Share to WhatsApp"),
        }}
      />
      <TabBar active="home" t={t} mobile={false} />
    </Phone>
  );
}
