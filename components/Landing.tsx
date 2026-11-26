import Link from "next/link";
import { isDemoMode } from "@/lib/auth-mode";
import { listSkus } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { FAQ } from "@/lib/faq";
import type { Sku } from "@/lib/types";
import { FaqList, MarketingShell, WRAP } from "./marketing";
import { SocietyLeadForm } from "./marketing-client";

const basisOf = (s: Sku) => (s.ladderBasis === "units" ? `${s.unitLabel}s` : "flats");

export default async function Landing() {
  const demo = isDemoMode();
  const skus = demo ? await listSkus() : [];
  const services = skus
    .map((s) => {
      const best = [...s.defaultSlabs].sort((a, b) => a.minFlats - b.minFlats).at(-1);
      return best ? { sku: s, best } : null;
    })
    .filter((x) => x !== null);

  return (
    <MarketingShell>
      {/* ------------------------------------------------------------ hero */}
      <section aria-labelledby="hero-title" className="relative mk-grain overflow-hidden">
        <div
          className={`${WRAP} relative pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-20 grid lg:grid-cols-[0.95fr_1.1fr] gap-12 lg:gap-16 items-center [&>*]:min-w-0`}
        >
          <div>
            <p className="text-[14px] font-medium text-ink-500">For residents, committees and gate staff</p>
            <h1 id="hero-title" className="mk-display text-[38px] min-[400px]:text-[44px] sm:text-[56px] xl:text-[60px] mt-4">
              Your society’s gate, notices and dues&nbsp;— in one place.
            </h1>
            <p className="mk-lede text-[17px] sm:text-[19px] text-ink-700 leading-relaxed mt-6 max-w-xl">
              Approve visitors from your flat. Read notices and RSVP to meetings. See your maintenance bills and receipts.
              Report a maintenance issue and follow it through to resolution. JODO keeps each task’s status visible to
              the people handling it.
            </p>
            <div className="flex flex-col min-[420px]:flex-row flex-wrap gap-3 mt-8">
              <Link href="#request" className="btn btn-primary h-12 px-6 text-[16px]">
                Set up your society
              </Link>
              <Link href="/login" className="btn mk-btn-outline h-12 px-6 text-[16px]">
                Sign in
              </Link>
            </div>
            <ul className="mt-10 pt-5 border-t border-line flex flex-col gap-2 text-[14px] text-ink-500">
              {[
                "Private to verified residents",
                "Separate committee and guard roles",
                "Runs in any phone browser",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>

          <HeroIllustration />
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section id="features" aria-labelledby="features-title" className="scroll-mt-20 bg-surface border-y border-line">
        {/* Older links pointed at #how. */}
        <span id="how" className="block scroll-mt-20" aria-hidden="true" />
        <div className={`${WRAP} py-16 sm:py-24`}>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-6 lg:gap-16 items-end [&>*]:min-w-0">
            <SectionHead
              id="features-title"
              eyebrow="What’s in JODO"
              title="The four things every society office handles, every week."
            />
            <p className="mk-lede text-[17px] text-ink-700 leading-relaxed lg:pb-1">
              Each one is a shared workflow with a clear owner: the resident asks, the committee or guard acts, and both
              see the same status. Nothing is lost in a chat scroll.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-5 mt-10 sm:mt-14 [&>*]:min-w-0">
            <Module
              icon="gate"
              title="Visitors & gate"
              who="Residents · Guards"
              points={[
                "The guard logs a guest, delivery or home help against a flat.",
                "The resident approves or denies from their phone.",
                "The guard records check-in and check-out — a daily log the committee can review.",
                "Expecting someone? Create a guest pass with a 12-character code that’s valid for 24 hours.",
              ]}
            >
              <ul className="flex flex-col divide-y divide-line text-[13px]">
                {[
                  ["Delivery", "B-1204", "Approved", "ok"],
                  ["Guest pass", "A-402", "Checked in", "quiet"],
                  ["Home help", "C-801", "Waiting", "amber"],
                ].map(([k, flat, s, tone]) => (
                  <li key={flat} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0 truncate">
                      <strong className="font-semibold">{k}</strong> <span className="tnum text-ink-500">· {flat}</span>
                    </span>
                    <span className={`mk-chip mk-chip--${tone}`}>{s}</span>
                  </li>
                ))}
              </ul>
            </Module>

            <Module
              icon="megaphone"
              title="Notices, meetings & polls"
              who="Committee · Residents"
              points={[
                "Post notices and pin the one everybody must read.",
                "Schedule a meeting, collect RSVPs, then record attendance and publish the minutes.",
                "Run a poll with two to six options — one vote per member, results counted live.",
              ]}
            >
              <div className="flex flex-col gap-2 text-[13px]">
                <p className="flex items-center gap-2 min-w-0">
                  <span className="mk-chip mk-chip--quiet">Pinned</span>
                  <span className="font-semibold truncate">Water supply off Sat, 10 am–1 pm</span>
                </p>
                <PollBar label="Repaint Tower B this year" pct={64} />
                <PollBar label="Defer to next year" pct={36} quiet />
              </div>
            </Module>

            <Module
              icon="wallet"
              title="Maintenance dues & accounts"
              who="Committee · Residents"
              points={[
                "Issue each month’s dues to every flat, with line items.",
                "Record payments received by UPI, bank transfer, cash or cheque — the flat gets a receipt.",
                "Log expenses and vendor bills, note the bank balance, and share a monthly statement.",
                "Remind flats with outstanding dues in the app.",
              ]}
            >
              <dl className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="rounded-lg bg-canvas-alt p-3 min-w-0">
                  <dt className="text-ink-500">Collected · Nov</dt>
                  <dd className="tnum font-semibold text-[18px] mt-1">₹4,18,500</dd>
                </div>
                <div className="rounded-lg bg-canvas-alt p-3 min-w-0">
                  <dt className="text-ink-500">Outstanding</dt>
                  <dd className="tnum font-semibold text-[18px] mt-1">₹62,000</dd>
                </div>
              </dl>
            </Module>

            <Module
              icon="wrench"
              title="Complaints helpdesk"
              who="Residents · Committee"
              points={[
                "Raise an issue by category — lift, water, electricity, parking, waste or security.",
                "The committee assigns it to a staff member or team.",
                "It moves from Open to Assigned to In progress to Resolved, with every update kept on record.",
              ]}
            >
              <div className="text-[13px]">
                <p className="flex items-center justify-between gap-3">
                  <span className="font-semibold truncate min-w-0">Lift stuck at 7th floor · Tower A</span>
                  <span className="mk-chip mk-chip--quiet">In progress</span>
                </p>
                <div className="mk-track mt-3" aria-hidden="true">
                  <span data-on="true" />
                  <span data-on="true" />
                  <span data-on="true" />
                  <span />
                </div>
                <p className="text-ink-500 mt-2">Assigned to: Lift AMC team</p>
              </div>
            </Module>
          </div>

          <ul className="grid sm:grid-cols-3 gap-4 sm:gap-5 mt-4 sm:mt-5">
            {(
              [
                ["calendar", "Amenity reservations", "Book the clubhouse, hall or court for a time slot. Overlapping bookings are refused, so there’s no double-booking."],
                ["bell", "One notification centre", "Visitor requests, new notices and dues reminders land in the app’s notification centre."],
                ["chart", "Committee dashboard", "Dues collected this month, outstanding dues, open complaints and today’s visitors at a glance."],
              ] as const
            ).map(([icon, t, b]) => (
              <li key={t} className="card p-5 sm:p-6 bg-canvas flex gap-4">
                <span className="mk-icon-tile">
                  <Glyph name={icon} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold">{t}</h3>
                  <p className="text-[14px] text-ink-700 leading-relaxed mt-1">{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------- roles */}
      <section id="roles" aria-labelledby="roles-title" className="scroll-mt-20 mk-navy">
        <div className={`${WRAP} py-16 sm:py-24`}>
          <p className="text-[13px] font-medium text-white/70 mb-3">Who it’s for</p>
          <h2 id="roles-title" className="mk-h2 max-w-3xl">
            One app, three views. Each person sees what their job needs.
          </h2>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-5 mt-10 sm:mt-12">
            {(
              [
                [
                  "profile",
                  "Residents",
                  "From the flat",
                  [
                    "Approve or deny visitors waiting at the gate",
                    "Create guest passes for expected visitors",
                    "Read notices, RSVP to meetings and vote in polls",
                    "See maintenance bills, payments and receipts",
                    "Raise complaints and follow their status",
                    "Reserve amenities",
                  ],
                ],
                [
                  "society",
                  "Committee",
                  "Secretary and members",
                  [
                    "Publish and pin notices; schedule meetings and record minutes",
                    "Issue monthly dues and record collections",
                    "Track expenses, vendor bills and the bank balance",
                    "Assign complaints and update their progress",
                    "Give security staff access to the gate log",
                    "Review flat requests and update resident access",
                    ...(demo ? ["Approve home-service groups before they go live"] : []),
                  ],
                ],
                [
                  "shield",
                  "Security guard",
                  "At the gate",
                  [
                    "Lands straight on the visitor log after signing in",
                    "Logs guests, deliveries and home help against a flat",
                    "Sees the resident’s decision as soon as it’s made",
                    "Redeems guest-pass codes",
                    "Records check-in and check-out",
                  ],
                ],
              ] as const
            ).map(([icon, role, sub, items]) => (
              <article key={role} className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 flex flex-col">
                <span className="grid place-items-center w-10 h-10 rounded-[10px] bg-white/10 text-white/85">
                  <Glyph name={icon} />
                </span>
                <h3 className="text-[20px] font-semibold mt-5">{role}</h3>
                <p className="text-[14px] text-white/70">{sub}</p>
                <ul className="mt-5 flex flex-col gap-3 text-[15px] text-white/85">
                  {items.map((x) => (
                    <li key={x} className="flex gap-3 leading-snug">
                      <span aria-hidden="true" className="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-white/40" />
                      {x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- dues walkthrough */}
      <section aria-labelledby="dues-title" className={`${WRAP} py-16 sm:py-24`}>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start [&>*]:min-w-0">
          <div className="lg:sticky lg:top-24">
            <SectionHead id="dues-title" eyebrow="A month of maintenance" title="Dues that both sides can check." />
            <p className="mk-lede text-[17px] text-ink-700 leading-relaxed mt-5">
              Residents see exactly what was billed, what was recorded against their flat and the receipt. The committee
              sees who is outstanding and where the money went — without rebuilding a spreadsheet every month.
            </p>
            <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-[14px] text-ink-700 leading-relaxed">
              <strong className="font-semibold text-ink-900">JODO keeps the record; it doesn’t collect the money.</strong>{" "}
              Residents keep paying the way your society already accepts, and the committee records each payment.
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {[
              ["Issue", "The committee issues the month’s dues to every verified flat, with line items such as maintenance and sinking fund."],
              ["Pay", "The resident pays the society by UPI, bank transfer, cash or cheque, as they do today."],
              ["Record", "The committee records the payment, method and reference against the flat’s bill."],
              ["Receipt", "The resident sees the bill marked paid and can open the receipt."],
              ["Report", "Expenses and vendor bills sit beside collections in a monthly statement, with the reported bank balance."],
            ].map(([t, b], i) => (
              <li key={t} className="card p-5 sm:p-6 flex gap-4 items-start">
                <span className="tnum grid place-items-center w-8 h-8 shrink-0 rounded-full bg-canvas-alt text-ink-700 text-[14px] font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-semibold">{t}</h3>
                  <p className="text-[15px] text-ink-700 leading-relaxed mt-1">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------- home services */}
      {demo && <section id="services" aria-labelledby="services-title" className="scroll-mt-20 bg-surface border-y border-line">
        <span id="ladder" className="block scroll-mt-20" aria-hidden="true" />
        <div className={`${WRAP} py-16 sm:py-20 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center [&>*]:min-w-0`}>
          <div>
            <SectionHead id="services-title" eyebrow="Also in JODO" title="Book home services together with neighbours." />
            <p className="mk-lede text-[16px] sm:text-[17px] text-ink-700 leading-relaxed mt-5">
              AC servicing, deep cleaning and other routine jobs can be booked as a group: one verified vendor, one day,
              and a published price ladder that falls as more flats join. Everyone pays the final group price, and the
              committee can choose to approve each group before it opens.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6 text-[15px] font-semibold">
              <Link href="/help#home-services" className="text-brand-700 hover:underline underline-offset-4">
                How group booking works <span aria-hidden="true">→</span>
              </Link>
              <Link href="/partners" className="text-brand-700 hover:underline underline-offset-4">
                For service partners <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          {services.length > 0 && (
            <div className="card bg-canvas overflow-hidden">
              <table className="w-full text-[14px]">
                <caption className="sr-only">Current catalogue: solo price and best group price per service</caption>
                <thead>
                  <tr className="text-left text-[12px] text-ink-500">
                    <th scope="col" className="font-medium px-4 sm:px-5 py-3">Service</th>
                    <th scope="col" className="font-medium px-2 py-3 text-right">Solo</th>
                    <th scope="col" className="font-medium px-4 sm:px-5 py-3 text-right">In a group</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(({ sku, best }) => (
                    <tr key={sku.id} className="border-t border-line align-top">
                      <th scope="row" className="text-left font-semibold px-4 sm:px-5 py-4">
                        {sku.name}
                        <span className="block text-[12px] font-normal text-ink-500 mt-1">
                          per {sku.unitLabel} · group price at {best.minFlats}+ {basisOf(sku)}
                        </span>
                      </th>
                      <td className="tnum px-2 py-4 text-right text-ink-500 whitespace-nowrap">{rupees(sku.listPricePaise)}</td>
                      <td className="tnum px-4 sm:px-5 py-4 text-right font-semibold text-brand-700 whitespace-nowrap">
                        {rupees(best.pricePaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>}

      {/* ------------------------------------------------- expectations */}
      <section id="trust" aria-labelledby="trust-title" className={`scroll-mt-20 ${WRAP} py-16 sm:py-24`}>
        <span id="promises" className="block scroll-mt-20" aria-hidden="true" />
        <SectionHead id="trust-title" eyebrow="Good to know" title="What JODO does today, plainly." />
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 mt-12">
          {[
            ["Private to your society", "Only verified residents see your society’s notices, polls and neighbours. Each flat can be claimed by one verified account."],
            ["Roles, not group admins", "Committee tools are only for committee members. Guards see the visitor log for their gate — not dues or complaints."],
            ["Alerts inside the app", "Updates arrive in JODO’s notification centre. There are no SMS, WhatsApp or phone push alerts yet."],
            ["Records you can trace", "Payments, complaint updates and visitor decisions are saved with who made them and when."],
          ].map(([t, b]) => (
            <div key={t} className="border-t border-line pt-5">
              <dt className="text-[17px] font-semibold">{t}</dt>
              <dd className="text-[15px] text-ink-700 leading-relaxed mt-2">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------- request */}
      <section id="request" aria-labelledby="request-title" className="scroll-mt-20 bg-canvas-alt border-y border-line">
        <span id="societies" className="block scroll-mt-20" aria-hidden="true" />
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 [&>*]:min-w-0`}>
          <div>
            <SectionHead id="request-title" eyebrow="Get started" title="Bring JODO to your society." />
            <p className="mk-lede text-[17px] text-ink-700 leading-relaxed mt-5">
              Residents, secretaries and facility managers can all ask. Tell us a little about the society and we’ll call
              to plan the setup with your committee.
            </p>
            <ol className="mt-8 flex flex-col gap-5">
              {[
                ["We call you", "We talk through your towers, flats, committee members and gate."],
                ["We set up the society", "Committee roles and guard access are in place before residents arrive."],
                ["Residents sign in", "Each resident signs in with their mobile number and claims their flat."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="tnum grid place-items-center w-8 h-8 shrink-0 rounded-full bg-surface border border-line text-ink-700 text-[14px] font-medium">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[16px]">{t}</p>
                    <p className="text-[15px] text-ink-700 leading-relaxed">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-surface text-ink-900 border border-line rounded-2xl p-5 sm:p-8">
            <h3 className="text-[22px] font-semibold mb-1">Request a setup call</h3>
            <p className="text-[14px] text-ink-500 mb-6">All fields are required unless marked optional.</p>
            <SocietyLeadForm />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- faq */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16 [&>*]:min-w-0`}>
          <div>
            <SectionHead id="faq-title" eyebrow="Questions" title="What committees ask first." />
            <p className="text-[15px] text-ink-500 mt-5">
              More in{" "}
              <Link href="/help" className="text-brand-700 font-semibold underline underline-offset-2">
                Help
              </Link>
              .
            </p>
          </div>
          <FaqList items={FAQ} />
        </div>
      </section>
    </MarketingShell>
  );
}

// ---------------------------------------------------------------- pieces

function SectionHead({ id, eyebrow, title }: { id?: string; eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 id={id} className="mk-h2">
        {title}
      </h2>
    </div>
  );
}

function Module({
  icon,
  title,
  who,
  points,
  children,
}: {
  icon: GlyphName;
  title: string;
  who: string;
  points: string[];
  children: React.ReactNode;
}) {
  return (
    <article className="card bg-canvas p-5 sm:p-7 flex flex-col min-w-0">
      <div className="flex items-center gap-4">
        <span className="mk-icon-tile">
          <Glyph name={icon} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[20px] font-semibold leading-tight">{title}</h3>
          <p className="text-[13px] text-ink-500 mt-0.5">{who}</p>
        </div>
      </div>
      <ul className="mt-5 flex flex-col gap-2 text-[15px] text-ink-700">
        {points.map((p) => (
          <li key={p} className="flex gap-3 leading-relaxed">
            <span aria-hidden="true" className="mt-[10px] w-1.5 h-1.5 shrink-0 rounded-full bg-ink-300" />
            {p}
          </li>
        ))}
      </ul>
      {/* A small product sketch with sample data — decorative, the list above says it all. */}
      <div aria-hidden="true" className="mt-auto pt-6">
        <div className="mk-screen p-4">{children}</div>
      </div>
    </article>
  );
}

function PollBar({ label, pct, quiet = false }: { label: string; pct: number; quiet?: boolean }) {
  return (
    <div>
      <div className="flex justify-between gap-3">
        <span className="truncate min-w-0">{label}</span>
        <span className="tnum font-semibold">{pct}%</span>
      </div>
      <div className="h-1 rounded-sm bg-canvas-alt mt-1.5 overflow-hidden">
        <div className={`h-full rounded-sm ${quiet ? "bg-ink-300" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * The hero preview: JODO's guard, committee and resident screens with sample data,
 * telling one short story. A delivery reaches the gate, the resident gets the same
 * Approve entry / Deny entry card the app shows, and the helpdesk runs alongside.
 * The flat number sits beside the gate status wherever it identifies the visit.
 * Drawn in HTML so it follows light and dark mode.
 */
function HeroIllustration() {
  return (
    <figure className="m-0">
      <div className="mk-stage p-3 sm:p-4">
        <div aria-hidden="true" className="grid sm:grid-cols-[1fr_1.5fr] gap-3 items-start">
          {/* Guard and helpdesk */}
          <div className="order-2 sm:order-1 flex flex-col gap-3 sm:pt-10">
            <div className="mk-screen overflow-hidden">
              <div className="mk-screen__bar">
                <span>Main gate</span>
                <span>Guard</span>
              </div>
              <div className="p-3 text-[13px]">
                <p className="text-ink-500 text-[12px]">New entry</p>
                <p className="font-semibold text-[15px] mt-1">Ravi</p>
                <p className="text-ink-500">Delivery · parcel</p>
                <p className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="mk-flat">B-1204</span>
                  <span className="mk-chip mk-chip--amber">Awaiting approval</span>
                </p>
              </div>
            </div>
            <div className="mk-screen hidden sm:block overflow-hidden">
              <div className="mk-screen__bar">
                <span>Helpdesk</span>
                <span>Committee</span>
              </div>
              <div className="p-3 text-[13px]">
                <p className="font-semibold leading-snug">Water leak in B-wing basement</p>
                <div className="mk-track mt-3">
                  <span data-on="true" />
                  <span data-on="true" />
                  <span />
                  <span />
                </div>
                <p className="text-ink-500 text-[12px] mt-2">Assigned · Plumbing team</p>
              </div>
            </div>
          </div>

          {/* Resident: the approval card is the one rich moment */}
          <div className="order-1 sm:order-2 mk-screen overflow-hidden">
            <div className="mk-screen__bar">
              <span className="tnum">B-1204 · Home</span>
              <span>Resident</span>
            </div>
            <div className="p-3 flex flex-col gap-3 text-[13px]">
              <div className="rounded-[10px] border border-[var(--mk-amber-line)] border-s-[3px] border-s-[var(--mk-amber)] bg-[var(--mk-amber-soft)] p-3">
                <p className="font-semibold text-[14px] text-ink-900">Visitor at the gate</p>
                <p className="text-[12px] text-[var(--mk-amber-ink)]">Needs your answer</p>
                <div className="rounded-lg bg-surface border border-[var(--mk-amber-line)] p-3 mt-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-[15px] text-ink-900">Ravi</p>
                    <span className="text-[12px] text-ink-500 shrink-0">just now</span>
                  </div>
                  <p className="text-ink-700 flex items-center gap-2 mt-1">
                    Delivery <span className="mk-flat">Flat B-1204</span>
                  </p>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 mt-3">
                    <span className="rounded-full bg-save-600 text-white text-center text-[13px] font-medium py-2.5 px-1 whitespace-nowrap">Approve entry</span>
                    <span className="rounded-full bg-danger-50 text-danger-600 text-center text-[13px] font-medium py-2.5 px-1 whitespace-nowrap">Deny entry</span>
                  </div>
                </div>
              </div>
              <div className="rounded-[10px] bg-canvas-alt p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Maintenance · November</p>
                  <span className="mk-chip mk-chip--ok">Paid</span>
                </div>
                <p className="tnum font-semibold text-[20px] mt-1">₹3,450</p>
                <p className="text-ink-500 text-[12px]">UPI · receipt available</p>
              </div>
              <div className="rounded-[10px] bg-canvas-alt p-3">
                <div className="flex items-center gap-2">
                  <span className="mk-chip mk-chip--quiet">Pinned</span>
                  <p className="font-medium truncate min-w-0">AGM on Sunday, 11 am</p>
                </div>
                <p className="text-ink-500 text-[12px] mt-2">Clubhouse · 42 going</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="text-[12px] text-ink-500 mt-3 text-center lg:text-left">
        Illustration of JODO’s guard, committee and resident screens, with sample data.
      </figcaption>
    </figure>
  );
}

type GlyphName = "gate" | "megaphone" | "wallet" | "wrench" | "calendar" | "bell" | "chart" | "profile" | "society" | "shield";

function Glyph({ name }: { name: GlyphName }) {
  const paths: Record<GlyphName, React.ReactNode> = {
    gate: (
      <>
        <path d="M4 21V8l8-5 8 5v13" />
        <path d="M9 21v-7h6v7M2 21h20" />
      </>
    ),
    megaphone: (
      <>
        <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z" />
        <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h11v4" />
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M16 13.5h2" />
      </>
    ),
    wrench: <path d="M14.5 6.5a4 4 0 0 0 5 5l-8.8 8.8a2.1 2.1 0 0 1-3-3l8.8-8.8a4 4 0 0 0-2-2ZM14.5 6.5 17 4" />,
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 14h3" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    chart: (
      <>
        <path d="M3 21h18" />
        <rect x="5" y="11" width="3.5" height="7" rx="1" />
        <rect x="10.25" y="6" width="3.5" height="12" rx="1" />
        <rect x="15.5" y="13" width="3.5" height="5" rx="1" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
    society: (
      <>
        <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
        <path d="M14 9h5a1 1 0 0 1 1 1v11M2 21h20M7.5 8h3M7.5 12h3M7.5 16h3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
