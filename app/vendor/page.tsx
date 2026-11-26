import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { jobsForDeal, listVendors, revisitsForVendor, vendorDeals } from "@/lib/deals";
import { commission, formatDate, rupees } from "@/lib/pricing";
import { formatRevisitDate, isRevisitDue, revisitToday } from "@/lib/revisits";
import { getMe } from "@/lib/session";
import { can } from "@/lib/authz";
import ConsoleGate from "@/components/ConsoleGate";
import { CompleteJobForm, OpsDealActions, SlabEditor, StartJobForm } from "@/components/forms";
import Countdown from "@/components/Countdown";
import { ConsoleHeader, StatTile } from "@/components/ui";
import RevisitScheduleForm from "@/components/RevisitScheduleForm";
import { signOut } from "@/app/actions";

export const dynamic = "force-dynamic";

// In a real deployment the crew gets the code from the resident at the door; the
// hint exists so one person can drive the whole demo from one browser.
const DEMO = process.env.NODE_ENV !== "production";

const REVISIT_STATUS = {
  awaiting_schedule: "Awaiting scheduling",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};

export default async function VendorPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string | string[] }>;
}) {
  if (!isDemoMode()) notFound();
  const me = await getMe();
  if (!me) redirect("/login");
  if (!(await can(me, { kind: "console.vendor" }))) {
    return <ConsoleGate console="vendor" phone="9000000010" you={me.user.name} />;
  }
  const isOps = await can(me, { kind: "console.ops" });
  const requestedVendor = isOps ? (await searchParams).vendor : me.user.vendorId;
  const vendors = (await listVendors()).sort((a, b) => a.name.localeCompare(b.name));
  const vendor = vendors.find((v) => v.id === requestedVendor) ?? (isOps ? vendors[0] : undefined);
  if (!vendor) notFound();
  const [deals, revisits] = await Promise.all([vendorDeals(vendor.id), revisitsForVendor(vendor.id)]);
  const earliestRevisitDate = revisitToday();

  const open = deals.filter((d) => d.status === "open");
  const confirmed = deals.filter((d) => d.status === "locked" || d.status === "in_progress");
  const done = deals.filter((d) => d.status === "completed");
  const confirmedVisits = await Promise.all(confirmed.map(async (deal) => ({ deal, jobs: await jobsForDeal(deal.id) })));

  const earnings = [...confirmed, ...done].reduce(
    (sum, d) => sum + d.members.reduce((s, m) => s + (m.finalPricePaise ?? d.currentPricePaise) * m.units, 0),
    0,
  );
  const commissionPaise = commission(earnings);

  return (
    <main className="min-h-screen bg-canvas">
      <ConsoleHeader
        eyebrow="Vendor console"
        title={vendor.name}
        meta={<>★ {vendor.rating} · {vendor.jobsDone.toLocaleString("en-IN")} jobs done</>}
        actions={
          <>
            {isOps && (
              <Link href="/ops" className="btn jd-btn-ghost-light min-h-10 text-[13px]">
                Ops deals board
              </Link>
            )}
            <Link href="/" className="btn jd-btn-ghost-light min-h-10 text-[13px]">
              Resident app
            </Link>
            <form action={signOut}>
              <button className="btn jd-btn-ghost-light min-h-10 text-[13px]">Sign out</button>
            </form>
          </>
        }
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {isOps && (
          <form action="/vendor" method="get" className="card p-4 flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <label htmlFor="vendor-select" className="block text-sm font-bold mb-1">Vendor</label>
              <select id="vendor-select" name="vendor" defaultValue={vendor.id} className="card h-10 w-full px-3 text-sm">
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary h-10 min-h-10 text-[13px]" type="submit">Open vendor</button>
          </form>
        )}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Groups filling", String(open.length)],
            ["Confirmed days", String(confirmed.length)],
            ["Booked value", rupees(earnings)],
            ["JODO commission (15%)", rupees(commissionPaise)],
          ].map(([label, value]) => (
            <StatTile key={label} label={label} value={value} />
          ))}
        </section>

        <section>
          <h2 className="font-extrabold text-[18px] mb-3">Groups filling in your societies</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {open.map((d) => (
              <article key={d.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold">{d.sku.name}</p>
                    <p className="text-[13px] text-ink-500">
                      {d.society.name} · {formatDate(d.serviceDate)}
                    </p>
                  </div>
                  <Countdown to={d.joinDeadline} />
                </div>
                <p className="tnum text-[15px]">
                  <strong>{d.basisCount}</strong> {d.basisLabel} joined · you earn{" "}
                  <strong className="text-save-700">{rupees(d.currentPricePaise * d.unitsJoined)}</strong> if it locks
                  now
                </p>
                <p className="text-[13px] text-ink-500 mb-3">
                  Minimum {d.mvs} {d.basisLabel} · {d.flatsJoined} flats, {d.unitsJoined}{" "}
                  {d.sku.unitLabel}s in one trip
                </p>
                <SlabEditor deal={d} />
                <div className="mt-3">
                  <OpsDealActions deal={d} />
                </div>
              </article>
            ))}
            {!open.length && <p className="text-sm text-ink-500">No groups filling right now.</p>}
          </div>
        </section>

        <section>
          <h2 className="font-extrabold text-[18px] mb-3">Service days</h2>
          <div className="flex flex-col gap-4">
            {confirmedVisits.map(({ deal: d, jobs }) => {
              return (
                <article key={d.id} id={`deal-${d.id}`} tabIndex={-1} className="card p-4 scroll-mt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold">
                        {d.sku.name} · {d.society.name}
                      </p>
                      <p className="text-[13px] text-ink-500">
                        {formatDate(d.serviceDate)} · {jobs.length} flats · {rupees(d.currentPricePaise)} per{" "}
                        {d.sku.unitLabel}
                      </p>
                    </div>
                    <OpsDealActions deal={d} />
                  </div>
                  <div
                    className="overflow-x-auto"
                    role="region"
                    aria-label={`Route sheet for ${d.sku.name} at ${d.society.name}`}
                    tabIndex={0}
                  >
                    <table className="w-full min-w-[660px] text-sm">
                      <thead>
                        <tr className="text-ink-500 text-left text-[12px]">
                          <th scope="col" className="py-1 font-semibold">Flat</th>
                          <th scope="col" className="font-semibold">Resident</th>
                          <th scope="col" className="font-semibold">Slot</th>
                          <th scope="col" className="font-semibold">Technician</th>
                          <th scope="col" className="font-semibold">Status</th>
                          <th scope="col" className="font-semibold">Job action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((j) => (
                          <tr key={j.id} className="border-t border-line">
                            <th scope="row" className="py-2 font-bold tnum text-left">{j.flat}</th>
                            <td>{j.name}</td>
                            <td className="tnum">{j.slot}</td>
                            <td>{j.technician}</td>
                            <td>
                              <span
                                className={`pill ${
                                  j.status === "completed" ? "bg-save-50 text-save-700" : "bg-canvas-alt text-ink-700"
                                }`}
                              >
                                {j.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-2">
                              {d.status === "in_progress" && j.status === "en_route" && (
                                <StartJobForm jobId={j.id} hint={DEMO ? j.startOtp : undefined} />
                              )}
                              {d.status === "in_progress" && j.status === "in_progress" && (
                                <CompleteJobForm jobId={j.id} hint={DEMO ? j.endOtp : undefined} />
                              )}
                              {d.status === "in_progress" && j.status === "scheduled" && (
                                <span className="text-[12px] text-ink-500">Waiting for the earlier slot</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
            {!confirmed.length && <p className="text-sm text-ink-500">Nothing confirmed yet.</p>}
          </div>
        </section>

        <section aria-labelledby="revisit-route-sheet">
          <h2 id="revisit-route-sheet" className="font-extrabold text-[18px] mb-3">Revisit route sheet</h2>
          <div className="flex flex-col gap-3">
            {revisits.map((revisit) => {
              const headingId = `revisit-${revisit.id}`;
              return (
                <article key={revisit.id} aria-labelledby={headingId} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 id={headingId} tabIndex={-1} className="font-bold scroll-mt-4">
                        {revisit.serviceName} · {revisit.societyName}
                      </h3>
                      <p className="text-[13px] text-ink-500">
                        {revisit.residentName} · Flat {revisit.flat}
                      </p>
                    </div>
                    <span className={`pill ${revisit.status === "completed" ? "bg-save-50 text-save-700" : "bg-canvas-alt text-ink-700"}`}>
                      {REVISIT_STATUS[revisit.status]}
                    </span>
                  </div>
                  {revisit.serviceDate && (
                    <p className="mt-3 text-sm tnum">
                      <time dateTime={revisit.serviceDate}>{formatRevisitDate(revisit.serviceDate)}</time>
                      {revisit.slot && <> · {revisit.slot}</>}
                      {revisit.technician && <> · {revisit.technician}</>}
                    </p>
                  )}
                  <dl className="mt-3 border-t border-line pt-3 space-y-2 text-[13px] wrap-break-word">
                    <div>
                      <dt className="font-bold">Reported issue</dt>
                      <dd className="text-ink-700">
                        {revisit.reason}
                        {revisit.detail && <p className="whitespace-pre-line">{revisit.detail}</p>}
                      </dd>
                    </div>
                    {revisit.instructions && (
                      <div>
                        <dt className="font-bold">Instructions from Ops</dt>
                        <dd className="text-ink-700 whitespace-pre-line">{revisit.instructions}</dd>
                      </div>
                    )}
                  </dl>
                  {revisit.status === "awaiting_schedule" && (
                    <div className="mt-3">
                      <RevisitScheduleForm jobId={revisit.id} earliestDate={earliestRevisitDate} />
                    </div>
                  )}
                  {revisit.status === "scheduled" && (
                    <div className="mt-3 space-y-3">
                      {isRevisitDue(revisit.serviceDate)
                        ? <StartJobForm jobId={revisit.id} hint={DEMO ? revisit.startOtp : undefined} />
                        : <p className="text-[13px] text-ink-500">Start code can be entered from the visit date.</p>}
                      <details key={`${revisit.serviceDate}-${revisit.slot}`}>
                        <summary className="w-fit cursor-pointer text-[13px] font-bold text-brand-700">Reschedule</summary>
                        <div className="mt-2">
                          <RevisitScheduleForm
                            jobId={revisit.id}
                            earliestDate={earliestRevisitDate}
                            currentDate={revisit.serviceDate ?? undefined}
                            currentSlot={revisit.slot}
                          />
                        </div>
                      </details>
                    </div>
                  )}
                  {revisit.status === "in_progress" && (
                    <div className="mt-3">
                      <CompleteJobForm jobId={revisit.id} hint={DEMO ? revisit.endOtp : undefined} />
                    </div>
                  )}
                </article>
              );
            })}
            {!revisits.length && <p className="text-sm text-ink-500">No revisits assigned.</p>}
          </div>
        </section>

        <section>
          <h2 className="font-extrabold text-[18px] mb-3">Payouts</h2>
          <div className="card p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-500 text-left text-[12px]">
                  <th className="py-1 font-semibold">Group</th>
                  <th className="font-semibold">Flats</th>
                  <th className="font-semibold">Gross</th>
                  <th className="font-semibold">Commission</th>
                  <th className="font-semibold">Net estimate</th>
                </tr>
              </thead>
              <tbody>
                {[...confirmed, ...done].map((d) => {
                  const gross = d.members.reduce((s, m) => s + (m.finalPricePaise ?? d.currentPricePaise) * m.units, 0);
                  const comm = commission(gross);
                  return (
                    <tr key={d.id} className="border-t border-line">
                      <td className="py-2">
                        {d.sku.name} · {d.society.name}
                      </td>
                      <td className="tnum">{d.flatsJoined}</td>
                      <td className="tnum">{rupees(gross)}</td>
                      <td className="tnum text-ink-500">−{rupees(comm)}</td>
                      <td className="tnum font-bold text-save-700">{rupees(gross - comm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <div className="h-6" />
      </div>
    </main>
  );
}
