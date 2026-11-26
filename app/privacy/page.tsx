import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, MarketingPage, Prose } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What JODO collects for sign-in and society tools, how it is used, and who can see it.",
};

const SECTIONS = [
  { id: "what-we-collect", title: "What we collect" },
  { id: "who-can-see-what", title: "Who can see what" },
  { id: "why-we-use-it", title: "Why we use it" },
  { id: "your-rights", title: "Data requests" },
  { id: "security", title: "Security" },
];

export default function PrivacyPage() {
  return (
    <MarketingPage
      wide
      eyebrow="Privacy"
      title="Privacy policy"
      intro={
        <p className="text-[14px] text-ink-500">
          Draft for review before public launch.
        </p>
      }
    >
      <LegalLayout sections={SECTIONS}>
        <Prose>
          <p>
            JODO is a shared app for housing societies: visitors at the gate, notices and meetings, maintenance dues,
            complaints and amenity reservations.
          </p>

          <h2 id="what-we-collect">What we collect</h2>
          <ul>
            <li><strong>Account:</strong> your mobile number and name. Supabase Auth and the configured SMS provider process your mobile number when sending sign-in codes.</li>
            <li><strong>Google sign-in:</strong> if you choose Google, JODO uses your verified Google email during linking and saves a Google account identifier so you can sign in again.</li>
            <li><strong>Email sign-in:</strong> Supabase Auth and the configured email provider process your address to send a code. JODO uses your address during linking and saves a hash of it to recognize you on future sign-ins.</li>
            <li><strong>Residency:</strong> your society, tower and flat number, whether you're an owner or tenant, and how you were verified.</li>
            <li><strong>Gate activity:</strong> visitors logged for your flat — their name and type (guest, delivery or home help), your decision, check-in and check-out times — and guest passes you create.</li>
            <li><strong>Society records:</strong> maintenance bills for your flat and payments the committee records against them, complaints you raise and their updates, meeting RSVPs, poll votes and amenity reservations.</li>
            <li><strong>Setup requests:</strong> contact and society details you send through the website.</li>
            <li><strong>Usage:</strong> recorded app events, such as actions you take in the workspace.</li>
          </ul>

          <h2 id="who-can-see-what">Who can see what</h2>
          <ul>
            <li><strong>Verified neighbours</strong> can see your name and flat number in the society directory. Poll results are shown as counts.</li>
            <li><strong>Your society committee</strong> sees the dues, payments and receipts for every flat, complaints and their history, meeting attendance and the gate activity log — what they need to run the society.</li>
            <li><strong>Security guards</strong> assigned to your society see the visitors logged at their gate, the flat each is for and the resident’s decision. They don’t see dues, complaints or notices.</li>
            <li><strong>JODO operations</strong> can see setup requests and partner enquiries.</li>
          </ul>

          <h2 id="why-we-use-it">Why we use it</h2>
          <p>
            We use your account details to sign you in, let your committee verify your request and connect you to your
            society’s workspace. We use your activity there to keep the relevant records and show updates in JODO.
          </p>

          <h2 id="your-rights">Data requests</h2>
          <p>
            Ask your committee about access to or corrections of society records. See <Link href="/help">Help &amp; support</Link> for sign-in and account assistance.
          </p>

          <h2 id="security">Security</h2>
          <p>
            JODO uses expiring sessions and limits society tools to verified members, committee accounts and assigned guards according to their roles.
          </p>
        </Prose>
      </LegalLayout>
    </MarketingPage>
  );
}
