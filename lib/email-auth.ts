import { createHash } from "node:crypto";
import { accountLink } from "./account-link";
import { isDemoMode } from "./auth-mode";
import { smsAuthConfig } from "./phone-auth";

export function emailAuthEnabled() {
  return !isDemoMode() && process.env.JODO_EMAIL_SIGN_IN === "1" && !!smsAuthConfig();
}

export function normalizeSignInEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function emailSubject(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

const emailLink = accountLink("email", emailAuthEnabled);
export const getPendingEmailLink = emailLink.pending;
export const clearEmailSignIn = emailLink.clear;
export const requireEmailLink = emailLink.require;
export const linkVerifiedEmail = emailLink.linkVerified;

export function findEmailUser(email: string) {
  return emailLink.findUser(emailSubject(email));
}

export function beginEmailLink(email: string) {
  return emailLink.begin({ subject: emailSubject(email), email });
}
