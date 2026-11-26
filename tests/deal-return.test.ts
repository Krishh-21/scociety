import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string) => cookieJar.set(name, { value }),
  }),
}));

process.env.JODO_DB = ":memory:";

const { openDemoAccount, saveResidency } = await import("@/app/actions");

const sharedDeal = "/deal/deal_ac_sunday";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function signIn(phone: string, next = sharedDeal) {
  return openDemoAccount({}, form({ phone, next }));
}

function redirectedTo(path: string) {
  return expect.objectContaining({
    digest: expect.stringContaining(`;${path};307;`),
  });
}

beforeEach(() => cookieJar.clear());

describe("signing in from a shared deal", () => {
  it("takes an existing resident back to the deal", async () => {
    await expect(signIn("9000000001")).rejects.toMatchObject(redirectedTo(sharedDeal));
  });

  it("takes a first-time resident back to the deal after they claim a flat", async () => {
    await expect(signIn("9876500011")).rejects.toMatchObject(
      redirectedTo("/onboarding?next=%2Fdeal%2Fdeal_ac_sunday"),
    );

    await expect(saveResidency({}, form({
      name: "Asha Rao", societyId: "soc_green_valley", flat: "Z-903", type: "tenant", next: sharedDeal,
    }))).rejects.toMatchObject(redirectedTo(sharedDeal));
  });

  it.each([
    ["9000000010", "/vendor"],
    ["9000000099", "/ops"],
  ])("keeps the console destination for %s", async (phone, next) => {
    await expect(signIn(phone)).rejects.toMatchObject(redirectedTo(next));
  });

  it.each([
    "https://example.com/deal/deal_ac_sunday",
    "//example.com/deal/deal_ac_sunday",
    "/profile",
    "/deal/",
    "/deal/../profile",
    "/deal/deal_ac_sunday?created=1",
    "/deal/deal_ac_sunday/extra",
    "/deal/%2fexample.com",
    "/deal/deal_ac_sunday\n",
  ])("discards the invalid return path %j", async (next) => {
    await expect(signIn("9000000001", next)).rejects.toMatchObject(redirectedTo("/"));
  });

  it("discards an invalid path submitted with a flat claim", async () => {
    await expect(signIn("9876500012", "")).rejects.toMatchObject(redirectedTo("/onboarding"));
    await expect(saveResidency({}, form({
      name: "Kiran Rao", societyId: "soc_green_valley", flat: "Z-904", type: "owner", next: "//example.com",
    }))).rejects.toMatchObject(redirectedTo("/"));
  });
});
