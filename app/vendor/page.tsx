import Link from "next/link";
import { redirect } from "next/navigation";
import { jobsForDeal, vendorDeals } from "@/lib/deals";
import { commission, formatDate, rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { can } from "@/lib/authz";
import ConsoleGate from "@/components/ConsoleGate";
import { one } from "@/lib/db";
import { CompleteJobForm, OpsDealActions, SlabEditor, StartJobForm } from "@/components/forms";
import Countdown from "@/components/Countdown";
import { signOut } from "@/app/actions";

export const dynamic = "force-dynamic";

// In a real deployment the crew gets the code from the resident at the door; the
// hint exists so one person can drive the whole demo from one browser.
const DEMO = process.env.NODE_ENV !== "production";

export default async function VendorPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!can(me, { kind: "console.vendor" })) {
    return <ConsoleGate console="vendor" phone="9000000010" you={me.user.name} />;
  }
  // Ops can look at any vendor's day; a vendor only ever sees their own.
  const vendorId = me.user.vendorId ?? "ven_coolcare";
  const vendor = one<{ name: string; rating: number; jobsDone: number }>("SELECT * FROM vendor WHERE id = ?", vendorId)!;
  const deals = vendorDeals(vendorId);

  const open = deals.filter((d) => d.status === "open");
  const confirmed = deals.filter((d) => d.status === "locked" || d.status === "in_progress");
  const done = deals.filter((d) => d.status === "completed");

  const earnings = [...confirmed, ...done].reduce(
    (sum, d) => sum + d.members.reduce((s, m) => s + (m.finalPricePaise ?? d.currentPricePaise) * m.units, 0),
    0,
  );
  const commissionPaise = commission(earnings);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">Vendor console</p>
          <h1 className="text-[22px] font-extrabold">{vendor.name}</h1>
          <p className="text-[13px] text-ink-500">
            ★ {vendor.rating} · {vendor.jobsDone.toLocaleString("en-IN")} jobs done
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href="/" className="btn btn-quiet h-10 min-h-10 text-[13px]">
            Resident app
          </Link>
          <form action={signOut}>
            <button className="btn btn-quiet h-10 min-h-10 text-[13px]">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-6 flex flex-col gap-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Groups filling", String(open.length)],
            ["Confirmed days", String(confirmed.length)],
            ["Booked value", rupees(earnings)],
            ["JODO commission (15%)", rupees(commissionPaise)],
          ].map(([label, value]) => (
            <div key={label} className="card p-4">
              <p className="eyebrow mb-1">{label}</p>
              <p className="tnum text-[22px] font-extrabold">{value}</p>
            </div>
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
            {confirmed.map((d) => {
              const jobs = jobsForDeal(d.id);
              return (
                <article key={d.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3">
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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-ink-500 text-left text-[12px]">
                        <th className="py-1 font-semibold">Flat</th>
                        <th className="font-semibold">Resident</th>
                        <th className="font-semibold">Slot</th>
                        <th className="font-semibold">Technician</th>
                        <th className="font-semibold">Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id} className="border-t border-line">
                          <td className="py-2 font-bold tnum">{j.flat}</td>
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
                          <td className="text-right">
                            {d.status === "in_progress" && j.status === "en_route" && (
                              <StartJobForm jobId={j.id} hint={DEMO ? j.startOtp : undefined} />
                            )}
                            {d.status === "in_progress" && j.status === "in_progress" && (
                              <CompleteJobForm jobId={j.id} hint={DEMO ? j.endOtp : undefined} />
                            )}
                            {d.status === "in_progress" && j.status === "scheduled" && (
                              <span className="text-[12px] text-ink-300">waiting for the earlier slot</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              );
            })}
            {!confirmed.length && <p className="text-sm text-ink-500">Nothing confirmed yet.</p>}
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
                  <th className="font-semibold">Net (T+1)</th>
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
