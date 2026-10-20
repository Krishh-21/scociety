import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDealView, myJob, queueAhead, tickDeal } from "@/lib/deals";
import { formatDate, rupees, timeAgo } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { can } from "@/lib/authz";
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
import { ApproveDealForm, CommentForm, DisputeForm, QuickReplies, RateForm, ShareButton } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/login");
  const { id } = await params;
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
        right={deal.status === "open" ? <AutoRefresh intervalMs={30_000} /> : undefined}
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
            {job && (
              <div className="card p-3 mt-3 bg-surface">
                <p className="text-sm font-bold">Your slot: {job.slot}</p>
                <p className="text-[13px] text-ink-500">
                  Technician {job.technician} · start code <span className="tnum font-bold">{job.startOtp}</span> ·
                  completion code <span className="tnum font-bold">{job.endOtp}</span>
                </p>
                <p className="text-[12px] text-ink-500 mt-1">
                  Give the start code when they arrive, the completion code only once you&apos;re happy.
                </p>
              </div>
            )}
          </section>
        )}

        {deal.status === "in_progress" && (
          <section className="card p-4 bg-warn-50 border-warn-500/30">
            <p className="font-extrabold text-warn-600 mb-1">Service day in progress</p>
            <p className="text-sm text-ink-700">
              {deal.vendor.name} is working through the building. {job ? `Your slot is ${job.slot}.` : ""}
            </p>
            {queue && (
              <p className="tnum text-[15px] font-bold mt-2">
                {queue.ahead === 0 ? "You're next" : `${queue.ahead} flats ahead · about ${queue.etaMin} min`}
              </p>
            )}
            {job && (
              <p className="text-sm mt-2">
                Start code <strong className="tnum">{job.startOtp}</strong> · completion code{" "}
                <strong className="tnum">{job.endOtp}</strong> for {job.technician}.
              </p>
            )}
          </section>
        )}

        {deal.status === "expired" && (
          <section className="card p-4">
            <p className="font-extrabold mb-1">This group didn&apos;t fill</p>
            <p className="text-sm text-ink-700 mb-3">
              Only {deal.basisCount} of the {deal.mvs} {deal.basisLabel} needed joined before the deadline
              {deal.extendedAt ? ", even with the 48-hour extension" : ""}, so the booking was cancelled.{" "}
              <strong>Nobody was charged</strong> — every authorisation was released.
            </p>
            <div className="flex flex-col gap-2">
              <Link href={`/create?sku=${deal.skuId}`} className="btn btn-primary w-full">
                Start it again for next week
              </Link>
              <Link href="/explore" className="btn btn-quiet w-full">
                Book solo at {rupees(deal.listPricePaise)}
              </Link>
            </div>
          </section>
        )}

        {deal.status === "completed" && job && (
          <section className="card p-4">
            <p className="font-extrabold mb-1">Done · {formatDate(deal.serviceDate)}</p>
            <p className="text-sm text-ink-700 mb-3">
              You paid <strong>{rupees((deal.joinedByMe?.finalPricePaise ?? deal.currentPricePaise) * myUnits)}</strong>{" "}
              instead of {rupees(deal.listPricePaise * myUnits)}.
              {deal.sku.warrantyDays > 0 && ` Workmanship warranty: ${deal.sku.warrantyDays} days.`}
            </p>
            <RateForm jobId={job.id} current={job.ratingScore} />
            <div className="mt-3">
              <DisputeForm jobId={job.id} />
            </div>
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
