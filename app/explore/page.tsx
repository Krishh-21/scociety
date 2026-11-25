import Link from "next/link";
import { redirect } from "next/navigation";
import { feed, listSkus } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import { translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.residency) redirect("/onboarding");
  const t = translator(me.user.lang);
  const [skus, { live }] = await Promise.all([listSkus(), feed(me.residency.societyId, me.user.id)]);

  return (
    <Phone wide>
      <AppHeader title="Services" subtitle="Everything your building can book together" />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-4">
        <p className="text-[13px] text-ink-500 max-w-[62ch]">
          Group prices fall as more flats join. Join a group that&apos;s already filling, or start one and share it with
          your neighbours.
        </p>
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
        <div className="h-4" />
      </div>
      <TabBar active="explore" t={t} />
    </Phone>
  );
}
