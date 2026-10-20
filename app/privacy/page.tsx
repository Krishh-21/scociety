import type { Metadata } from "next";
import { MarketingPage, Prose } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What JODO collects, why, who can see it, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Privacy"
      title="Privacy policy"
      intro={
        <p className="text-[14px] text-ink-500">
          Last updated 21 October 2026 · Working draft for this build — to be reviewed by counsel before public launch.
        </p>
      }
    >
      <Prose>
        <p>
          JODO helps neighbours in a residential society book the same home service together. To do that we need to
          know who you are, which flat you live in, and what you've booked. This page explains exactly what we
          collect, why, and who can see it. We process personal data in line with India's Digital Personal Data
          Protection Act, 2023.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> your mobile number and the name you give us.</li>
          <li><strong>Residency:</strong> your society, tower and flat number, whether you're an owner or tenant, and how you were verified.</li>
          <li><strong>Bookings:</strong> groups you join, units, slots, ratings, comments and issues you raise.</li>
          <li><strong>Payments:</strong> a reference to your UPI mandate or card hold and its status. Card and UPI details are handled by our payment partner and never reach our servers.</li>
          <li><strong>Usage:</strong> which screens you open and which actions you take, to see where the app is confusing. Not sold, not used for ads.</li>
        </ul>

        <h2>Who can see what</h2>
        <ul>
          <li><strong>Your neighbours</strong> (verified residents of your society only) see your name and flat number on groups you join, and your comments.</li>
          <li><strong>The vendor</strong> on a confirmed group sees your name, flat, slot and units — what they need to do the job. They never see your phone number; calls are masked.</li>
          <li><strong>Your society committee</strong> sees which groups ran and how much the building saved, not your individual payments.</li>
          <li><strong>JODO ops</strong> sees bookings, payments and issues to run the service and resolve disputes. Every change to a group is logged.</li>
          <li><strong>Nobody else.</strong> We don't sell personal data and we don't share it for advertising.</li>
        </ul>

        <h2>Why we use it</h2>
        <p>
          To verify you live where you say, to run group bookings and payments, to send you updates that change what
          you owe (price drops, confirmations, cancellations), to handle issues and warranty claims, and to keep the
          platform safe. We send no more than one marketing notification a day, and you can switch them off.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Booking and payment records are kept for as long as tax and accounting law requires (generally eight
          years). Everything else is deleted within 90 days of you closing your account.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to see the data we hold about you, correct it, or have it erased, and you can withdraw consent
          at any time — though we may need to keep payment records the law requires. Ask from Help &amp; support in
          your profile and we'll respond within 30 days.
        </p>

        <h2>Security</h2>
        <p>
          Sessions are signed and expire; data is encrypted in transit and at rest; staff access is role-based and
          logged. If a breach ever affects your data we will tell you and the Data Protection Board as the law requires.
        </p>
      </Prose>
    </MarketingPage>
  );
}
