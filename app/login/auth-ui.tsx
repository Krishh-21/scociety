import Link from "next/link";
import type { ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { BrandMark } from "@/components/Brand";
import "./sign-in.css";

/** Shared frame for /login and /demo/sign-in: brand bar, one centred panel, policy footer. */
export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="jd-signin">
      <header className="jd-signin__top">
        <Link href="/" className="jd-signin__brand" aria-label="JODO home">
          <BrandMark size={28} />
          <span aria-hidden="true">jodo</span>
        </Link>
        <Link href="/help#getting-started" className="jd-signin__toplink">Help</Link>
      </header>
      <main className="jd-signin__main">
        <div className="jd-signin__column">
          <section className="jd-signin__panel">{children}</section>
          {aside}
        </div>
      </main>
      <footer className="jd-signin__foot">
        <Skyline />
        <nav aria-label="Policies" className="jd-signin__policies">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}

export function AuthHeading({ title, children, id = "sign-in-title" }: { title: string; children?: ReactNode; id?: string }) {
  return (
    <div className="jd-signin__heading">
      <h1 id={id}>{title}</h1>
      {children && <div className="jd-signin__lede">{children}</div>}
    </div>
  );
}

export function PhoneField({ phone, setPhone, label = "Mobile number", hint, invalid, errorId = "sign-in-error" }: {
  phone: string;
  setPhone: (phone: string) => void;
  label?: string;
  hint?: string;
  invalid?: boolean;
  errorId?: string;
}) {
  const describedBy = ["phone-hint", invalid ? errorId : ""].filter(Boolean).join(" ");
  return (
    <div className="jd-signin__field">
      <label htmlFor="phone">{label}</label>
      <div className="jd-signin__phone" data-invalid={invalid || undefined}>
        <span aria-hidden="true">+91</span>
        <input
          id="phone" name="phone" type="tel" autoComplete="tel-national" inputMode="tel" maxLength={24}
          value={phone} onChange={(event) => setPhone(event.target.value)}
          aria-describedby={describedBy} aria-invalid={invalid || undefined} required
        />
      </div>
      <p id="phone-hint" className="jd-signin__hint">
        {hint ?? "10-digit Indian mobile number"}
        <span className="sr-only">. Country code +91 is added for you.</span>
      </p>
    </div>
  );
}

export function FormError({ state, id = "sign-in-error" }: { state: ActionState; id?: string }) {
  return (
    <div className="jd-signin__error-slot">
      {state.error ? <p id={id} role="alert" className="jd-signin__error">{state.error}</p> : null}
    </div>
  );
}

export function formatPhone(phone: string) {
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}

/** A low line of apartment blocks — the one society cue on the sign-in screens. */
function Skyline() {
  return (
    <svg className="jd-signin__skyline" viewBox="0 0 640 56" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <path
        d="M0 55.5h640M36 55.5V28h44v27.5M92 55.5V12h56v43.5M160 55.5V34h36v21.5M210 55.5V20h48v35.5M270 55.5V4h64v51.5M346 55.5V24h40v31.5M398 55.5V14h52v41.5M462 55.5V32h34v23.5M508 55.5V18h60v37.5M580 55.5V30h28v25.5"
        fill="none" stroke="currentColor" strokeWidth="1"
      />
      <path
        d="M104 22h8v6h-8zm24 0h8v6h-8zm-24 14h8v6h-8zm24 0h8v6h-8zM284 14h8v6h-8zm18 0h8v6h-8zm18 0h-6v6h6zM284 28h8v6h-8zm18 0h8v6h-8zm12 0h6v6h-6zM410 24h8v6h-8zm20 0h8v6h-8zm-20 14h8v6h-8zm20 0h8v6h-8zM522 28h8v6h-8zm22 0h8v6h-8z"
        fill="currentColor" opacity="0.55"
      />
    </svg>
  );
}
