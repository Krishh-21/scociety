import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDealView, myJob, queueAhead, tickDeal } from "@/lib/deals";
import { formatDate, rupees, timeAgo } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { can } from "@/lib/authz";
import { dealReturnHref, dealReturnPath } from "@/lib/deal-return";
import { getDb } from "@/lib/db";
import { shareText } from "@/lib/share";
import { translator } from "@/lib/i18n";
import {
  AppHeader, FailSafeNote, FlatCounter, LadderMeter, NeighbourStack, Phone,
  PriceBlock, ScopeList, SlotLoad, StatusPill, VendorCard,
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
  const { created } = await searchParams;
  getDb();
  // Close the deal first if its deadline has passed, so this page can never show
  // a live Join button on a group that is already locked or expired.
  tickDeal(id);
  const deal = getDealView(id, me.user.id);
  if (!deal) notFound();
  // A group is private to its own society (ops and the deal's vendor can read it).
  if (!can(me, { kind: "deal.view", dealId: id })) notFound();

  const t = translator(me.user.lang);
  const job = myJob(deal.id, me.user.id);
  const queue = job && deal.status === "in_progress" ? queueAhead(deal.id, job.id) : null;
  const canJoin = can(me, { kind: "deal.join", dealId: id });
  const canApprove = deal.status === "pending" && can(me, { kind: "deal.approve", dealId: id });
  const myUnits = deal.joinedByMe?.units ?? 1;
  const live = deal.status === "open" || (job && job.status !== "completed");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";
  const share = shareText(deal, origin);

  return (
    <Phone>
      <TrackView name="deal_view" props={{ dealId: deal.id, status: deal.status }} />
      <AppHeader
        back={{ href: "/", label: t("common.back", "Back") }}
        title={deal.sku.name}
        subtitle={`${deal.society.name} · ${formatDate(deal.serviceDate)}`}
        right={live ? <AutoRefresh intervalMs={deal.status === "open" ? 30_000 : 15_000} /> : undefined}
      />

      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        {created && (
          <div className="card p-3 bg-save-50 border-save-500/30">
            <p className="text-sm font-bold text-save-700 mb-2">
              {deal.status === "pending"
                ? "Sent to the committee for approval."
                : "Group created. Now share it in your society WhatsApp group."}
            </p>
            {deal.status !== "pending" && <ShareButton text={share} />}
          </div>
        )}

        {deal.status === "pending" && (
          <section className="card p-4 bg-warn-50 border-warn-500/30">
            <p className="font-extrabold text-warn-600 mb-1">Waiting for committee approval</p>
            <p className="text-sm text-ink-700 mb-3">
              {deal.society.name} asks the managing committee to approve a group before it goes live. Nobody can join
              until then.
            </p>
            {canApprove && <ApproveDealForm dealId={deal.id} />}
          </section>
        )}

        {/* ---------------------------------------------------------- hero */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="eyebrow">{deal.sku.category}</p>
            <StatusPill deal={deal} />
          </div>
          <PriceBlock deal={deal} />
          <div className="mt-4">
            <FlatCounter deal={deal} />
          </div>
          {deal.status === "open" && (
            <>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
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
              <div className="mt-3">
                <ShareButton text={share} label={t("deal.share", "Share to WhatsApp")} />
              </div>
            </>
          )}
        </section>

        {/* ------------------------------------------------- state banners */}
        {deal.status === "locked" && (
          <section className="card p-4 bg-save-50 border-save-500/30">
            <p className="font-extrabold text-save-700 mb-1">Group booking confirmed</p>
            <p className="text-sm text-ink-700">
              {deal.basisCount} {deal.basisLabel} booked together with one vendor on {formatDate(deal.serviceDate)}.
              Final price <strong>{rupees(deal.currentPricePaise)}</strong> per {deal.sku.unitLabel} — everyone pays the
              same, including whoever joined first.
            </p>
          </section>
        )}

        {deal.status === "in_progress" && (
          <section className="card p-4 bg-warn-50 border-warn-500/30">
            <p className="font-extrabold text-warn-600 mb-1">Service day in progress</p>
            <p className="text-sm text-ink-700">
              {deal.vendor.name} is working through the building.
            </p>
          </section>
        )}

        {deal.status === "expired" && (
          <section className="card p-4">
            <p className="font-extrabold mb-1">This group closed</p>
            <p className="text-sm text-ink-700 mb-3">
              {deal.basisCount < deal.mvs && `Only ${deal.basisCount} of the ${deal.mvs} ${deal.basisLabel} needed joined. `}
              <strong>Nobody was charged.</strong>
            </p>
            <div className="flex flex-col gap-2">
              <Link href={`/create?sku=${deal.skuId}`} className="btn btn-primary w-full">
                Start a new group
              </Link>
              <Link href="/explore" className="btn btn-quiet w-full">
                Explore services
              </Link>
            </div>
          </section>
        )}

        {job && job.status !== "completed" && (
          <section className="card p-4">
            <p className="font-extrabold mb-2">Your visit · {job.slot}</p>
            <ServiceVisit job={job} queue={queue} />
          </section>
        )}

        {job?.status === "completed" && (
          <section className="card p-4">
            <p className="font-extrabold mb-1">Your visit is complete</p>
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

        <VendorCard deal={deal} />
        <ScopeList deal={deal} />

        {/* -------------------------------------------------- neighbours */}
        <section className="card p-4">
          <p className="eyebrow mb-3">{t("deal.neighbours", "Neighbours in this group")}</p>
          <NeighbourStack deal={deal} />
          <ul className="mt-3 flex flex-col gap-1.5 max-h-44 overflow-auto">
            {deal.members.map((m) => (
              <li key={m.id} className="flex justify-between text-[13px]">
                <span className="text-ink-700">
                  {m.name} <span className="text-ink-300">· {m.flat}</span>
                </span>
                <span className="text-ink-500 tnum">
                  {m.units} {deal.sku.unitLabel}
                  {m.units > 1 ? "s" : ""} · {m.slot}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------- comments */}
        <section className="card p-4">
          <p className="eyebrow mb-3">{t("deal.comments", "Comments")}</p>
          <ul className="flex flex-col gap-3 mb-3">
            {deal.comments.map((c) => (
              <li key={c.id}>
                <p className="text-[13px] font-bold">
                  {c.name} <span className="text-ink-300 font-medium">· {c.flat} · {timeAgo(c.at)}</span>
                </p>
                <p className="text-sm text-ink-700">{c.body}</p>
              </li>
            ))}
            {!deal.comments.length && <li className="text-sm text-ink-500">No comments yet.</li>}
          </ul>
          <div className="flex flex-col gap-2">
            <CommentForm dealId={deal.id} />
            <QuickReplies dealId={deal.id} skuId={deal.skuId} joined={!!deal.joinedByMe} />
          </div>
        </section>

        <section className="card p-4">
          <p className="eyebrow mb-2">How group pricing works</p>
          <ul className="text-[13px] text-ink-700 flex flex-col gap-1.5 list-disc pl-4">
            <li>One vendor serves the whole building on one day, so travel and acquisition cost collapses.</li>
            <li>The saving is passed on as a published ladder — not a coupon, and it can only fall.</li>
            <li>You are charged when the group locks, never before, and never more than the final price.</li>
            <li>If a neighbour leaves, the price you were shown is held — it never goes back up.</li>
          </ul>
        </section>

        <div className="h-2" />
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
    </Phone>
  );
}
