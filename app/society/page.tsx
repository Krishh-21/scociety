import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { all } from "@/lib/db";
import { feed, listVendors, societySavings } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { AppHeader, DealCard, Icon, type IconName, Phone, SectionHeader, StatTile, TabBar } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { ApproveDealForm } from "@/components/forms";
import { can } from "@/lib/authz";
import { complaintSummary } from "@/lib/society-complaints";
import { financeDateLabel, financeMoney, financeSummary, financeToday } from "@/lib/society-finance";
import { gateSummary } from "@/lib/society-gate";

export const dynamic = "force-dynamic";

const SOCIETY_TOOLS: { href: string; label: string; description: string; icon: IconName }[] = [
  { href: "/society/complaints", label: "Complaints", description: "Report and track building issues.", icon: "wrench" },
  { href: "/society/community", label: "Notices & meetings", description: "Read updates, vote, and book amenities.", icon: "megaphone" },
  { href: "/society/visitors", label: "Visitors", description: "Approve arrivals and create guest passes.", icon: "gate" },
  { href: "/society/finance", label: "Maintenance & accounts", description: "See dues and receipts.", icon: "wallet" },
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
  const [{ live, pending, confirmed, past }, neighbours, vendors] = await Promise.all([
    feed(societyId, me.user.id),
    all<{ name: string; flat: string }>(
      `SELECT u.name, r.flat FROM residency r JOIN user u ON u.id = r.userId
       WHERE r.societyId = ? AND r.status = 'verified' ORDER BY r.flat`,
      societyId,
    ),
    listVendors(),
  ]);
  const [saved, pendingGroups] = await Promise.all([
    societySavings(societyId),
    Promise.all(pending.map(async (deal) => ({
      deal,
      canApprove: await can(me, { kind: "deal.approve", dealId: deal.id }),
    }))),
  ]);
  const completed = past.filter((d) => d.status === "completed");
  const [finances, thisMonth, complaints, gate] = committee ? await Promise.all([
    financeSummary(societyId),
    financeSummary(societyId, financeToday().slice(0, 7)),
    complaintSummary(societyId),
    gateSummary(societyId),
  ]) : [null, null, null, null];
  const dashboard = finances ? [
    { label: "This month’s dues collected", value: financeMoney(thisMonth?.collectedPaise ?? 0), href: "/society/finance" },
    { label: "Dues outstanding", value: financeMoney(finances.outstandingPaise), href: "/society/finance" },
    { label: "Open complaints", value: String(complaints?.openComplaints ?? 0), href: "/society/complaints" },
    { label: "Visitors today", value: String(gate?.visitorsToday ?? 0), href: "/society/visitors#society-gate-activity" },
  ] : [];

  return (
    <Phone wide>
      <AppHeader title={me.residency.societyName} subtitle={`${neighbours.length} verified neighbours`} />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-5">
        <nav aria-label="Society tools" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {SOCIETY_TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="jd-action">
              <span className="jd-action__icon bg-brand-50 text-brand-700" aria-hidden="true">
                <Icon name={tool.icon} size={20} />
              </span>
              <span className="mt-auto">
                <span className="block text-[15px] font-extrabold leading-tight">
                  {tool.label} <span aria-hidden="true">›</span>
                </span>
                <span className="block mt-0.5 text-[12px] text-ink-500 leading-snug">{tool.description}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex flex-col gap-5 min-w-0">
            {committee && (
              <section className="card p-4 sm:p-5" aria-labelledby="committee-dashboard">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 id="committee-dashboard" className="jd-section-title">Committee dashboard</h2>
                  <Link href="/society/guard-access" className="inline-flex min-h-10 items-center text-sm font-bold text-brand-700">
                    Manage guard access <span aria-hidden="true" className="ms-1">›</span>
                  </Link>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {dashboard.map((card) => (
                    <StatTile key={card.label} label={card.label} value={card.value} href={card.href} />
                  ))}
                </div>
                {finances && (
                  <div className="mt-2.5">
                    <StatTile
                      label="Reported bank balance"
                      value={finances.bankBalancePaise === null ? "Record a balance" : financeMoney(finances.bankBalancePaise)}
                      note={finances.bankBalanceOn ? `As of ${financeDateLabel(finances.bankBalanceOn)}` : undefined}
                      href="/society/finance"
                    />
                  </div>
                )}
              </section>
            )}

            {pending.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="society-pending">
                <SectionHeader id="society-pending" title="Waiting for approval" />
                <div className="jd-card-grid">
                  {pendingGroups.map(({ deal: d, canApprove }) => (
                    <div key={d.id} className="flex flex-col gap-2">
                      <DealCard deal={d} />
                      {canApprove && <ApproveDealForm dealId={d.id} />}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="card p-4 sm:p-5" aria-labelledby="society-vendors">
              <h2 id="society-vendors" className="jd-section-title mb-3">Society-approved vendors</h2>
              <ul className="flex flex-col divide-y divide-line">
                {vendors.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{v.name}</p>
                      <p className="text-[12px] text-ink-500">
                        ★ {v.rating} · {v.jobsDone.toLocaleString("en-IN")} jobs
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap sm:justify-end">
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
          </div>

          <aside className="flex flex-col gap-5" aria-label="Society at a glance">
            <section className="jd-band p-5 sm:p-6" aria-labelledby="society-saved">
              <p id="society-saved" className="jd-band__kicker">Saved by booking together</p>
              <p className="tnum text-[34px] font-extrabold tracking-tight mt-1 text-[#dce99e]">{rupees(saved)}</p>
              <dl className="grid grid-cols-3 gap-2 mt-4 text-center">
                {[
                  [live.length, "filling"],
                  [confirmed.length, "confirmed"],
                  [completed.length, "completed"],
                ].map(([n, label]) => (
                  <div key={String(label)} className="rounded-xl bg-white/10 px-2 py-2.5 flex flex-col-reverse">
                    <dt className="text-[12px] jd-band__muted">{label}</dt>
                    <dd className="tnum text-[20px] font-extrabold">{n}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="card p-4 sm:p-5" aria-labelledby="society-neighbours">
              <h2 id="society-neighbours" className="jd-section-title mb-3">Verified neighbours</h2>
              <ul className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-3 gap-y-1.5">
                {neighbours.map((n) => (
                  <li key={n.flat} className="text-[13px] text-ink-700 truncate">
                    {n.name} <span className="text-ink-500">· {n.flat}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
        <div className="h-4" />
      </div>
      <TabBar active="society" t={translator(me.user.lang)} />
    </Phone>
  );
}
