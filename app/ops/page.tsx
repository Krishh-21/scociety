import Link from "next/link";
import { redirect } from "next/navigation";
import { openDisputes, opsBoard, recentEvents, revisitsForOps } from "@/lib/deals";
import { formatRevisitDate } from "@/lib/revisits";
import { funnel } from "@/lib/analytics";
import { countdown, formatDate, rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { can } from "@/lib/authz";
import ConsoleGate from "@/components/ConsoleGate";
import {
  ApproveDealForm, LeadStatusForm, OpsDealActions, ResetDemoButton, ResolveDisputeForm, SimulateJoins,
} from "@/components/forms";
import { listLeads } from "@/lib/leads";
import { timeAgo } from "@/lib/pricing";
import { ConsoleHeader, StatTile, StatusPill } from "@/components/ui";
import { signOut } from "@/app/actions";

export const dynamic = "force-dynamic";

const revisitStatusLabels = {
  awaiting_schedule: "Awaiting scheduling",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};

export default async function OpsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!(await can(me, { kind: "console.ops" }))) {
    return <ConsoleGate console="ops" phone="9000000099" you={me.user.name} />;
  }
  const { deals, atRisk, pending, gmvPaise, commissionPaise, refundsPaise, fillRate } = await opsBoard();
  const [disputes, allRevisits, f, events, leads, demo] = await Promise.all([
    openDisputes(), revisitsForOps(), funnel(), recentEvents(15), listLeads(30), can(me, { kind: "demo.reset" }),
  ]);
  const openIssues = disputes.filter((d) => d.status === "open");
  const revisits = allRevisits.filter((visit) => visit.status !== "completed");
  const open = deals.filter((d) => d.status === "open");
  const medianFlats = (() => {
    const closed = deals.filter((d) => ["locked", "in_progress", "completed"].includes(d.status));
    if (!closed.length) return 0;
    const sorted = closed.map((d) => d.flatsJoined).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  })();

  return (
    <main className="min-h-screen bg-canvas">
      <ConsoleHeader
        eyebrow="JODO ops console"
        title="Deals board"
        actions={
          <>
            <Link href="/" className="btn jd-btn-ghost-light min-h-10 text-[13px]">
              Resident app
            </Link>
            <Link href="/vendor" className="btn jd-btn-ghost-light min-h-10 text-[13px]">
              Vendor console
            </Link>
            <form action={signOut}>
              <button className="btn jd-btn-ghost-light min-h-10 text-[13px]">Sign out</button>
            </form>
          </>
        }
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["GMV booked", rupees(gmvPaise)],
            ["Commission @15%", rupees(commissionPaise)],
            ["Fill rate", `${fillRate}%`],
            ["Median flats / deal", String(medianFlats)],
            ["Deals at risk", String(atRisk.length)],
            ["Refunds paid", rupees(refundsPaise)],
            ["Open issues", String(openIssues.length)],
            ["Deal view → join", `${f.viewToJoinPct}%`],
          ].map(([label, value]) => (
            <StatTile key={label} label={label} value={value} />
          ))}
        </section>

        {atRisk.length > 0 && (
          <section className="card p-4 bg-warn-50 border-warn-500/30">
            <h2 className="font-extrabold mb-2 text-warn-600">At risk — below minimum with less than 48h left</h2>
            <div className="flex flex-col gap-3">
              {atRisk.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 justify-between">
                  <p className="text-sm">
                    <strong>{d.sku.name}</strong> · {d.society.name} · {d.basisCount}/{d.mvs} {d.basisLabel} ·{" "}
                    {countdown(d.msToDeadline)} left
                  </p>
                  <OpsDealActions deal={d} />
                </div>
              ))}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className="card p-4">
            <h2 className="font-extrabold mb-3">Waiting for committee approval</h2>
            <div className="flex flex-col gap-3">
              {pending.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <strong>{d.sku.name}</strong> · {d.society.name} · {formatDate(d.serviceDate)}
                  </p>
                  <div className="w-72">
                    <ApproveDealForm dealId={d.id} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {disputes.length > 0 && (
          <section className="card p-4">
            <h2 className="font-extrabold mb-3">Issues</h2>
            <div className="flex flex-col gap-4">
              {disputes.map((d) => (
                <div key={d.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold">
                        {d.reason}{" "}
                        <span className={`pill ml-1 ${d.status === "open" ? "bg-warn-50 text-warn-600" : "bg-canvas-alt text-ink-500"}`}>
                          {d.status}
                        </span>
                      </p>
                      <p className="text-[13px] text-ink-500">
                        {d.dealName} · {d.societyName} · {d.name} ({d.flat}) · at risk {rupees(d.amountPaise)}
                      </p>
                      {d.detail && <p className="text-[13px] text-ink-700 mt-1">“{d.detail}”</p>}
                      {d.resolution && <p className="text-[12px] text-save-700 mt-1">{d.resolution}</p>}
                    </div>
                  </div>
                  {d.status === "open" && <ResolveDisputeForm disputeId={d.id} />}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card p-4" aria-labelledby="revisit-follow-ups-heading">
          <h2 id="revisit-follow-ups-heading" className="font-extrabold mb-3">Revisit follow-ups</h2>
          {revisits.length === 0 ? (
            <p className="text-sm text-ink-500">No outstanding revisits.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {revisits.map((visit) => (
                <li key={visit.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{visit.serviceName} · {visit.societyName}</p>
                      <span className={`pill ${visit.status === "awaiting_schedule" ? "bg-warn-50 text-warn-600" : "bg-brand-50 text-brand-700"}`}>
                        {revisitStatusLabels[visit.status]}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-500">{visit.residentName} ({visit.flat}) · {visit.vendorName}</p>
                    {visit.serviceDate && (
                      <p className="text-[13px] text-ink-700">
                        <time dateTime={visit.serviceDate}>{formatRevisitDate(visit.serviceDate)}</time>
                        {visit.slot && ` · ${visit.slot}`}
                        {visit.technician && ` · ${visit.technician}`}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/vendor?vendor=${encodeURIComponent(visit.vendorId)}#revisit-${encodeURIComponent(visit.id)}`}
                    className="btn btn-quiet h-10 min-h-10 text-[13px]"
                    aria-label={`Open route sheet for ${visit.residentName} at ${visit.societyName}, ${visit.flat}`}
                  >
                    Open route sheet
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 id="all-deals-heading" className="font-extrabold text-[18px] mb-3">All deals</h2>
          <div className="card overflow-x-auto" role="region" aria-labelledby="all-deals-heading" tabIndex={0}>
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-canvas-alt">
                <tr className="text-left text-[12px] text-ink-500">
                  <th className="px-4 py-2 font-semibold">Deal</th>
                  <th className="font-semibold">Society</th>
                  <th className="font-semibold">Service date</th>
                  <th className="font-semibold">Bookings</th>
                  <th className="font-semibold">Price</th>
                  <th className="font-semibold">Deadline</th>
                  <th className="font-semibold">Status</th>
                  <th className="px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-t border-line align-middle">
                    <td className="px-4 py-3">
                      <Link href={`/deal/${d.id}`} className="font-bold text-brand-700">
                        {d.sku.name}
                      </Link>
                      <p className="text-[12px] text-ink-500">{d.vendor.name}</p>
                    </td>
                    <td>{d.society.name}</td>
                    <td className="tnum">{formatDate(d.serviceDate)}</td>
                    <td className="tnum">
                      {d.basisCount}
                      <span className="text-ink-300">/{d.targetFlats}</span>
                      {` ${d.basisLabel}`}
                      <span className="text-[11px] text-ink-500"> (min {d.mvs})</span>
                    </td>
                    <td className="tnum font-bold text-save-700">{rupees(d.currentPricePaise)}</td>
                    <td className="tnum text-[12px] text-ink-500">
                      {d.status === "open" ? countdown(d.msToDeadline) : "—"}
                    </td>
                    <td>
                      <StatusPill deal={d} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <OpsDealActions deal={d} />
                        {(d.status === "locked" || d.status === "in_progress") && (
                          <Link
                            href={`/vendor?vendor=${encodeURIComponent(d.vendorId)}#deal-${encodeURIComponent(d.id)}`}
                            className="btn btn-quiet h-10 min-h-10 text-[13px] whitespace-nowrap"
                            aria-label={`Open route sheet for ${d.sku.name} at ${d.society.name}`}
                          >
                            Open route sheet
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
            <h2 className="font-extrabold">Sign-ups from the website</h2>
            <p className="text-[12px] text-ink-500">
              {leads.filter((l) => l.kind === "society").length} societies ·{" "}
              {leads.filter((l) => l.kind === "vendor").length} vendors
            </p>
          </div>
          {leads.length === 0 ? (
            <p className="text-sm text-ink-500">
              Nothing yet. Requests from “Bring JODO to your society” and the partner form land here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-500">
                    <th className="py-1 font-semibold">Kind</th>
                    <th className="font-semibold">Who</th>
                    <th className="font-semibold">Society / business</th>
                    <th className="font-semibold">Detail</th>
                    <th className="font-semibold">When</th>
                    <th className="font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-t border-line align-top">
                      <td className="py-2">
                        <span className={`pill ${l.kind === "society" ? "bg-brand-50 text-brand-700" : "bg-save-50 text-save-700"}`}>
                          {l.kind}
                        </span>
                      </td>
                      <td className="py-2">
                        <p className="font-bold">{l.name}</p>
                        <p className="text-[12px] text-ink-500 tnum">{l.phone}</p>
                      </td>
                      <td className="py-2">
                        {l.org}
                        <p className="text-[12px] text-ink-500">{l.city}</p>
                      </td>
                      <td className="py-2 text-[12px] text-ink-700">
                        {l.kind === "society"
                          ? `${String(l.detail.role ?? "resident")}${l.detail.flats ? ` · ${l.detail.flats} flats` : ""}`
                          : `${(l.detail.services as string[] | undefined)?.join(", ") ?? ""}${l.detail.crew ? ` · crew ${l.detail.crew}` : ""}`}
                      </td>
                      <td className="py-2 text-[12px] text-ink-500 whitespace-nowrap">{timeAgo(l.createdAt)}</td>
                      <td className="py-2">
                        <LeadStatusForm leadId={l.id} status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-4">
          <h2 className="font-extrabold mb-2">Audit trail</h2>
          <p className="text-sm text-ink-500 mb-3">
            Every state change, append-only. This is what settles an argument about what a group was
            offering when somebody joined.
          </p>
          <ul className="flex flex-col gap-1.5 max-h-72 overflow-auto">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2 text-[13px] border-b border-line pb-1.5">
                <span className="pill bg-canvas-alt text-ink-700">{e.type}</span>
                <span className="text-ink-700">
                  {e.dealName} · {e.societyName}
                </span>
                <span className="text-ink-300 tnum ml-auto">
                  {new Date(e.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-ink-500 w-full break-all">{e.payload}</span>
              </li>
            ))}
            {!events.length && <li className="text-sm text-ink-500">No events yet.</li>}
          </ul>
        </section>

        {demo && (
          <section className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <h2 className="font-extrabold">Demo controls</h2>
              <ResetDemoButton />
            </div>
            <p className="text-sm text-ink-500 mb-3">
              Simulated joins apply the same pricing rules as resident bookings.
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              {open.map((d) => (
                <div key={d.id} className="card p-3">
                  <p className="text-sm font-bold mb-1">{d.sku.name}</p>
                  <p className="text-[12px] text-ink-500 mb-2">
                    {d.basisCount} {d.basisLabel} · {rupees(d.currentPricePaise)}
                    {d.nextSlab && ` · ${d.nextSlab.away} more → ${rupees(d.nextSlab.pricePaise)}`}
                  </p>
                  <SimulateJoins dealId={d.id} />
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="h-6" />
      </div>
    </main>
  );
}
