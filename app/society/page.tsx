import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { feed, listVendors, societySavings } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { AppHeader, DealCard, Phone, TabBar } from "@/components/ui";
import { ApproveDealForm } from "@/components/forms";
import { can } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function SocietyPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.residency) redirect("/onboarding");

  const neighbours = all<{ name: string; flat: string }>(
    `SELECT u.name, r.flat FROM residency r JOIN user u ON u.id = r.userId
     WHERE r.societyId = ? AND r.status = 'verified' ORDER BY r.flat`,
    me.residency.societyId,
  );
  const { live, pending, confirmed, past } = feed(me.residency.societyId, me.user.id);
  const saved = societySavings(me.residency.societyId);
  const vendors = listVendors();
  const completed = past.filter((d) => d.status === "completed");

  return (
    <Phone>
      <AppHeader title={me.residency.societyName} subtitle={`${neighbours.length} verified neighbours`} />
      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        <section className="card p-4">
          <p className="eyebrow mb-1">Saved by booking together</p>
          <p className="tnum text-[30px] font-extrabold text-save-700">{rupees(saved)}</p>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            {[
              [live.length, "filling"],
              [confirmed.length, "confirmed"],
              [completed.length, "completed"],
            ].map(([n, label]) => (
              <div key={String(label)} className="card p-2">
                <p className="tnum text-[20px] font-extrabold">{n}</p>
                <p className="text-[12px] text-ink-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {me.user.role === "secretary" && (
          <section className="card p-4 bg-brand-50 border-brand-500/20">
            <p className="eyebrow text-brand-700 mb-1">Committee tools</p>
            <p className="text-[13px] text-ink-700">
              Groups in this society go live once you approve them. You can also stop work on any job in progress.
            </p>
          </section>
        )}

        {pending.length > 0 && (
          <section className="flex flex-col gap-2">
            <p className="eyebrow">Waiting for approval</p>
            {pending.map((d) => (
              <div key={d.id} className="flex flex-col gap-2">
                <DealCard deal={d} />
                {can(me, { kind: "deal.approve", dealId: d.id }) && <ApproveDealForm dealId={d.id} />}
              </div>
            ))}
          </section>
        )}

        <section className="card p-4">
          <p className="eyebrow mb-3">Society-approved vendors</p>
          <ul className="flex flex-col gap-2">
            {vendors.map((v) => (
              <li key={v.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{v.name}</p>
                  <p className="text-[12px] text-ink-500">
                    ★ {v.rating} · {v.jobsDone.toLocaleString("en-IN")} jobs
                  </p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[160px]">
                  {v.badges.map((b) => (
                    <span key={b} className="pill bg-canvas-alt text-ink-700">
                      {b}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-4">
          <p className="eyebrow mb-3">Verified neighbours</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {neighbours.map((n) => (
              <li key={n.flat} className="text-[13px] text-ink-700 truncate">
                {n.name} <span className="text-ink-300">· {n.flat}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="h-4" />
      </div>
      <TabBar active="society" />
    </Phone>
  );
}
