import type { Metadata } from "next";
import Link from "next/link";
import { isDemoMode } from "@/lib/auth-mode";
import { FaqList, LegalLayout, MarketingPage } from "@/components/marketing";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "How sign-in, visitors, notices, maintenance dues, complaints and amenities work on JODO.",
};

const TOPICS: { id: string; title: string; items: [string, string][] }[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      ["How do I join my society?", "Sign in with your mobile number and the six-digit code from your SMS. Then choose your society and submit your flat number for committee review."],
      ["I haven’t received a sign-in code.", "Check your mobile number and wait a minute before requesting another code. Enter or paste the six digits from the most recent SMS. If your number changed, contact your society committee about recovering access."],
      ["My flat is already taken.", "Each flat can be held by one verified account. If someone else holds yours, ask your society secretary to help."],
      ["Where do updates show up?", "In the notification centre — the bell in the app. JODO doesn’t send SMS, WhatsApp or phone push alerts yet, so check the bell when you’re expecting something."],
    ],
  },
  {
    id: "visitors",
    title: "Visitors & gate",
    items: [
      ["Someone is at the gate for me.", "The guard logs the visit as a guest, delivery or home help for your flat. You’ll see it in the app — approve or deny it, and the guard sees your decision."],
      ["How do guest passes work?", "Create a pass from Visitors with your guest’s name. You get a 12-character code that’s valid for 24 hours; share it with your guest and the guard redeems it at the gate."],
      ["What does the guard record?", "Each visit’s decision, check-in and check-out time. The committee can review the gate activity."],
    ],
  },
  {
    id: "notices",
    title: "Notices, meetings & amenities",
    items: [
      ["Who can post notices?", "The committee. The most important notice can be pinned to the top of everyone’s home screen."],
      ["How do meetings work?", "The committee schedules a meeting; residents RSVP going or not going. After it starts, the committee records attendance and publishes the minutes."],
      ["How do polls work?", "A poll has two to six options. Each member votes once and everyone can see the running count until the committee closes the poll."],
      ["How do I book the clubhouse?", "Open Amenities, choose a start and end time and reserve it. If someone already has that time, you’ll be asked to choose another. You can cancel your reservation before it starts."],
    ],
  },
  {
    id: "dues",
    title: "Maintenance & accounts",
    items: [
      ["Where do I see my maintenance bill?", "Under Maintenance & accounts. Each bill shows its line items, what has been recorded as paid, and a receipt once it’s settled."],
      ["Can I pay through JODO?", "Not yet. Pay the society by UPI, bank transfer, cash or cheque as usual. The committee records the payment against your bill."],
      ["I paid but my bill still shows due.", "The committee hasn’t recorded it yet. Share your payment reference with them; once they record it the bill and receipt update."],
      ["What can the committee see?", "Bills and payments for every flat, expenses and vendor bills, the reported bank balance and a monthly statement."],
    ],
  },
  {
    id: "complaints",
    title: "Complaints",
    items: [
      ["How do I raise a complaint?", "Open Complaints, pick a category — lift, water, electricity, parking, waste, security or other — and describe the problem. The committee is notified."],
      ["What do the statuses mean?", "Open: received. Assigned: a staff member or team is responsible. In progress: work has started. Resolved: done. Each change is kept on the complaint’s history."],
    ],
  },
  {
    id: "home-services",
    title: "Home-service bookings",
    items: [
      ["How does group booking work?", "A resident or the committee starts a group for a service and a day. Neighbours join, and the price moves down a published ladder as more flats (or AC units) join. Everyone pays the final group price, including whoever joined first."],
      ["Can the price go up after I join?", "No. A vendor cannot raise the ladder once anyone has joined, and if a neighbour leaves, the price you were shown is held."],
      ["What if the group doesn’t fill?", "The group is cancelled and nothing is charged. A group that came close gets one 48-hour extension first. Your booking shows each payment step — held, charged, released or refunded."],
      ["What are the two codes on service day?", "Give the start code when the technician arrives and the completion code only once you’re happy with the work."],
      ["Something went wrong with the job.", "Open the booking and choose “Report an issue” within the warranty window shown on the service. Ops replies within 48 hours and can arrange a revisit or a refund."],
    ],
  },
];

export default function HelpPage() {
  const topics = isDemoMode() ? TOPICS : TOPICS.filter((topic) => topic.id !== "home-services");
  const support = process.env.JODO_SUPPORT_EMAIL?.trim();
  return (
    <MarketingPage
      wide
      eyebrow="Help"
      title="How JODO works, in plain words."
      intro={
        <p>
          A bill, complaint or visitor entry shows its own status and history after you sign in.
        </p>
      }
      aside={
        <Link href="/login" className="btn btn-primary h-12 px-6 text-[15px] self-start lg:self-end">
          Sign in
        </Link>
      }
    >
      <LegalLayout sections={[...topics.map(({ id, title }) => ({ id, title })), { id: "faq", title: "Common questions" }]}>
        <div className="flex flex-col gap-14">
          {topics.map((topic) => (
            <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-title`} className="scroll-mt-24 relative">
              {/* Older links pointed at the booking topics by these ids. */}
              {topic.id === "home-services" &&
                ["pricing", "payments", "service-day", "issues"].map((alias) => (
                  <span key={alias} id={alias} aria-hidden="true" className="absolute top-0 scroll-mt-24" />
                ))}
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

          <section aria-labelledby="stuck-title" className="mk-navy rounded-[24px] p-6 sm:p-8">
            <h2 id="stuck-title" className="text-[22px] font-extrabold tracking-tight mb-2">
              Still stuck?
            </h2>
            <p className="text-[15px] text-white/80 leading-relaxed">
              Ask your committee about flat verification, dues, visitor entries or complaints. They can look up the record in JODO.
            </p>
            {support && (
              <p className="mt-3 text-[15px] text-white/80">
                For sign-in and privacy requests, email <a href={`mailto:${support}`} className="underline">{support}</a>.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-5">
              <Link href="/login" className="btn mk-btn-light h-11 min-h-11 text-[14px]">
                Sign in
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
