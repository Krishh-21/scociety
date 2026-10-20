import type { Metadata } from "next";
import { MarketingPage, Prose } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Terms",
  description: "The rules of group booking on JODO — pricing, payments, cancellations, warranty and disputes.",
};

export default function TermsPage() {
  return (
    <MarketingPage
      eyebrow="Terms"
      title="Terms of use"
      intro={
        <p className="text-[14px] text-ink-500">
          Last updated 21 October 2026 · Working draft for this build — to be reviewed by counsel before public launch.
        </p>
      }
    >
      <Prose>
        <p>
          These terms cover how group bookings on JODO work. JODO is a marketplace: the service itself is performed by
          the independent vendor shown on the group. By joining a group you agree to the terms below.
        </p>

        <h2>1. Group prices</h2>
        <ul>
          <li>Every group shows a published price ladder before you join.</li>
          <li>Everyone in a group pays the same final price — the slab the group has reached when it locks — including whoever joined first.</li>
          <li>The price you are charged never goes above the price shown when you joined. A vendor cannot raise a ladder once anyone has joined, and if members leave, the price already reached is held.</li>
        </ul>

        <h2>2. Payments</h2>
        <ul>
          <li>When you join we take a UPI AutoPay mandate or a card authorisation, not a payment.</li>
          <li>We charge you only when the group locks at its deadline, for the final price multiplied by your units.</li>
          <li>If the group does not reach its minimum by the deadline (after at most one automatic 48-hour extension), it is cancelled and every authorisation is released.</li>
          <li>Cash payments go directly to the vendor and are not covered by section 5.</li>
        </ul>

        <h2>3. Leaving a group</h2>
        <p>
          You can leave a group at no cost any time before it locks. After it locks, the booking is confirmed for the
          vendor; if you can't be home, try swapping slots with a neighbour in the group's comments.
        </p>

        <h2>4. Service day</h2>
        <ul>
          <li>Give the technician your start code when they arrive and your completion code only when you're satisfied.</li>
          <li>Anything outside the listed scope (for example a gas refill) must be quoted and approved by you in the app before it's done. Don't pay technicians extra in cash.</li>
          <li>Keep the area accessible during your slot. A missed slot may not be possible to reschedule the same day.</li>
        </ul>

        <h2>5. Warranty and issues</h2>
        <ul>
          <li>Each service lists its workmanship warranty (for example 30 days for AC service).</li>
          <li>Raise an issue from your booking within that window. JODO ops will review it within 48 hours and may ask the vendor to revisit, refund you in full, or close the issue with an explanation.</li>
          <li>Payment to the vendor for a disputed job is held until the issue is resolved.</li>
        </ul>

        <h2>6. Your account</h2>
        <p>
          You must live in, own or rent the flat you register, and give a real name. Groups are private to verified
          residents of a society — don't share codes, screenshots of neighbours' details, or your account.
        </p>

        <h2>7. Societies and vendors</h2>
        <p>
          Societies can require committee approval before groups go live. Vendors agree to separate partner terms
          covering verification, insurance, pricing and payouts.
        </p>

        <h2>8. Liability</h2>
        <p>
          Vendors are responsible for the work they perform and carry damage insurance as a condition of listing.
          JODO's liability for any booking is limited to the amount you paid for it, except where the law does not
          allow that limit.
        </p>

        <h2>9. Changes</h2>
        <p>
          If we change these terms in a way that matters, we'll tell you in the app before it takes effect. Groups you
          have already joined continue under the terms that applied when you joined.
        </p>
      </Prose>
    </MarketingPage>
  );
}
