import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing";
import { VendorLeadForm } from "@/components/marketing-client";

export const metadata: Metadata = {
  title: "Become a vendor partner",
  description:
    "Get a full day of work in one residential society, paid the next day. JODO fills the building; you send one crew.",
};

const STEPS: [string, string][] = [
  ["Publish your price ladder", "Your list price and up to four group slabs — e.g. ₹999 solo, ₹749 at 10 ACs, ₹645 at 20. We suggest slabs from what similar crews charge."],
  ["We fill the building", "Residents join your group in the app. You see the count and what you'll earn in real time. The ladder can only get cheaper once anyone joins — never re-priced on you either."],
  ["One crew, one day", "At the deadline the group locks and you get a route sheet: flats, slots, units. Each job starts and ends with the resident's code."],
  ["Paid T+1", "Settlement the next working day, minus commission. Disputes are held only for the job in question, never the whole day."],
];

export default function PartnersPage() {
  return (
    <MarketingPage
      eyebrow="For vendors"
      title="A full day of work in one building, paid the next day."
      intro={
        <p>
          Your real cost is the road — three jobs a day, half of it in traffic, plus whatever it took to find each
          customer. JODO hands you twelve flats in one tower on one Sunday. You charge each of them less and still
          earn more for the day.
        </p>
      }
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-12">
        {[
          ["12–18%", "commission — less than lead-gen apps, because we hand you a day, not a lead"],
          ["T+1", "payout after the service day, straight to your bank"],
          ["₹0", "to list — no subscription to start"],
        ].map(([v, l]) => (
          <div key={v} className="card p-5">
            <p className="tnum text-[28px] font-extrabold text-brand-700">{v}</p>
            <p className="text-[14px] text-ink-700 mt-1 leading-snug">{l}</p>
          </div>
        ))}
      </div>

      <h2 className="text-[24px] font-extrabold mb-4">How it works</h2>
      <ol className="flex flex-col gap-3 mb-12">
        {STEPS.map(([t, b], i) => (
          <li key={t} className="card p-5 flex gap-4">
            <span className="w-9 h-9 shrink-0 rounded-full bg-brand-600 text-white grid place-items-center font-extrabold tnum">
              {i + 1}
            </span>
            <div>
              <h3 className="font-extrabold text-[16px]">{t}</h3>
              <p className="text-[14px] text-ink-700 leading-relaxed mt-1">{b}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="text-[24px] font-extrabold mb-3">What we need from you</h2>
      <ul className="card p-5 flex flex-col gap-2 text-[15px] text-ink-700 mb-12">
        {[
          "GST registration (or PAN for smaller businesses) and a bank account in the business name",
          "Police verification for every technician who enters a flat",
          "Damage insurance up to ₹50,000 per job — we can point you to a partner if you don't have it",
          "Three recent jobs we can call for a reference",
        ].map((x) => (
          <li key={x} className="flex gap-3">
            <span aria-hidden="true" className="text-save-600 font-bold">✓</span>
            {x}
          </li>
        ))}
      </ul>

      <div id="apply" className="card p-6 sm:p-8 scroll-mt-20">
        <h2 className="text-[24px] font-extrabold mb-1">Apply to be a partner</h2>
        <p className="text-[14px] text-ink-500 mb-5">Our supply team calls every applicant within two working days.</p>
        <VendorLeadForm />
      </div>
    </MarketingPage>
  );
}
