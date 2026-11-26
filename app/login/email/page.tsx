import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { emailAuthEnabled, getPendingEmailLink } from "@/lib/email-auth";
import { getMe } from "@/lib/session";
import LoginForm from "../LoginForm";

export const metadata: Metadata = { title: "Sign in with email", robots: { index: false, follow: false } };

export default async function EmailLoginPage() {
  if (await getMe()) redirect("/");
  if (!emailAuthEnabled() || await getPendingEmailLink()) redirect("/login");
  return <LoginForm mode="email" turnstileSiteKey={process.env.JODO_TURNSTILE_SITE_KEY?.trim()} />;
}
