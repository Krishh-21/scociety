import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { feed, listSkus, repeatSuggestions, societySavings } from "@/lib/deals";
import { formatDate, rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { AppHeader, DealCard, Phone, SectionHeader, TabBar } from "@/components/ui";
import AutoRefresh from "@/components/AutoRefresh";
import { translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  if (!isDemoMode()) notFound();
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.residency?.status !== "verified") redirect("/onboarding");
  const t = translator(me.user.lang);
  const { societyId } = me.residency;
  const [skus, { live, pending, confirmed, past }, saved, repeats] = await Promise.all([
    listSkus(), feed(societyId, me.user.id), societySavings(societyId), repeatSuggestions(societyId),
  ]);

  return (
    <Phone wide>
      <AppHeader
        title={t("nav.explore", "Services")}
        subtitle={`Group bookings for ${me.residency.societyName}`}
        right={
          <Link href="/bookings" className="btn btn-quiet min-h-10 px-4 text-[13px]">
            {t("nav.bookings", "Bookings")}
          </Link>
        }
      />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-[13.5px] text-ink-700 max-w-[62ch]">
            Group prices fall as more flats join. Join a group that&apos;s already filling, or start one and share it with
            your neighbours.
          </p>
          <p className="text-[13px] text-ink-500">
            <span className="sr-only">{t("feed.savedSoFar", "Your society so far")}: </span>
            <strong className="tnum text-save-700 text-[15px]">{rupees(saved)}</strong>{" "}
            {t("feed.savedCaption", "saved by booking together instead of flat by flat.")}
          </p>
        </div>

        {live.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="explore-live">
            <SectionHeader
              id="explore-live"
              title={t("feed.filling", "Filling now")}
              aside={<AutoRefresh intervalMs={8_000} />}
            />
            <div className="jd-card-grid">
              {live.map((d) => <DealCard key={d.id} deal={d} />)}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="explore-pending">
            <SectionHeader id="explore-pending" title={t("feed.awaitingApproval", "Awaiting committee approval")} />
            <div className="jd-card-grid">
              {pending.map((d) => <DealCard key={d.id} deal={d} />)}
            </div>
          </section>
        )}

        {confirmed.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="explore-confirmed">
            <SectionHeader id="explore-confirmed" title={t("feed.confirmed", "Confirmed")} />
            <div className="jd-card-grid">
              {confirmed.map((d) => <DealCard key={d.id} deal={d} />)}
            </div>
          </section>
        )}

        {repeats.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="explore-repeats">
            <SectionHeader id="explore-repeats" title="Your society repeats these" />
            <ul className="card divide-y divide-line overflow-hidden">
              {repeats.map((r) => (
                <li key={r.sku.id}>
                  <Link href={`/create?sku=${r.sku.id}`} className="p-3.5 flex items-center justify-between gap-3 hover:bg-canvas-alt min-h-14">
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

        <section className="flex flex-col gap-3" aria-labelledby="explore-catalogue">
        <SectionHeader id="explore-catalogue" title="All services" />
        <ul className="jd-card-grid">
          {skus.map((s) => {
            const open = live.find((d) => d.skuId === s.id);
            const best = s.defaultSlabs.at(-1)!;
            return (
              <li key={s.id} className="card p-4 sm:p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="eyebrow truncate">{s.category} · {s.season}</p>
                  {open && <span className="pill shrink-0 bg-brand-50 text-brand-700">Filling now</span>}
                </div>
                <h2 className="font-extrabold text-[17px] leading-snug tracking-tight">{s.name}</h2>
                <div className="flex items-end gap-x-2 gap-y-0.5 flex-wrap my-3">
                  <span className="tnum text-[26px] leading-none font-extrabold text-save-700">{rupees(best.pricePaise)}</span>
                  <span className="text-[13px] text-ink-500">
                    per {s.unitLabel} at {best.minFlats}+ flats
                  </span>
                  <span className="tnum text-ink-500 line-through text-sm">
                    <span className="sr-only">Solo price </span>{rupees(s.listPricePaise)}
                  </span>
                </div>
                <ul className="text-[13px] text-ink-700 flex flex-col gap-1.5 mb-4">
                  {s.included.slice(0, 3).map((x) => (
                    <li key={x} className="flex gap-2">
                      <span aria-hidden="true" className="text-save-600 font-bold">✓</span>
                      {x}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {open ? (
                    <Link href={`/deal/${open.id}`} className="btn btn-save w-full min-h-11 text-[14px]">
                      Join the live group · {open.flatsJoined}/{open.targetFlats} flats
                    </Link>
                  ) : (
                    <Link href={`/create?sku=${s.id}`} className="btn btn-primary w-full min-h-11 text-[14px]">
                      Start a group<span className="sr-only"> for {s.name}</span>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        </section>

        {past.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="explore-earlier">
            <SectionHeader id="explore-earlier" title={t("feed.earlier", "Earlier")} />
            <div className="jd-card-grid">
              {past.map((d) => <DealCard key={d.id} deal={d} />)}
            </div>
          </section>
        )}
        <div className="h-4" />
      </div>
      <TabBar active="explore" t={t} context={{ society: me.residency.societyName, flat: me.residency.flat }} />
    </Phone>
  );
}
