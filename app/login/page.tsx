import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { dealReturnPath } from "@/lib/deal-return";
import { emailAuthEnabled, getPendingEmailLink } from "@/lib/email-auth";
import { getPendingGoogleLink, googleAuthConfig } from "@/lib/google-auth";
import { smsAuthConfig } from "@/lib/phone-auth";
import { getMe } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; google?: string | string[] }>;
}) {
  const { next, google } = await searchParams;
  if (await getMe()) redirect("/");
  if (isDemoMode()) {
    return <LoginForm mode="demo" demoHref={demoSignInHref(dealReturnPath(next))} />;
  }
  const googleEnabled = !!googleAuthConfig();
  const emailEnabled = emailAuthEnabled();
  const [pendingGoogle, pendingEmail] = await Promise.all([
    googleEnabled ? getPendingGoogleLink() : null,
    emailEnabled ? getPendingEmailLink() : null,
  ]);
  const googleError = google === "inactive"
    ? "This account has no active access. Contact your society committee."
    : google === "failed" ? "Google sign-in couldn’t finish. Try again or use SMS." : undefined;
  return (
    <LoginForm
      mode={smsAuthConfig() ? "sms" : "unavailable"}
      turnstileSiteKey={process.env.JODO_TURNSTILE_SITE_KEY?.trim()}
      googleEnabled={googleEnabled}
      googleEmail={pendingGoogle?.email}
      googleLinkId={pendingGoogle?.id}
      googleError={googleEnabled ? googleError : undefined}
      emailEnabled={emailEnabled}
      emailLinkEmail={pendingEmail?.email}
      emailLinkId={pendingEmail?.id}
    />
  );
}

function demoSignInHref(next: string | undefined) {
  return next ? `/demo/sign-in?${new URLSearchParams({ next })}` : "/demo/sign-in";
}
