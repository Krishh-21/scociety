import type { Metadata } from "next";
import { LegalLayout, MarketingPage, Prose } from "@/components/marketing";
import { isDemoMode } from "@/lib/auth-mode";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using JODO's housing society tools.",
};

export default function TermsPage() {
  const demo = isDemoMode();
  const sections = [
    { id: "society-tools", title: "Society tools" },
    { id: "your-account", title: "Your account" },
    ...(demo ? [{ id: "payments", title: "Test bookings" }] : []),
  ];

  return (
    <MarketingPage wide title="Terms of use" intro={<p>Draft for review before public launch.</p>}>
      <LegalLayout sections={sections}>
        <Prose>
          <h2 id="society-tools">Society tools</h2>
          <ul>
            <li>Your committee manages your society’s space, including notices, maintenance bills, complaints and guard access.</li>
            <li>Pay maintenance dues directly to your society. The committee records the payment in JODO and can answer questions about your bill or receipt.</li>
            <li>Guards follow your society’s gate policy when acting on visitor decisions and guest passes.</li>
          </ul>

          <h2 id="your-account">Your account</h2>
          <ul>
            <li>Use a mobile number you control. Enter accurate information when requesting access to a flat.</li>
            <li>Keep sign-in codes private. Share a guest pass only with the person you expect at the gate.</li>
            <li>Ask your committee if your number or flat changes or you need help with access.</li>
          </ul>

          {demo && (
            <>
              <h2 id="payments">Test bookings</h2>
              <p>Group bookings and payments in the demo are simulations. No jobs are booked and no money moves.</p>
            </>
          )}
        </Prose>
      </LegalLayout>
    </MarketingPage>
  );
}
