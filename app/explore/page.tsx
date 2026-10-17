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
  const skus = listSkus();
  const { live } = feed(me.residency.societyId, me.user.id);

  return (
    <Phone>
      <AppHeader title="Services" subtitle="Everything your building can book together" />
      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        {skus.map((s) => {
          const open = live.find((d) => d.skuId === s.id);
          const best = s.defaultSlabs.at(-1)!;
          return (
            <article key={s.id} className="card p-4">
              <p className="eyebrow mb-1">{s.category} · {s.season}</p>
              <h2 className="font-bold text-[16px]">{s.name}</h2>
              <div className="flex items-end gap-2 my-2">
                <span className="tnum text-[22px] font-extrabold text-save-700">{rupees(best.pricePaise)}</span>
                <span className="text-[13px] text-ink-500 pb-1">
                  per {s.unitLabel} at {best.minFlats}+ flats
                </span>
                <span className="tnum text-ink-300 line-through pb-1 text-sm">{rupees(s.listPricePaise)}</span>
              </div>
              <ul className="text-[13px] text-ink-700 flex flex-col gap-1 mb-3">
                {s.included.slice(0, 3).map((x) => (
                  <li key={x}>✓ {x}</li>
                ))}
              </ul>
              {open ? (
                <Link href={`/deal/${open.id}`} className="btn btn-save w-full h-11 min-h-11 text-[14px]">
                  Join the live group · {open.flatsJoined}/{open.targetFlats} flats
                </Link>
              ) : (
                <Link href={`/create?sku=${s.id}`} className="btn btn-primary w-full h-11 min-h-11 text-[14px]">
                  Start a group
                </Link>
              )}
            </article>
          );
        })}
        <div className="h-4" />
      </div>
      <TabBar active="explore" t={t} />
    </Phone>
  );
}
