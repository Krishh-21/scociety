import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing";
import { VendorLeadForm } from "@/components/marketing-client";
import { isDemoMode } from "@/lib/auth-mode";

export const metadata: Metadata = {
  title: "Service partners",
  description:
    "Register your interest in becoming a JODO service partner.",
};

const STEPS: [string, string][] = [
  ["Publish your price ladder", "Your list price and up to four group slabs — e.g. ₹999 solo, ₹749 at 10 ACs, ₹645 at 20. We suggest slabs from what similar crews charge."],
  ["We fill the building", "Residents join your group in the app. You see the count and what you'll earn in real time. The ladder can only get cheaper once anyone joins — never re-priced on you either."],
  ["One crew, one day", "At the deadline the group locks and you get a route sheet: flats, slots, units. Each job starts and ends with the resident's code."],
  ["Payout", "Your console shows each day’s commission and net payout. If a resident reports an issue, only that job is held while ops reviews it."],
];

const NEEDS = [
  "GST registration (or PAN for smaller businesses) and a bank account in the business name",
  "Police verification for every technician who enters a flat",
  "Damage insurance up to ₹50,000 per job — we can point you to a partner if you don't have it",
  "Three recent jobs we can call for a reference",
];

export default function PartnersPage() {
  if (!isDemoMode()) {
    return (
      <MarketingPage
        title="Register as a service partner"
        intro={<p>Tell us about your business and the areas you cover. JODO is collecting enquiries for a future booking release.</p>}
      >
        <section id="apply" aria-labelledby="apply-title" className="card p-5 sm:p-8 scroll-mt-24">
          <h2 id="apply-title" className="text-xl font-semibold mb-4">Your business details</h2>
          <VendorLeadForm />
        </section>
      </MarketingPage>
    );
  }
  return (
    <MarketingPage
      wide
      eyebrow="Service partners"
      title="Serve a whole society in one visit."
      intro={
        <p>
          Societies use JODO to manage their gate, notices, dues and complaints. When residents book routine services
          as a group, your crew sees the flats, time slots and work planned for the day.
        </p>
      }
      aside={
        <a href="#apply" className="btn btn-primary h-12 px-6 text-[16px] self-start lg:self-end">
          Apply to be a partner
        </a>
      }
    >
      <dl className="grid sm:grid-cols-3 gap-4">
        {[
          ["One building", "a whole group of flats on one date — less time on the road"],
          ["Route sheet", "every flat, slot and unit for the day in your partner console"],
          ["Payout view", "commission and net payout shown for each service day"],
        ].map(([v, l], i) => (
          <div key={v} className={`rounded-[20px] p-6 flex flex-col-reverse justify-end ${i === 0 ? "mk-navy" : "card"}`}>
            <dt className={`text-[14px] leading-snug mt-2 ${i === 0 ? "text-white/80" : "text-ink-700"}`}>{l}</dt>
            <dd className={`text-[28px] sm:text-[30px] font-extrabold tracking-tight leading-tight ${i === 0 ? "text-white" : "text-brand-700"}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="partner-how" className="mt-16 sm:mt-20">
        <p className="eyebrow mb-3 !text-brand-700">How it works</p>
        <h2 id="partner-how" className="mk-h2 !text-[28px] sm:!text-[36px] max-w-2xl">
          You set the ladder once. We fill the day.
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line mt-8 rounded-[20px] overflow-hidden border border-line">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="bg-surface p-6">
              <span className="tnum text-[13px] font-extrabold text-brand-700">0{i + 1}</span>
              <h3 className="font-extrabold text-[18px] tracking-tight mt-3">{t}</h3>
              <p className="text-[14px] text-ink-700 leading-relaxed mt-2">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-16 sm:mt-20 grid lg:grid-cols-[1fr_1.35fr] gap-10 lg:gap-16 items-start [&>*]:min-w-0">
        <section aria-labelledby="partner-needs" className="lg:sticky lg:top-24">
          <p className="eyebrow mb-3 !text-brand-700">Before you apply</p>
          <h2 id="partner-needs" className="mk-h2 !text-[28px] sm:!text-[36px]">
            What we need from you
          </h2>
          <ul className="mt-6 border-t border-line">
            {NEEDS.map((x) => (
              <li key={x} className="flex gap-3 py-4 border-b border-line text-[15px] text-ink-700 leading-relaxed">
                <span aria-hidden="true" className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-brand-600 text-white grid place-items-center text-[11px] font-extrabold">
                  ✓
                </span>
                {x}
              </li>
            ))}
          </ul>
        </section>

        <section id="apply" aria-labelledby="apply-title" className="card p-6 sm:p-8 scroll-mt-24 shadow-xl shadow-black/5">
          <h2 id="apply-title" className="text-[26px] font-extrabold tracking-tight mb-1">
            Apply to be a partner
          </h2>
          <p className="text-[14px] text-ink-500 mb-6">Use fictional details to try the demo form.</p>
          <VendorLeadForm />
        </section>
      </div>
    </MarketingPage>
  );
}
