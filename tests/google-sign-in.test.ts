import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, { value: string; httpOnly?: boolean; sameSite?: string }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options: { maxAge?: number; httpOnly?: boolean; sameSite?: string }) => {
      if (options.maxAge === 0) jar.delete(name);
      else jar.set(name, { ...options, value });
    },
  }),
}));

process.env.JODO_DB = ":memory:";

const { GET: start } = await import("@/app/auth/google/route");
const { GET: callback } = await import("@/app/auth/google/callback/route");
const { GET: cancel } = await import("@/app/auth/google/cancel/route");
const { verifyOtp } = await import("@/app/actions");
const { findOrCreateUser, getMe } = await import("@/lib/session");
const { beginGoogleLink, findGoogleUser, getPendingGoogleLink, linkVerifiedGoogle } = await import("@/lib/google-auth");
const { run } = await import("@/lib/db");

const origin = "http://localhost:3127";
const phone = "9876512471";
const request = vi.fn<typeof fetch>();

function route(path: string) {
  return new Request(origin + path);
}

function smsForm(number: string, googleLinkId?: string) {
  const form = new FormData();
  form.set("phone", number);
  form.set("otp", "322416");
  if (googleLinkId) form.set("googleLinkId", googleLinkId);
  return form;
}

function authResult(subject?: string, number: string = phone) {
  return Response.json({
    access_token: "fixture-access",
    refresh_token: "fixture-refresh",
    expires_in: 3600,
    token_type: "bearer",
    provider_token: subject ? "fixture-google-token" : undefined,
    user: {
      id: "fixture-supabase-user",
      phone: "91" + number,
      phone_confirmed_at: "2026-01-01T00:00:00Z",
      identities: subject ? [{ id: subject, provider: "google" }] : [],
    },
  });
}

function googleProof(identitySubject: string, googleSubject = identitySubject) {
  request.mockResolvedValueOnce(authResult(identitySubject));
  request.mockResolvedValueOnce(Response.json({
    sub: googleSubject, email: "resident@example.com", email_verified: true,
  }));
}

beforeEach(() => {
  jar.clear();
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.stubEnv("JODO_AUTH_MODE", "sms");
  vi.stubEnv("JODO_GOOGLE_SIGN_IN", "1");
  vi.stubEnv("SUPABASE_URL", "https://project.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-publishable-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google sign-in", () => {
  it("uses PKCE, verifies the Google subject, then links to the existing verified phone account", async () => {
    const resident = await findOrCreateUser(phone);
    const redirect = await start(route("/auth/google"));
    const destination = new URL(redirect.headers.get("location")!);
    expect(destination.origin + destination.pathname).toBe("https://project.example/auth/v1/authorize");
    expect(destination.searchParams.get("provider")).toBe("google");
    expect(destination.searchParams.get("redirect_to")).toBe(origin + "/auth/google/callback");
    expect(destination.searchParams.get("code_challenge_method")).toBe("s256");
    expect(destination.searchParams.get("code_challenge")).toBeTruthy();
    expect(jar.get("jodo_google_pkce")).toMatchObject({ httpOnly: true, sameSite: "lax" });

    googleProof("google-resident");
    const redirected = await callback(route("/auth/google/callback?code=one-time-code"));
    expect(redirected.headers.get("location")).toBe(origin + "/login");
    expect(redirected.headers.get("referrer-policy")).toBe("no-referrer");
    expect(request).toHaveBeenNthCalledWith(1, "https://project.example/auth/v1/token?grant_type=pkce", expect.objectContaining({ method: "POST" }));
    expect(request).toHaveBeenNthCalledWith(2, "https://openidconnect.googleapis.com/v1/userinfo", expect.objectContaining({
      headers: { Authorization: "Bearer fixture-google-token" },
    }));
    expect(jar.has("jodo_google_pkce")).toBe(false);
    expect(await getMe()).toBeNull();
    const pending = await getPendingGoogleLink();
    expect(pending?.email).toBe("resident@example.com");
    expect(await findGoogleUser("google-resident")).toBeNull();

    request.mockResolvedValueOnce(authResult());
    await expect(verifyOtp({}, smsForm(phone, pending!.id))).rejects.toMatchObject({ digest: expect.stringContaining(";/onboarding;307;") });
    expect((await getMe())?.user.id).toBe(resident.id);
    expect((await findGoogleUser("google-resident"))?.id).toBe(resident.id);
    expect(await getPendingGoogleLink()).toBeNull();
    expect(JSON.stringify([...jar.values()])).not.toContain("fixture-google-token");

    jar.clear();
    await start(route("/auth/google"));
    googleProof("google-resident");
    expect((await callback(route("/auth/google/callback?code=second-code"))).headers.get("location")).toBe(origin + "/onboarding");
    expect((await getMe())?.user.id).toBe(resident.id);
  });

  it("rejects callbacks without the verifier or without a matching verified Google identity", async () => {
    expect((await callback(route("/auth/google/callback?code=unsolicited"))).headers.get("location")).toBe(origin + "/login?google=failed");
    expect(request).not.toHaveBeenCalled();
    await start(route("/auth/google"));
    googleProof("existing-subject", "different-subject");
    expect((await callback(route("/auth/google/callback?code=mismatch"))).headers.get("location")).toBe(origin + "/login?google=failed");
    expect(await getMe()).toBeNull();
    expect(await getPendingGoogleLink()).toBeNull();
  });

  it("keeps a previous form from attaching a newer Google account and preserves ordinary SMS", async () => {
    await beginGoogleLink({ subject: "first-tab", email: "first@example.com" });
    const older = await getPendingGoogleLink();
    await beginGoogleLink({ subject: "second-tab", email: "second@example.com" });
    const newer = await getPendingGoogleLink();
    await expect(verifyOtp({}, smsForm(phone, older!.id))).resolves.toHaveProperty("error");
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValueOnce(authResult());
    await expect(verifyOtp({}, smsForm(phone))).rejects.toMatchObject({ digest: expect.stringContaining(";/onboarding;307;") });
    expect(await findGoogleUser("second-tab")).toBeNull();
    expect(await getPendingGoogleLink()).toBeNull();
    expect(newer?.id).not.toBe(older?.id);
  });

  it("won't move a Google identity to another phone account or override an existing link", async () => {
    const first = await findOrCreateUser("9876512472");
    const second = await findOrCreateUser("9876512473");
    const proof = { subject: "existing-link", email: "resident@example.com" };
    await beginGoogleLink(proof);
    await linkVerifiedGoogle((await getPendingGoogleLink())!.id, first.id);
    await beginGoogleLink(proof);
    await expect(linkVerifiedGoogle((await getPendingGoogleLink())!.id, second.id)).rejects.toThrow(/already linked/);
    expect((await findGoogleUser(proof.subject))?.id).toBe(first.id);
    await beginGoogleLink({ ...proof, subject: "replacement" });
    await expect(linkVerifiedGoogle((await getPendingGoogleLink())!.id, first.id)).rejects.toThrow(/already linked/);
    expect(await findGoogleUser("replacement")).toBeNull();
    await cancel(route("/auth/google/cancel"));
    expect(await getPendingGoogleLink()).toBeNull();
  });

  it("does not let a linked, inactive guard enter via Google", async () => {
    const guard = await findOrCreateUser("9876512474");
    await run("UPDATE user SET role = 'guard' WHERE id = ?", guard.id);
    await beginGoogleLink({ subject: "guard-google", email: "guard@example.com" });
    await linkVerifiedGoogle((await getPendingGoogleLink())!.id, guard.id);
    await start(route("/auth/google"));
    googleProof("guard-google");
    expect((await callback(route("/auth/google/callback?code=inactive"))).headers.get("location")).toBe(origin + "/login?google=inactive");
    expect(await getMe()).toBeNull();
  });

  it("is disabled on the private demo or when its configuration is off", async () => {
    vi.stubEnv("JODO_AUTH_MODE", "demo");
    expect((await start(route("/auth/google"))).headers.get("location")).toBe(origin + "/login");
    vi.stubEnv("JODO_AUTH_MODE", "sms");
    vi.stubEnv("JODO_GOOGLE_SIGN_IN", "");
    expect((await callback(route("/auth/google/callback?code=disabled"))).headers.get("location")).toBe(origin + "/login");
    expect(request).not.toHaveBeenCalled();
    expect(jar.size).toBe(0);
  });
});
