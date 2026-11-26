import { createClient } from "@supabase/supabase-js";

export const SIGN_IN_UNAVAILABLE = "Sign-in is temporarily unavailable. Please try again later.";

export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const phone = raw.trim().replace(/[\s()-]/g, "");
  return /^(?:\+?91)?[6-9]\d{9}$/.test(phone) ? phone.slice(-10) : null;
}

export function smsAuthConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  if (process.env.VERCEL === "1" &&
      (!process.env.DATABASE_URL?.trim() || !process.env.JODO_TURNSTILE_SITE_KEY?.trim())) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.pathname !== "/" ||
        parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url: parsed.toString(), key };
  } catch {
    return null;
  }
}

export function smsAuth() {
  const config = smsAuthConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8_000) }),
    },
  }).auth;
}
