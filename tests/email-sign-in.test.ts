import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options: { maxAge?: number }) => {
      if (options.maxAge === 0) jar.delete(name);
      else jar.set(name, { value });
    },
  }),
}));

process.env.JODO_DB = ":memory:";
const { sendEmailSignInCode, verifyEmailSignInCode, verifyOtp } = await import("@/app/actions");
const { findEmailUser, getPendingEmailLink } = await import("@/lib/email-auth");
const { findOrCreateUser, getMe } = await import("@/lib/session");

const request = vi.fn<typeof fetch>();
const email = "resident@example.com";
const phone = "9876512400";
const otp = "735128";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function providerUser(user: Record<string, string>) {
  return Response.json({
    access_token: "fixture-access", refresh_token: "fixture-refresh", expires_in: 3600,
    token_type: "bearer", user: { id: "provider-user", ...user },
  });
}

beforeEach(() => {
  jar.clear();
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("JODO_TURNSTILE_SITE_KEY", "");
  vi.stubEnv("JODO_AUTH_MODE", "sms");
  vi.stubEnv("JODO_EMAIL_SIGN_IN", "1");
  vi.stubEnv("SUPABASE_URL", "https://project.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email sign-in", () => {
  it("requires CAPTCHA when configured and sends the challenge with the normalized address", async () => {
    vi.stubEnv("JODO_TURNSTILE_SITE_KEY", "fixture-site-key");
    await expect(sendEmailSignInCode({}, form({ email }))).resolves.toHaveProperty("error");
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValueOnce(Response.json({}));
    await expect(sendEmailSignInCode({}, form({
      email: " Resident@Example.com ", "cf-turnstile-response": "fixture-challenge",
    }))).resolves.toHaveProperty("email", email);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      email, gotrue_meta_security: { captcha_token: "fixture-challenge" },
    });
  });

  it("links only after SMS and subsequently signs in to the same account using email alone", async () => {
    const resident = await findOrCreateUser(phone);
    request.mockResolvedValueOnce(providerUser({ email, email_confirmed_at: "2026-01-01" }));
    await expect(verifyEmailSignInCode({}, form({ email, otp }))).rejects.toMatchObject({
      digest: expect.stringContaining(";/login;307;"),
    });
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ email, type: "email", token: otp });
    const pending = await getPendingEmailLink();
    expect(pending?.email).toBe(email);
    expect(await getMe()).toBeNull();
    expect(await findEmailUser(email)).toBeNull();

    await expect(verifyOtp({}, form({ phone, otp, emailLinkId: "stale" }))).resolves.toHaveProperty("error");
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce(providerUser({ phone: `91${phone}`, phone_confirmed_at: "2026-01-01" }));
    await expect(verifyOtp({}, form({ phone, otp, emailLinkId: pending!.id }))).rejects.toMatchObject({
      digest: expect.stringContaining(";/onboarding;307;"),
    });
    expect(await getPendingEmailLink()).toBeNull();
    expect((await findEmailUser(email))?.id).toBe(resident.id);

    jar.clear();
    request.mockResolvedValueOnce(providerUser({ email, email_confirmed_at: "2026-01-01" }));
    await expect(verifyEmailSignInCode({}, form({ email, otp }))).rejects.toMatchObject({
      digest: expect.stringContaining(";/onboarding;307;"),
    });
    expect((await getMe())?.user.id).toBe(resident.id);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("rejects an address that differs from the verified claim, and is disabled in demo", async () => {
    request.mockResolvedValueOnce(providerUser({ email: "different@example.com", email_confirmed_at: "2026-01-01" }));
    await expect(verifyEmailSignInCode({}, form({ email, otp }))).resolves.toHaveProperty("error");
    expect(await getPendingEmailLink()).toBeNull();
    expect(await getMe()).toBeNull();
    vi.stubEnv("JODO_AUTH_MODE", "demo");
    await expect(verifyEmailSignInCode({}, form({ email, otp }))).resolves.toHaveProperty("error");
    await expect(sendEmailSignInCode({}, form({ email }))).resolves.toHaveProperty("error");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
