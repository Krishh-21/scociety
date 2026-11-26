import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string) => jar.set(name, { value }),
    delete: (name: string) => jar.delete(name),
  }),
}));

process.env.JODO_DB = ":memory:";

const { openDemoAccount, sendSignInCode, verifyOtp } = await import("@/app/actions");
const { createSession, findOrCreateUser, getMe } = await import("@/lib/session");
const { one } = await import("@/lib/db");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function useSmsProvider() {
  vi.stubEnv("SUPABASE_URL", "https://project.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
  return request;
}

const submittedPhone = "9876512340";
const otpForm = () => form({ phone: submittedPhone, otp: "735128" });

beforeEach(() => {
  jar.clear();
  vi.stubEnv("JODO_AUTH_MODE", "sms");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("JODO_TURNSTILE_SITE_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resident sign-in", () => {
  it("rejects the shared test code and direct demo entry in SMS mode", async () => {
    const request = useSmsProvider();
    await expect(verifyOtp({}, form({ phone: submittedPhone, otp: "1234" }))).resolves.toHaveProperty("error");
    await expect(openDemoAccount({}, form({ phone: submittedPhone }))).resolves.toHaveProperty("error");
    expect(request).not.toHaveBeenCalled();
    expect(jar.size).toBe(0);
  });

  it("returns a usable error when SMS is unconfigured", async () => {
    await expect(sendSignInCode({}, form({ phone: submittedPhone }))).resolves.toMatchObject({
      error: "Sign-in is temporarily unavailable. Please try again later.",
    });
  });

  it("does not send SMS on Vercel without the production security challenge configured", async () => {
    const request = useSmsProvider();
    request.mockResolvedValue(Response.json({}));
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgres://fixture.invalid/jodo");
    await expect(sendSignInCode({}, form({ phone: submittedPhone }))).resolves.toMatchObject({
      error: "Sign-in is temporarily unavailable. Please try again later.",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("requires the browser challenge and sends it to Supabase when configured", async () => {
    const request = useSmsProvider();
    request.mockResolvedValue(Response.json({}));
    vi.stubEnv("JODO_TURNSTILE_SITE_KEY", "fixture-site-key");

    await expect(sendSignInCode({}, form({ phone: submittedPhone }))).resolves.toMatchObject({
      error: "Complete the security check to request a code.",
    });
    expect(request).not.toHaveBeenCalled();

    await expect(sendSignInCode({}, form({
      phone: submittedPhone, "cf-turnstile-response": "fixture-challenge-response",
    }))).resolves.toMatchObject({ phone: submittedPhone });
    const [, sent] = request.mock.calls[0];
    expect(JSON.parse(String(sent?.body))).toMatchObject({
      gotrue_meta_security: { captcha_token: "fixture-challenge-response" },
    });
  });

  it("asks Supabase to send a code to the canonical Indian mobile number", async () => {
    const request = useSmsProvider();
    request.mockResolvedValue(Response.json({}));
    await expect(sendSignInCode({}, form({ phone: "+91 98765 12340" }))).resolves.toMatchObject({ phone: submittedPhone });
    expect(request).toHaveBeenCalledWith("https://project.example/auth/v1/otp", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"+919876512340"'),
    }));
    expect(jar.size).toBe(0);
  });

  it("keeps provider throttling actionable without relaying its error text", async () => {
    const request = useSmsProvider();
    request.mockResolvedValue(Response.json({ error_code: "over_sms_send_rate_limit", msg: "provider details" }, { status: 429 }));
    await expect(sendSignInCode({}, form({ phone: submittedPhone }))).resolves.toMatchObject({
      error: "Wait a minute before requesting another code.",
    });
  });

  it("creates no session when the provider rejects or returns a different phone", async () => {
    const request = useSmsProvider();
    request.mockResolvedValueOnce(Response.json({ error_code: "otp_expired", msg: "expired" }, { status: 403 }));
    await expect(verifyOtp({}, otpForm())).resolves.toHaveProperty("error");
    request.mockResolvedValueOnce(providerSuccess("919876512341"));
    await expect(verifyOtp({}, otpForm())).resolves.toHaveProperty("error");
    expect(jar.size).toBe(0);
  });

  it("creates a JODO session after verified SMS and takes a new resident to onboarding", async () => {
    const request = useSmsProvider();
    request.mockResolvedValueOnce(providerSuccess("919876512340"));
    await expect(verifyOtp({}, otpForm())).rejects.toMatchObject({
      digest: expect.stringContaining(";/onboarding;307;"),
    });
    expect((await getMe())?.user.phone).toBe(submittedPhone);
  });

  it("keeps demo and resident sessions isolated and stores only a hash of the cookie", async () => {
    vi.stubEnv("JODO_AUTH_MODE", "demo");
    const user = await findOrCreateUser("9876512342");
    const token = await createSession(user.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await one("SELECT token FROM session WHERE token = ?", token)).toBeNull();
    expect((await getMe())?.user.id).toBe(user.id);
    const demoCookie = [...jar.values()][0];
    vi.stubEnv("JODO_AUTH_MODE", "sms");
    await createSession(user.id);
    const liveName = [...jar.keys()].find((key) => !key.includes("demo"))!;
    jar.set(liveName, demoCookie);
    expect(await getMe()).toBeNull();
  });
});

function providerSuccess(phone: string) {
  return Response.json({
    access_token: "fixture-access-token",
    refresh_token: "fixture-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "provider-user", phone, phone_confirmed_at: "2026-01-01T00:00:00Z" },
  });
}
