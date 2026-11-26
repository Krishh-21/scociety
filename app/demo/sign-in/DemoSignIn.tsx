"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { openDemoAccount } from "@/app/actions";
import { AuthHeading, AuthShell, FormError, PhoneField, formatPhone } from "@/app/login/auth-ui";

/** Seeded accounts in the local demo database. */
const DEMO_ACCOUNTS = [
  { phone: "9000000001", role: "Resident", detail: "Flat A-402, Green Valley" },
  { phone: "9000000101", role: "Resident with bookings", detail: "Flat A-101, Green Valley" },
  { phone: "9000000002", role: "Society secretary", detail: "Flat A-404, Green Valley" },
  { phone: "9000000098", role: "Gate staff", detail: "Green Valley main gate" },
  { phone: "9000000010", role: "Service partner", detail: "CoolCare" },
  { phone: "9000000099", role: "JODO operations", detail: "Internal console" },
];

export default function DemoSignIn({ next }: { next?: string }) {
  const loginHref = next ? `/login?${new URLSearchParams({ next })}` : "/login";
  return (
    <AuthShell aside={<DemoRegistration next={next} />}>
      <AuthHeading title="Demo sign-in">
        <p>Choose a test account. The demo sends no text messages.</p>
      </AuthHeading>
      <DemoAccounts next={next} />
      <p className="jd-signin__help">
        <Link href={loginHref}>Back to sign-in</Link>
      </p>
    </AuthShell>
  );
}

function DemoAccounts({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(openDemoAccount, {});
  const [phone, setPhone] = useState("");
  return (
    <form action={action} className="jd-signin__form" aria-busy={pending}>
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset className="jd-signin__accounts" aria-describedby={state.error ? "sign-in-error" : undefined}>
        <legend>Account</legend>
        {DEMO_ACCOUNTS.map((account) => (
          <label key={account.phone} className="jd-signin__account">
            <input
              type="radio" name="phone" value={account.phone} required
              checked={phone === account.phone} onChange={() => setPhone(account.phone)}
            />
            <span className="jd-signin__account-text">
              <span className="jd-signin__account-role">{account.role}</span>
              <span className="jd-signin__account-detail">{account.detail}</span>
            </span>
            <span className="jd-signin__account-phone tnum">{formatPhone(account.phone).slice(4)}</span>
          </label>
        ))}
      </fieldset>
      <FormError state={state} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending || !phone}>
        {pending ? "Opening…" : "Open account"}
      </button>
    </form>
  );
}

function DemoRegistration({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(openDemoAccount, {});
  const [phone, setPhone] = useState("");
  return (
    <details className="jd-signin__more">
      <summary>Try new-resident registration</summary>
      <form action={action} className="jd-signin__form" aria-busy={pending}>
        {next && <input type="hidden" name="next" value={next} />}
        <p className="jd-signin__hint">
          Enter any fictional number to start as a new resident and go through flat registration.
        </p>
        <PhoneField phone={phone} setPhone={setPhone} label="Fictional mobile number" invalid={!!state.error} errorId="registration-error" />
        <FormError state={state} id="registration-error" />
        <button className="btn btn-quiet w-full" type="submit" disabled={pending}>
          {pending ? "Opening…" : "Start registration"}
        </button>
      </form>
    </details>
  );
}
