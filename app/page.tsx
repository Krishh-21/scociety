import Link from "next/link";
import { redirect } from "next/navigation";
import { feed, listSkus, repeatSuggestions, societySavings } from "@/lib/deals";
import { formatDate, rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { translator } from "@/lib/i18n";
import { getPinnedNotice } from "@/lib/society-community";
import { AppHeader, DealCard, NotificationBell, Phone, TabBar } from "@/components/ui";
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
  const { live, pending, confirmed, past } = feed(me.residency.societyId, me.user.id);
  const saved = societySavings(me.residency.societyId);
  const repeats = repeatSuggestions(me.residency.societyId);
  const suggestions = listSkus().filter((s) => !live.some((d) => d.skuId === s.id)).slice(0, 3);
  const unread = unreadCount(me.user.id);
  const pinned = me.residency.status === "verified" ? getPinnedNotice(me.residency.societyId) : null;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("feed.goodMorning", "Good morning")
      : hour < 17 ? t("feed.goodAfternoon", "Good afternoon")
        : t("feed.goodEvening", "Good evening");

  return (
    <Phone>
      <AppHeader
        title={`${greeting}, ${me.user.name.split(" ")[0]}`}
        subtitle={`● ${me.residency.societyName} · ${me.residency.flat}`}
        right={
          <div className="flex items-center gap-2">
            <NotificationBell unread={unread} />
            <Link href="/profile" className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 grid place-items-center font-bold">
              {me.user.name.slice(0, 1)}
            </Link>
          </div>
        }
      />

      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        {confirmed.length > 0 && (
          <Link href={`/deal/${confirmed[0].id}`} className="card p-3 bg-save-50 border-save-500/30 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-save-600" />
            <p className="text-sm font-bold text-save-700 flex-1">
              {confirmed[0].sku.name} confirmed — {confirmed[0].basisCount} {confirmed[0].basisLabel}, one vendor
            </p>
            <span className="text-save-700 font-bold">›</span>
          </Link>
        )}

        {pinned && (
          <section className="card p-4 bg-brand-50 border-brand-500/20">
            <p className="eyebrow text-brand-700 mb-1">{t("feed.announcement", "Society announcement")}</p>
            <h2 className="text-[19px] font-extrabold text-brand-700 leading-snug">{pinned.title}</h2>
            <p className="text-[13px] text-ink-700 mt-1 line-clamp-3 whitespace-pre-line break-words">{pinned.body}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-[13px] font-bold text-brand-700">
              <Link href={`/society/community#notice-${pinned.id}`}>Read notice <span aria-hidden="true">›</span></Link>
              {pinned.dealId && <Link href={`/deal/${pinned.dealId}`}>View group booking <span aria-hidden="true">›</span></Link>}
            </div>
          </section>
        )}
        {!pinned && <Link
          href={live[0] ? `/deal/${live[0].id}` : "/create"}
          className="card p-4 bg-brand-50 border-brand-500/20 block hover:shadow-md transition-shadow"
        >
          {live[0] && <p className="eyebrow text-brand-700 mb-1">Featured group</p>}
          <h2 className="text-[19px] font-extrabold text-brand-700 leading-snug">
            {live[0] ? live[0].sku.name : "Start the first group in your society"}
          </h2>
          <p className="text-[13px] text-ink-700 mt-1">
            {live[0]
              ? `${live[0].basisCount} ${live[0].basisLabel} have joined. ${
                  live[0].nextSlab
                    ? `${live[0].nextSlab.away} more and everyone pays ${rupees(live[0].nextSlab.pricePaise)}.`
                    : "Best price unlocked."
                }`
              : "Pick a service, set a date, and share it in your society WhatsApp group."}
          </p>
          <p className="text-[13px] font-bold text-brand-700 mt-2">{live[0] ? "See the group →" : "Start a group →"}</p>
        </Link>}

        {pending.length > 0 && (
          <>
            <p className="eyebrow mt-2">{t("feed.awaitingApproval", "Awaiting committee approval")}</p>
            {pending.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </>
        )}

        {live.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-2">
              <p className="eyebrow">{t("feed.filling", "Filling now")}</p>
              <AutoRefresh intervalMs={25_000} />
            </div>
            {live.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </>
        )}

        {confirmed.length > 0 && (
          <>
            <p className="eyebrow mt-2">{t("feed.confirmed", "Confirmed")}</p>
            {confirmed.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </>
        )}

        <Link href="/create" className="btn btn-primary w-full mt-2">
          {t("feed.startGroup", "Start a group")}
        </Link>

        {repeats.length > 0 && (
          <>
            <p className="eyebrow mt-4">Your society repeats these</p>
            <div className="flex flex-col gap-2">
              {repeats.map((r) => (
                <Link key={r.sku.id} href={`/create?sku=${r.sku.id}`} className="card p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{r.sku.name}</p>
                    <p className="text-[12px] text-ink-500">
                      {r.overdue ? "Due now" : `Due ${formatDate(r.dueAt)}`} · every {r.sku.repeatMonths} months
                    </p>
                  </div>
                  <span className={`pill ${r.overdue ? "bg-warn-50 text-warn-600" : "bg-canvas-alt text-ink-500"}`}>
                    {r.overdue ? "Start it" : "Later"}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {suggestions.length > 0 && (
          <>
            <p className="eyebrow mt-4">
              {t("feed.suggested", "Suggested for")} {me.residency.societyName}
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <Link key={s.id} href={`/create?sku=${s.id}`} className="card p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{s.name}</p>
                    <p className="text-[12px] text-ink-500">
                      {rupees(s.listPricePaise)} solo · down to {rupees(s.defaultSlabs.at(-1)!.pricePaise)} in a group ·{" "}
                      {s.season}
                    </p>
                  </div>
                  <span className="text-brand-700 font-bold">+</span>
                </Link>
              ))}
            </div>
          </>
        )}

        <section className="card p-4 mt-4">
          <p className="eyebrow mb-1">{t("feed.savedSoFar", "Your society so far")}</p>
          <p className="tnum text-[26px] font-extrabold text-save-700">{rupees(saved)}</p>
          <p className="text-[13px] text-ink-500">
            {t("feed.savedCaption", "saved by booking together instead of flat by flat.")}
          </p>
        </section>

        {past.length > 0 && (
          <>
            <p className="eyebrow mt-4">{t("feed.earlier", "Earlier")}</p>
            {past.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </>
        )}

        <div className="h-4" />
      </div>

      <TabBar active="home" t={t} />
    </Phone>
  );
}
