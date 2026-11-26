"use client";

import Link from "next/link";
import Script from "next/script";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendEmailSignInCode, sendSignInCode, verifyEmailSignInCode, verifyOtp } from "@/app/actions";
import { AuthHeading, AuthShell, FormError, PhoneField, formatPhone } from "./auth-ui";

type LoginFormProps = {
  mode: "sms" | "email" | "demo" | "unavailable";
  /** Only set in demo mode, so the demo entry can return to a shared deal. */
  demoHref?: string;
  turnstileSiteKey?: string;
  googleEnabled?: boolean;
  googleEmail?: string;
  googleLinkId?: string;
  googleError?: string;
  emailEnabled?: boolean;
  emailLinkEmail?: string;
  emailLinkId?: string;
};

type PendingLink = { method: "google" | "email"; email: string; id: string };
type CodeRecipient = { method: "sms"; phone: string } | { method: "email"; email: string };

export default function LoginForm({ mode, demoHref, ...props }: LoginFormProps) {
  if (mode === "email") {
    return <AuthShell><EmailLogin siteKey={props.turnstileSiteKey} /></AuthShell>;
  }

  return (
    <AuthShell>
      {mode === "sms"
        ? <SmsLogin {...props} />
        : <Unavailable demoHref={mode === "demo" ? demoHref ?? "/demo/sign-in" : undefined} />}
    </AuthShell>
  );
}

function Unavailable({ demoHref }: { demoHref?: string }) {
  return (
    <>
      <AuthHeading title="Sign in to JODO">
        <p>Use the mobile number registered with your society.</p>
      </AuthHeading>
      <div className="jd-signin__notice">
        <p className="jd-signin__notice-title">Text-message sign-in is off</p>
        <p>
          {demoHref
            ? "SMS sign-in is unavailable in this test workspace."
            : "We can’t send sign-in codes right now. Please try again later."}
        </p>
      </div>
      {demoHref && <Link href={demoHref} className="btn btn-quiet w-full">Open demo</Link>}
      <p className="jd-signin__help">
        Need access? <Link href="/help#getting-started">Read the sign-in guide</Link>
      </p>
    </>
  );
}

function SmsLogin({
  turnstileSiteKey: siteKey, googleEnabled, googleEmail, googleLinkId, googleError,
  emailEnabled, emailLinkEmail, emailLinkId,
}: Omit<LoginFormProps, "mode" | "demoHref">) {
  const [request, sendCode, sending] = useActionState(sendSignInCode, {});
  const [backFrom, setBackFrom] = useState<typeof request>();
  const [phone, setPhone] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const phoneInput = useRef<HTMLDivElement>(null);
  const link: PendingLink | undefined = emailLinkEmail && emailLinkId
    ? { method: "email", email: emailLinkEmail, id: emailLinkId }
    : googleEmail && googleLinkId ? { method: "google", email: googleEmail, id: googleLinkId } : undefined;

  useEffect(() => {
    if (backFrom) phoneInput.current?.querySelector("input")?.focus();
  }, [backFrom]);

  if (request.phone && backFrom !== request) {
    return (
      <ConfirmCode
        recipient={{ method: "sms", phone: request.phone }}
        link={link}
        returnToInput={(resend) => {
          setPhone(resend ? request.phone ?? "" : "");
          setCaptchaToken("");
          setBackFrom(request);
        }}
      />
    );
  }

  const blocked = sending || (!!siteKey && !captchaToken);
  return (
    <>
      <AuthHeading title={link ? "Confirm your mobile number" : "Sign in to JODO"}>
        {link ? (
          <p>
            {link.method === "google" ? "You’re signed in with Google as " : "You’ve verified "}
            <strong className="jd-signin__email"><bdi>{link.email}</bdi></strong>.
            Enter the Indian mobile number registered with your society. We’ll text you a 6-digit code to link
            {link.method === "google" ? " your Google account" : " your email address"} to JODO.
          </p>
        ) : (
          <p>Use the mobile number registered with your society. We’ll text you a 6-digit code.</p>
        )}
      </AuthHeading>
      <form action={sendCode} className="jd-signin__form" aria-busy={sending}>
        <div ref={phoneInput}>
          <PhoneField phone={phone} setPhone={setPhone} invalid={!!request.error} />
        </div>
        {siteKey && <Turnstile siteKey={siteKey} reset={request} onToken={setCaptchaToken} />}
        <input type="hidden" name="cf-turnstile-response" value={captchaToken} />
        {link && <LinkIntent link={link} />}
        <FormError state={request} />
        <button className="btn btn-primary w-full" type="submit" disabled={blocked}>
          {sending ? "Sending code…" : "Send code"}
        </button>
        {siteKey && !captchaToken && !sending && (
          <p className="jd-signin__hint jd-signin__center">Complete the security check to continue</p>
        )}
      </form>
      {(link || googleEnabled || googleError || emailEnabled) && (
        <div className="jd-signin__alternative">
          {link ? <CancelLinkSignIn method={link.method} /> : (
            <>
              <FormError state={{ error: googleError }} id="google-sign-in-error" />
              {googleEnabled && (
                <a href="/auth/google" className="btn btn-quiet w-full">
                  {googleError ? "Try Google again" : "Continue with Google"}
                </a>
              )}
              {emailEnabled && <Link href="/login/email" className="btn btn-quiet w-full">Continue with email</Link>}
            </>
          )}
        </div>
      )}
      <p className="jd-signin__help">
        New here or changed your number? <Link href="/help#getting-started">Get help</Link>
      </p>
    </>
  );
}

function LinkIntent({ link }: { link: PendingLink }) {
  return <input type="hidden" name={link.method === "google" ? "googleLinkId" : "emailLinkId"} value={link.id} />;
}

function CancelLinkSignIn({ method }: { method: PendingLink["method"] }) {
  return (
    <a href={`/auth/${method}/cancel`} className="btn btn-quiet w-full">
      {method === "google" ? "Cancel Google sign-in" : "Cancel email sign-in"}
    </a>
  );
}

function EmailLogin({ siteKey }: { siteKey?: string }) {
  const [request, sendCode, sending] = useActionState(sendEmailSignInCode, {});
  const [backFrom, setBackFrom] = useState<typeof request>();
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (backFrom) emailInput.current?.focus();
  }, [backFrom]);

  if (request.email && backFrom !== request) {
    return (
      <ConfirmCode
        recipient={{ method: "email", email: request.email }}
        returnToInput={(resend) => {
          setEmail(resend ? request.email ?? "" : "");
          setCaptchaToken("");
          setBackFrom(request);
        }}
      />
    );
  }

  return (
    <>
      <AuthHeading title="Sign in with email">
        <p>We’ll send a 6-digit code to your email address.</p>
      </AuthHeading>
      <form action={sendCode} className="jd-signin__form" aria-busy={sending}>
        <div className="jd-signin__field">
          <label htmlFor="email">Email address</label>
          <input
            ref={emailInput} id="email" name="email" className="jd-signin__email-input" type="email"
            autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254}
            value={email} onChange={(event) => setEmail(event.target.value)}
            aria-invalid={request.error ? true : undefined}
            aria-describedby={request.error ? "sign-in-error" : undefined}
          />
        </div>
        {siteKey && <Turnstile siteKey={siteKey} reset={request} onToken={setCaptchaToken} />}
        <input type="hidden" name="cf-turnstile-response" value={captchaToken} />
        <FormError state={request} />
        <button className="btn btn-primary w-full" type="submit" disabled={sending || (!!siteKey && !captchaToken)}>
          {sending ? "Sending code…" : "Send email code"}
        </button>
        {siteKey && !captchaToken && !sending && (
          <p className="jd-signin__hint jd-signin__center">Complete the security check to continue</p>
        )}
      </form>
      <UseMobileNumber />
    </>
  );
}

function UseMobileNumber() {
  return (
    <div className="jd-signin__alternative">
      <Link href="/login" className="btn btn-quiet w-full">Use mobile number</Link>
    </div>
  );
}

function ConfirmCode({ recipient, link, returnToInput }: {
  recipient: CodeRecipient;
  link?: PendingLink;
  returnToInput: (resend: boolean) => void;
}) {
  const isEmail = recipient.method === "email";
  const [state, action, pending] = useActionState(isEmail ? verifyEmailSignInCode : verifyOtp, {});
  const [code, setCode] = useState("");
  const otp = useRef<HTMLInputElement>(null);
  const wait = useResendWait();
  const submitLabel = link?.method === "google" ? "Link Google account"
    : link?.method === "email" ? "Link email address" : isEmail ? "Verify email code" : "Sign in";

  useEffect(() => {
    otp.current?.focus();
  }, []);

  return (
    <>
      <AuthHeading title="Enter your code">
        <p>
          <span className="sr-only" role="status">Code sent. </span>
          We sent a 6-digit code to{" "}
          {isEmail
            ? <strong className="jd-signin__email"><bdi>{recipient.email}</bdi></strong>
            : <strong className="tnum">{formatPhone(recipient.phone)}</strong>}.{" "}
          <button type="button" className="jd-signin__inline" disabled={pending} onClick={() => returnToInput(false)}>
            {isEmail ? "Change email" : "Change number"}
          </button>
        </p>
      </AuthHeading>
      <form action={action} className="jd-signin__form" aria-busy={pending}>
        {isEmail
          ? <input type="hidden" name="email" value={recipient.email} />
          : <input type="hidden" name="phone" value={recipient.phone} />}
        {link && <LinkIntent link={link} />}
        <div className="jd-signin__field">
          <label htmlFor="otp">Sign-in code</label>
          <input
            ref={otp} id="otp" name="otp" className="jd-signin__otp tnum" type="text" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9]{6}" required spellCheck={false} autoCorrect="off"
            placeholder="••••••" title="6-digit code"
            value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "otp-hint sign-in-error" : "otp-hint"}
          />
          <p id="otp-hint" className="jd-signin__hint">Use the most recent code we sent</p>
        </div>
        <FormError state={state} />
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Verifying…" : submitLabel}
        </button>
      </form>
      {link && <div className="jd-signin__alternative"><CancelLinkSignIn method={link.method} /></div>}
      {isEmail && <UseMobileNumber />}
      <p className="jd-signin__help">
        Didn’t get it?{" "}
        {wait > 0
          ? <span className="tnum">You can request a new code in {wait}s</span>
          : <button type="button" className="jd-signin__inline" disabled={pending} onClick={() => returnToInput(true)}>Request a new code</button>}
      </p>
    </>
  );
}

/** Seconds left before another code may be requested (the provider allows one a minute). */
function useResendWait() {
  const [wait, setWait] = useState(60);
  useEffect(() => {
    const readyAt = performance.now() + 60_000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((readyAt - performance.now()) / 1000));
      setWait(left);
      if (left === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return wait;
}

type TurnstileClient = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(widget: string): void;
};

function Turnstile({ siteKey, reset, onToken }: {
  siteKey: string;
  reset: object;
  onToken: (token: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const target = element.current;
    const api = (window as Window & { turnstile?: TurnstileClient }).turnstile;
    if (!loaded || !target || !api) return;
    onToken("");
    const widget = api.render(target, {
      sitekey: siteKey, size: target.clientWidth < 300 ? "compact" : "normal",
      "response-field": false,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    return () => api.remove(widget);
  }, [loaded, onToken, reset, siteKey]);
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} onError={() => setFailed(true)} />
      <div ref={element} className="jd-signin__captcha" aria-label="Security check" />
      {failed && <p role="alert" className="jd-signin__error">The security check couldn’t load. Reload this page and try again.</p>}
    </>
  );
}
