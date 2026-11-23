import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { all } from "@/lib/db";
import { feed, listVendors, societySavings } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { AppHeader, DealCard, Phone, TabBar } from "@/components/ui";
import { ApproveDealForm } from "@/components/forms";
import { can } from "@/lib/authz";
import { complaintSummary } from "@/lib/society-complaints";
import { financeDateLabel, financeMoney, financeSummary, financeToday } from "@/lib/society-finance";
import { gateSummary } from "@/lib/society-gate";

export const dynamic = "force-dynamic";

const SOCIETY_TOOLS = [
  { href: "/society/complaints", label: "Complaints", description: "Report and track building issues." },
  { href: "/society/community", label: "Notices & meetings", description: "Read updates, vote, and book amenities." },
  { href: "/society/visitors", label: "Visitors", description: "Approve arrivals and create guest passes." },
  { href: "/society/finance", label: "Maintenance & accounts", description: "See dues and receipts." },
];

export default async function SocietyPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (me.user.role !== "resident" && me.user.role !== "secretary") notFound();
  if (!me.residency) redirect("/onboarding");
  if (me.residency.status !== "verified") notFound();

  const committee = me.user.role === "secretary";
  const societyId = me.residency.societyId;
  const neighbours = all<{ name: string; flat: string }>(
    `SELECT u.name, r.flat FROM residency r JOIN user u ON u.id = r.userId
     WHERE r.societyId = ? AND r.status = 'verified' ORDER BY r.flat`,
    me.residency.societyId,
  );
  const { live, pending, confirmed, past } = feed(me.residency.societyId, me.user.id);
  const saved = societySavings(me.residency.societyId);
  const vendors = listVendors();
  const completed = past.filter((d) => d.status === "completed");
  const finances = committee ? financeSummary(societyId) : null;
  const thisMonth = committee ? financeSummary(societyId, financeToday().slice(0, 7)) : null;
  const dashboard = finances ? [
    { label: "This month’s dues collected", value: financeMoney(thisMonth?.collectedPaise ?? 0), href: "/society/finance" },
    { label: "Dues outstanding", value: financeMoney(finances.outstandingPaise), href: "/society/finance" },
    { label: "Open complaints", value: String(complaintSummary(societyId).openComplaints), href: "/society/complaints" },
    { label: "Visitors today", value: String(gateSummary(societyId).visitorsToday), href: "/society/visitors#society-gate-activity" },
  ] : [];

  return (
    <Phone>
      <AppHeader title={me.residency.societyName} subtitle={`${neighbours.length} verified neighbours`} />
      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        {committee && (
          <section className="card p-4">
            <h2 className="font-extrabold mb-3">Committee dashboard</h2>
            <div className="grid grid-cols-2 gap-2">
              {dashboard.map((card) => (
                <Link key={card.label} href={card.href} className="card p-3 hover:border-brand-500">
                  <p className="text-[12px] text-ink-500">{card.label}</p>
                  <p className="mt-0.5 tnum text-xl font-extrabold">{card.value}</p>
                </Link>
              ))}
            </div>
            {finances && (
              <Link href="/society/finance" className="card p-3 mt-2 block hover:border-brand-500">
                <p className="text-[12px] text-ink-500">Reported bank balance</p>
                <p className="mt-0.5 tnum text-xl font-extrabold">
                  {finances.bankBalancePaise === null ? "Record a balance" : financeMoney(finances.bankBalancePaise)}
                </p>
                {finances.bankBalanceOn && <p className="text-[12px] text-ink-500 mt-1">As of {financeDateLabel(finances.bankBalanceOn)}</p>}
              </Link>
            )}
            <Link href="/society/guard-access" className="mt-3 inline-block text-sm font-bold text-brand-700">Manage guard access <span aria-hidden="true">›</span></Link>
          </section>
        )}
        <nav aria-label="Society tools" className="grid grid-cols-2 gap-2">
          {SOCIETY_TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="card p-3 hover:border-brand-500">
              <p className="font-bold text-sm text-brand-700">{tool.label} <span aria-hidden="true">›</span></p>
              <p className="mt-1 text-[12px] text-ink-500">{tool.description}</p>
            </Link>
          ))}
        </nav>
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
