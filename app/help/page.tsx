import type { Metadata } from "next";
import Link from "next/link";
import { FaqList, LegalLayout, MarketingPage } from "@/components/marketing";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "How group pricing, payments, refunds, service days and issues work on JODO.",
};

const TOPICS: { id: string; title: string; items: [string, string][] }[] = [
  {
    id: "pricing",
    title: "Group pricing",
    items: [
      ["How is the price decided?", "Each vendor publishes a ladder once: a solo price and up to four group slabs. The more flats (or ACs, or cars) join, the lower the slab — and everyone in the group pays the slab the group finally reaches."],
      ["Why does AC service count ACs, not flats?", "Because that's what the crew's day scales with. Three ACs in one flat are three jobs. Deep cleaning counts flats, since it's one job per flat."],
      ["Can the price go up after I join?", "No. A vendor cannot raise the ladder once anyone has joined, and if a neighbour leaves, the price you were shown is held for the rest of the group."],
    ],
  },
  {
    id: "payments",
    title: "Payments & refunds",
    items: [
      ["When am I charged?", "When the group locks, at the deadline. Before that it's a UPI AutoPay mandate or a card hold. You can see every step — authorised, charged, released, refunded — on your booking."],
      ["What if the group doesn't fill?", "Every authorisation is released and nobody is charged. A group that came close gets one 48-hour extension first."],
      ["Can I pay in cash?", "Yes, but cash isn't held by JODO, so it isn't covered by the warranty or the dispute process. We recommend UPI."],
      ["How do refunds work?", "If ops resolves an issue with a refund, it's credited back to the method you paid with. Most UPI refunds land within 2–5 working days."],
    ],
  },
  {
    id: "service-day",
    title: "Service day",
    items: [
      ["How do I know when they'll reach my flat?", "The crew works through the building slot by slot. Your booking shows how many flats are ahead of you and roughly how long that is."],
      ["What are the two codes?", "Give the start code when the technician arrives and the completion code only once you're happy with the work. Never share the completion code before the job is done."],
      ["I can't be home in my slot.", "Leave the group before it locks at no cost. After it locks, message your neighbours in the group's comments — swapping slots is usually easy."],
    ],
  },
  {
    id: "issues",
    title: "Issues & warranty",
    items: [
      ["Something went wrong with the job.", "Open the booking and choose “Report an issue” within the warranty window (30 days for AC service, 45 for pest control, 7 for deep cleaning). Ops replies within 48 hours."],
      ["What can ops do?", "Ask the vendor to revisit, refund you in full, or close the issue with an explanation. Every decision is written to the group's record."],
    ],
  },
];

export default function HelpPage() {
  return (
    <MarketingPage
      wide
      eyebrow="Help"
      title="How JODO works, in plain words."
      intro={
        <p>
          Signed in already? The fastest help is on the booking itself — every booking shows its status, payments and
          a button to report an issue.
        </p>
      }
      aside={
        <Link href="/bookings" className="btn btn-primary h-12 px-6 text-[15px] self-start lg:self-end">
          Go to my bookings
        </Link>
      }
    >
      <LegalLayout sections={[...TOPICS.map(({ id, title }) => ({ id, title })), { id: "faq", title: "Common questions" }]}>
        <div className="flex flex-col gap-14">
          {TOPICS.map((topic) => (
            <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-title`} className="scroll-mt-24">
              <h2 id={`${topic.id}-title`} className="text-[26px] font-extrabold tracking-tight mb-2">
                {topic.title}
              </h2>
              <dl className="border-t border-line">
                {topic.items.map(([q, a]) => (
                  <div key={q} className="py-5 border-b border-line">
                    <dt className="font-bold text-[17px]">{q}</dt>
                    <dd className="text-[15px] text-ink-700 leading-relaxed mt-2">{a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24">
            <h2 id="faq-title" className="text-[26px] font-extrabold tracking-tight mb-2">
              Common questions
            </h2>
            <FaqList items={FAQ} />
          </section>

          <section aria-labelledby="stuck-title" className="mk-forest rounded-[24px] p-6 sm:p-8">
            <h2 id="stuck-title" className="text-[22px] font-extrabold tracking-tight mb-2">
              Still stuck?
            </h2>
            <p className="text-[15px] text-white/75 leading-relaxed">
              Raise an issue from the booking it's about — it reaches ops with the full record attached, which is much
              faster than starting from scratch. For anything else, your society secretary can reach the JODO team
              directly.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              <Link href="/bookings" className="btn mk-btn-lime h-11 min-h-11 text-[14px]">
                Go to my bookings
              </Link>
              <Link href="/" className="btn mk-btn-ghost-light h-11 min-h-11 text-[14px]">
                Back to home
              </Link>
            </div>
          </section>
        </div>
      </LegalLayout>
    </MarketingPage>
  );
}
