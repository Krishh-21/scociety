import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { accountLink, authCookieName, writeAuthCookie } from "./account-link";
import { isDemoMode } from "./auth-mode";
import { smsAuthConfig } from "./phone-auth";
import { SITE_URL } from "./site";

const STORAGE_KEY = "jodo-google";
const FLOW_ID = /^[A-Za-z0-9_-]{12,64}$/;
const PKCE_COOKIE = "jodo_google_pkce";

type GoogleIdentity = { subject: string; email: string };

export function googleAuthConfig() {
  if (isDemoMode() || process.env.JODO_GOOGLE_SIGN_IN !== "1") return null;
  const auth = smsAuthConfig();
  if (!auth) return null;
  const site = new URL(SITE_URL);
  const loopback = ["localhost", "127.0.0.1"].includes(site.hostname) && process.env.VERCEL !== "1";
  if ((site.protocol !== "https:" && !(site.protocol === "http:" && loopback)) || site.username || site.password) return null;
  return { ...auth, origin: site.origin };
}

const googleLink = accountLink("google", () => !!googleAuthConfig());
export const findGoogleUser = googleLink.findUser;
export const beginGoogleLink = googleLink.begin;
export const getPendingGoogleLink = googleLink.pending;
export const requireGoogleLink = googleLink.require;
export const linkVerifiedGoogle = googleLink.linkVerified;

type GoogleConfig = NonNullable<ReturnType<typeof googleAuthConfig>>;

function oauthClient(config: GoogleConfig, values = new Map<string, string>()) {
  const client = createClient(config.url, config.key, {
    auth: {
      flowType: "pkce", storageKey: STORAGE_KEY, autoRefreshToken: false, detectSessionInUrl: false,
      // Keep the exchange session in memory. Only the PKCE verifier leaves this request.
      persistSession: true,
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: (key) => { values.delete(key); },
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8_000) }) },
  });
  return client.auth;
}

export async function clearGoogleSignIn() {
  const jar = await cookies();
  if (jar.get(authCookieName(PKCE_COOKIE))) writeAuthCookie(jar, PKCE_COOKIE, "", 0);
  await googleLink.clear();
}

export async function startGoogleSignIn(config: GoogleConfig) {
  await clearGoogleSignIn();
  const storage = new Map<string, string>();
  const { data, error } = await oauthClient(config, storage).signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: config.origin + "/auth/google/callback",
      scopes: "openid email",
      queryParams: { prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url || !data.flowId || !FLOW_ID.test(data.flowId)) return null;
  const verifier = storage.get(STORAGE_KEY + "-flow-" + data.flowId + "-code-verifier");
  if (!verifier) return null;
  const destination = new URL(data.url);
  if (destination.origin !== new URL(config.url).origin || destination.pathname !== "/auth/v1/authorize") return null;
  writeAuthCookie(await cookies(), PKCE_COOKIE, JSON.stringify([data.flowId, verifier]));
  return destination;
}

export async function exchangeGoogleCode(config: GoogleConfig, code: string) {
  const jar = await cookies();
  const saved = jar.get(authCookieName(PKCE_COOKIE))?.value;
  writeAuthCookie(jar, PKCE_COOKIE, "", 0);
  if (!saved || saved.length > 400 || !code || code.length > 512) return null;
  const [flowId, verifier] = JSON.parse(saved) as [unknown, unknown];
  if (typeof flowId !== "string" || !FLOW_ID.test(flowId) || typeof verifier !== "string" ||
      !/^"[A-Za-z0-9._~-]{43,128}"$/.test(verifier)) return null;
  const storage = new Map([[STORAGE_KEY + "-flow-" + flowId + "-code-verifier", verifier]]);
  const { data, error } = await oauthClient(config, storage).exchangeCodeForSession(code, { flowId });
  if (error || !data.user || !data.session?.provider_token) return null;
  return verifyGoogleIdentity(data.user, data.session.provider_token);
}

async function verifyGoogleIdentity(user: SupabaseUser, providerToken: string): Promise<GoogleIdentity | null> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: "Bearer " + providerToken }, cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const { sub, email, email_verified: verified } = await response.json();
  if (typeof sub !== "string" || !/^[A-Za-z0-9_-]{1,255}$/.test(sub) ||
      typeof email !== "string" || email.length > 254 || !email.includes("@") || verified !== true ||
      !user.identities?.some((identity) => identity.provider === "google" && identity.id === sub)) return null;
  return { subject: sub, email };
}
