import Link from "next/link";
import { redirect } from "next/navigation";
import { feed, listSkus, repeatSuggestions, societySavings } from "@/lib/deals";
import { formatDate, rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { translator } from "@/lib/i18n";
import { getPinnedNotice } from "@/lib/society-community";
import { gateKindLabels, residentPendingVisits } from "@/lib/society-gate";
import {
  AppHeader, DealCard, Icon, NotificationBell, Phone, QuickAction, SectionHeader, TabBar, VisitorAlert,
} from "@/components/ui";
import AutoRefresh from "@/components/AutoRefresh";
import Landing from "@/components/Landing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const me = await getMe();
  // Signed out, "/" is the public landing page; signed in, it's your society.
  if (!me) return <Landing />;
  if (me.user.role === "vendor") redirect("/vendor");
  if (me.user.role === "ops") redirect("/ops");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (!me.residency) redirect("/onboarding");

  const t = translator(me.user.lang);
  const { societyId } = me.residency;
  const { live, pending, confirmed, past } = await feed(societyId, me.user.id);
  const verified = me.residency.status === "verified";
  const [saved, repeats, skus, unread, gateRequests, pinned] = await Promise.all([
    societySavings(societyId),
    repeatSuggestions(societyId),
    listSkus(),
    unreadCount(me.user.id),
    verified ? residentPendingVisits(me) : [],
    verified ? getPinnedNotice(societyId) : null,
  ]);
  const suggestions = skus.filter((s) => !live.some((d) => d.skuId === s.id)).slice(0, 3);
  const firstGateRequest = gateRequests[0];
  const featured = live[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("feed.goodMorning", "Good morning")
      : hour < 17 ? t("feed.goodAfternoon", "Good afternoon")
        : t("feed.goodEvening", "Good evening");

  return (
    <Phone wide>
      <AppHeader
        title={`${greeting}, ${me.user.name.split(" ")[0]}`}
        subtitle={`${me.residency.societyName} · ${me.residency.flat}`}
        right={
          <>
            <NotificationBell unread={unread} />
            <Link
              href="/profile"
              aria-label="Profile"
              className="jd-icon-btn bg-brand-50 text-brand-700 font-extrabold border-transparent"
            >
              <span aria-hidden="true">{me.user.name.slice(0, 1)}</span>
            </Link>
          </>
        }
      />

      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-4 flex flex-col gap-5">
        {/* The gate is the one thing that can't wait. The live region stays mounted so
            a refresh that brings a new request is announced. */}
        {verified && (
          <div aria-live="polite" className={firstGateRequest ? undefined : "sr-only"}>
            {firstGateRequest && (
              <VisitorAlert
                count={gateRequests.length}
                visitorName={firstGateRequest.visitorName}
                detail={gateKindLabels[firstGateRequest.kind]}
                href={`/society/visitors#${gateRequests.length === 1 ? `visit-${firstGateRequest.id}` : "gate-entry-requests"}`}
                linkLabel={gateRequests.length === 1 ? "Review entry request" : "Review entry requests"}
              />
            )}
          </div>
        )}
        {verified && live.length === 0 && <div className="sr-only"><AutoRefresh intervalMs={8_000} /></div>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex flex-col gap-5 min-w-0">
            {confirmed.length > 0 && (
              <Link
                href={`/deal/${confirmed[0].id}`}
                className="card jd-lift p-3.5 bg-save-50 border-save-500/30 flex items-center gap-3"
              >
                <span aria-hidden="true" className="w-2.5 h-2.5 shrink-0 rounded-full bg-save-600" />
                <p className="text-sm font-bold text-save-700 flex-1 min-w-0">
                  {confirmed[0].sku.name} confirmed — {confirmed[0].basisCount} {confirmed[0].basisLabel}, one vendor
                </p>
                <span aria-hidden="true" className="text-save-700 font-bold">›</span>
              </Link>
            )}

            {/* ------------------------------------------------ hero */}
            {pinned ? (
              <section className="jd-band p-5 sm:p-7" aria-labelledby="pinned-notice-title">
                <p className="jd-band__kicker">
                  <Icon name="megaphone" size={15} />
                  {t("feed.announcement", "Society announcement")}
                </p>
                <h2 id="pinned-notice-title" className="text-[22px] sm:text-[28px] font-extrabold leading-tight tracking-tight mt-2 break-words">
                  {pinned.title}
                </h2>
                <p className="jd-band__muted text-[14px] sm:text-[15px] mt-2 line-clamp-3 whitespace-pre-line break-words max-w-[60ch]">
                  {pinned.body}
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  <Link href={`/society/community#notice-${pinned.id}`} className="btn jd-btn-lime">
                    Read notice <span aria-hidden="true">›</span>
                  </Link>
                  {pinned.dealId && (
                    <Link href={`/deal/${pinned.dealId}`} className="btn jd-btn-ghost-light">
                      View group booking
                    </Link>
                  )}
                </div>
              </section>
            ) : (
              <section className="jd-band p-5 sm:p-7" aria-labelledby="featured-title">
                {featured && <p className="jd-band__kicker">Featured group · {formatDate(featured.serviceDate)}</p>}
                <h2 id="featured-title" className="text-[22px] sm:text-[28px] font-extrabold leading-tight tracking-tight mt-2">
                  {featured ? featured.sku.name : "Start the first group in your society"}
                </h2>
                <p className="jd-band__muted text-[14px] sm:text-[15px] mt-2 max-w-[56ch]">
                  {featured
                    ? `${featured.basisCount} ${featured.basisLabel} have joined. ${
                        featured.nextSlab
                          ? `${featured.nextSlab.away} more and everyone pays ${rupees(featured.nextSlab.pricePaise)}.`
                          : "Best price unlocked."
                      }`
                    : "Pick a service, set a date, and share it in your society WhatsApp group."}
                </p>
                {featured && (
                  <p className="mt-4 flex items-baseline gap-2 flex-wrap">
                    <span className="tnum text-[32px] font-extrabold leading-none text-[#dce99e]">
                      {rupees(featured.currentPricePaise)}
                    </span>
                    <span className="jd-band__muted text-sm">per {featured.sku.unitLabel}</span>
                    {featured.currentPricePaise < featured.listPricePaise && (
                      <span className="jd-band__muted text-sm line-through tnum">
                        <span className="sr-only">Usual price </span>
                        {rupees(featured.listPricePaise)}
                      </span>
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-5">
                  <Link href={featured ? `/deal/${featured.id}` : "/create"} className="btn jd-btn-lime">
                    {featured ? "See the group" : t("feed.startGroup", "Start a group")} <span aria-hidden="true">›</span>
                  </Link>
                  {featured && (
                    <Link href="/explore" className="btn jd-btn-ghost-light">
                      Browse services
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* --------------------------------------- quick actions */}
            <nav aria-label="Quick actions" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <QuickAction primary href="/create" icon="plus" label={t("feed.startGroup", "Start a group")} note="Pick a service and a date" />
              <QuickAction href="/explore" icon="explore" label={t("nav.explore", "Explore")} note="All group services" />
              {verified ? (
                <QuickAction href="/society/visitors" icon="gate" label="Visitors" note="Approve or invite a guest" />
              ) : (
                <QuickAction href="/onboarding" icon="shield" label="Verify your flat" note="Needed to join groups" />
              )}
              <QuickAction href="/bookings" icon="bookings" label={t("nav.bookings", "Bookings")} note="Visits, codes and receipts" />
            </nav>

            {pending.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="home-pending">
                <SectionHeader id="home-pending" title={t("feed.awaitingApproval", "Awaiting committee approval")} />
                <div className="jd-card-grid">
                  {pending.map((d) => <DealCard key={d.id} deal={d} />)}
                </div>
              </section>
            )}

            {live.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="home-live">
                <SectionHeader
                  id="home-live"
                  title={t("feed.filling", "Filling now")}
                  aside={<AutoRefresh intervalMs={verified ? 8_000 : 25_000} />}
                />
                <div className="jd-card-grid">
                  {live.map((d) => <DealCard key={d.id} deal={d} />)}
                </div>
              </section>
            )}

            {confirmed.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="home-confirmed">
                <SectionHeader id="home-confirmed" title={t("feed.confirmed", "Confirmed")} />
                <div className="jd-card-grid">
                  {confirmed.map((d) => <DealCard key={d.id} deal={d} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="home-earlier">
                <SectionHeader id="home-earlier" title={t("feed.earlier", "Earlier")} />
                <div className="jd-card-grid">
                  {past.map((d) => <DealCard key={d.id} deal={d} />)}
                </div>
              </section>
            )}
          </div>

          {/* ------------------------------------- secondary surfaces */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Your society at a glance">
            <section className="card p-4 sm:p-5">
              <p className="eyebrow mb-1">{t("feed.savedSoFar", "Your society so far")}</p>
              <p className="tnum text-[30px] font-extrabold tracking-tight text-save-700">{rupees(saved)}</p>
              <p className="text-[13px] text-ink-500">
                {t("feed.savedCaption", "saved by booking together instead of flat by flat.")}
              </p>
            </section>

            {repeats.length > 0 && (
              <section className="flex flex-col gap-2" aria-labelledby="home-repeats">
                <SectionHeader as="h2" id="home-repeats" title="Your society repeats these" />
                <ul className="card divide-y divide-line overflow-hidden">
                  {repeats.map((r) => (
                    <li key={r.sku.id}>
                      <Link href={`/create?sku=${r.sku.id}`} className="p-3.5 flex items-center justify-between gap-3 hover:bg-canvas-alt">
                        <span className="min-w-0">
                          <span className="block font-bold text-sm">{r.sku.name}</span>
                          <span className="block text-[12px] text-ink-500">
                            {r.overdue ? "Due now" : `Due ${formatDate(r.dueAt)}`} · every {r.sku.repeatMonths} months
                          </span>
                        </span>
                        <span className={`pill shrink-0 ${r.overdue ? "bg-warn-50 text-warn-600" : "bg-canvas-alt text-ink-500"}`}>
                          {r.overdue ? "Start it" : "Later"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {suggestions.length > 0 && (
              <section className="flex flex-col gap-2" aria-labelledby="home-suggested">
                <SectionHeader
                  id="home-suggested"
                  title={`${t("feed.suggested", "Suggested for")} ${me.residency.societyName}`}
                />
                <ul className="card divide-y divide-line overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <Link href={`/create?sku=${s.id}`} className="p-3.5 flex items-center justify-between gap-3 hover:bg-canvas-alt">
                        <span className="min-w-0">
                          <span className="block font-bold text-sm">{s.name}</span>
                          <span className="block text-[12px] text-ink-500">
                            {rupees(s.listPricePaise)} solo · down to {rupees(s.defaultSlabs.at(-1)!.pricePaise)} in a group ·{" "}
                            {s.season}
                          </span>
                        </span>
                        <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center">
                          <Icon name="plus" size={16} />
                        </span>
                        <span className="sr-only">Start a group</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        <div className="h-2" />
      </div>

      <TabBar active="home" t={t} />
    </Phone>
  );
}
