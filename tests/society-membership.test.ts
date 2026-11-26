import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Me } from "@/lib/session";

const cookieJar = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string) => cookieJar.set(name, { value }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const dbFile = path.join(os.tmpdir(), `jodo-membership-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;
process.env.JODO_AUTH_MODE = "sms";

const { saveResidency } = await import("@/app/actions");
const { reviewFlatRequest, revokeFlatMembership } = await import("@/app/society/membership/actions");
const { all, one, run } = await import("@/lib/db");
const { claimResidency, createSession, findOrCreateUser, getMe } = await import("@/lib/session");
const { requireSocietyMember } = await import("@/lib/society-access");
const { listMembershipRequests, listVerifiedResidents, reviewMembershipRequest, revokeMembership } = await import("@/lib/society-membership");

const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";

async function account(userId: string): Promise<Me> {
  await createSession(userId);
  return (await getMe())!;
}

async function applicant(phone: string) {
  return (await findOrCreateUser(phone)).id;
}

function claim(userId: string, flat: string, societyId = GREEN) {
  return claimResidency({ userId, name: "Asha Rao", societyId, flat, type: "tenant" });
}

beforeAll(async () => {
  await run(
    `INSERT INTO society (id, name, locality, city, flatCount)
     VALUES (?, 'Green Valley', 'Aundh', 'Pune', 100), (?, 'Palm Grove', 'Hinjewadi', 'Pune', 120)`,
    GREEN, PALM,
  );
  await run(
    `INSERT INTO user (id, phone, name, role)
     VALUES ('usr_rahul', '9000000001', 'Rahul Mehta', 'resident'),
            ('usr_kulkarni', '9000000002', 'Amit Kulkarni', 'secretary')`,
  );
  await run(
    `INSERT INTO residency (id, userId, societyId, flat, type, status, createdAt)
     VALUES ('res_rahul', 'usr_rahul', ?, 'A-402', 'owner', 'verified', '2026-01-01'),
            ('res_kulkarni', 'usr_kulkarni', ?, 'A-404', 'owner', 'verified', '2026-01-01')`,
    GREEN, GREEN,
  );
});
beforeEach(() => cookieJar.clear());
afterAll(() => {
  for (const file of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* SQLite can keep the files open on Windows. */
    }
  }
});

describe("production flat membership", () => {
  it("keeps a shared deal return path while the flat is pending", async () => {
    const userId = await applicant("9876500140");
    await account(userId);
    const form = new FormData();
    form.set("name", "Asha Rao");
    form.set("societyId", GREEN);
    form.set("flat", "Z-901");
    form.set("type", "tenant");
    form.set("next", "/deal/deal_ac_sunday");

    await expect(saveResidency({}, form)).rejects.toMatchObject({
      digest: expect.stringContaining(";/onboarding?next=%2Fdeal%2Fdeal_ac_sunday;307;"),
    });
    const pending = await getMe();
    expect(pending?.residency).toMatchObject({ status: "pending", flat: "Z-901" });
    expect(() => requireSocietyMember(pending)).toThrow(/verified resident/i);

    await account("usr_kulkarni");
    const review = new FormData();
    review.set("requestId", pending!.residency!.id);
    review.set("decision", "approve");
    await expect(reviewFlatRequest({}, review)).resolves.toEqual({});
    expect(requireSocietyMember(await account(userId))).toMatchObject({ status: "verified", flat: "Z-901" });
  });

  it("requires the local verified committee to approve and unlock access", async () => {
    const userId = await applicant("9876500141");
    const request = await claim(userId, "z 905");
    const pending = await account(userId);
    const committee = await account("usr_kulkarni");
    const neighbour = await account("usr_rahul");

    expect(request).toMatchObject({ flat: "Z-905", status: "pending" });
    expect(pending.residency).toMatchObject({ id: request.id, status: "pending" });
    expect(() => requireSocietyMember(pending)).toThrow(/verified resident/i);
    await expect(listMembershipRequests(neighbour)).rejects.toThrow(/committee/i);
    await expect(reviewMembershipRequest(neighbour, request.id, "approve")).rejects.toThrow(/committee/i);
    await expect(reviewMembershipRequest(pending, request.id, "approve")).rejects.toThrow(/verified resident/i);

    await expect(listMembershipRequests(committee)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: request.id, flat: "Z-905", name: "Asha Rao", phone: "9876500141" }),
    ]));
    await reviewMembershipRequest(committee, request.id, "approve");

    expect(requireSocietyMember(await account(userId))).toMatchObject({ flat: "Z-905", status: "verified" });
    expect(await one("SELECT verifiedVia FROM residency WHERE id = ?", request.id)).toEqual({ verifiedVia: "committee" });
    await expect(reviewMembershipRequest(committee, request.id, "reject")).rejects.toThrow(/awaiting review/i);
  });

  it("scopes both the queue and the decision to the committee's own society", async () => {
    const userId = await applicant("9876500142");
    const request = await claim(userId, "Z-906", PALM);
    const committee = await account("usr_kulkarni");

    expect(await listMembershipRequests(committee)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: request.id }),
    ]));
    await expect(reviewMembershipRequest(committee, request.id, "approve")).rejects.toThrow(/awaiting review/i);
    expect((await account(userId)).residency?.status).toBe("pending");
  });

  it("allows a rejected request to be retried with a fresh identity", async () => {
    const userId = await applicant("9876500143");
    const original = await claim(userId, "Z-907");
    const committee = await account("usr_kulkarni");
    await reviewMembershipRequest(committee, original.id, "reject");

    expect((await account(userId)).residency).toMatchObject({ id: original.id, status: "rejected" });
    const retried = await claim(userId, "Z-907");
    expect(retried.id).not.toBe(original.id);
    expect(retried.status).toBe("pending");
    await expect(reviewMembershipRequest(committee, original.id, "approve")).rejects.toThrow(/awaiting review/i);
    expect((await account(userId)).residency).toMatchObject({ id: retried.id, status: "pending" });
  });

  it("handles repeat submissions and only approves one claimant for a flat", async () => {
    const first = await applicant("9876500144");
    const second = await applicant("9876500145");
    const [original, repeat, competing] = await Promise.all([
      claim(first, "Z-908"), claim(first, "Z-908"), claim(second, "Z-908"),
    ]);
    expect(repeat.id).toBe(original.id);
    await expect(claim(first, "Z-909")).rejects.toThrow(/waiting for review/i);

    const committee = await account("usr_kulkarni");
    const decisions = await Promise.allSettled([
      reviewMembershipRequest(committee, original.id, "approve"),
      reviewMembershipRequest(committee, competing.id, "approve"),
    ]);
    expect(decisions.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(decisions.find(({ status }) => status === "rejected")).toMatchObject({
      reason: expect.objectContaining({ message: expect.stringMatching(/already verified/i) }),
    });
    const rows = await all<{ status: string }>("SELECT status FROM residency WHERE societyId = ? AND flat = 'Z-908'", GREEN);
    expect(rows.map(({ status }) => status).sort()).toEqual(["pending", "verified"]);
  });

  it("keeps flat occupancy private until committee review", async () => {
    const request = await claim(await applicant("9876500146"), "A-402");
    expect(request.status).toBe("pending");
    const committee = await account("usr_kulkarni");
    await expect(reviewMembershipRequest(committee, request.id, "approve")).rejects.toThrow(/already verified/i);
  });

  it("lets only the local committee revoke an ordinary resident and ends their sessions", async () => {
    const userId = await applicant("9876500147");
    const request = await claim(userId, "Z-911");
    const committee = await account("usr_kulkarni");
    await reviewMembershipRequest(committee, request.id, "approve");
    const resident = await account(userId);
    const activeCookie = cookieJar.get("jodo_live_session")!;

    const outsider = await applicant("9876500148");
    const outside = await claim(outsider, "Z-912", PALM);
    await run("UPDATE residency SET status = 'verified' WHERE id = ?", outside.id);
    expect(await listVerifiedResidents(committee)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: request.id, flat: "Z-911" }),
    ]));
    await expect(revokeMembership(resident, request.id)).rejects.toThrow(/committee/i);
    await expect(revokeMembership(committee, outside.id)).rejects.toThrow(/verified resident/i);
    await expect(revokeMembership(committee, "res_kulkarni")).rejects.toThrow(/verified resident/i);
    cookieJar.clear();
    await account("usr_kulkarni");
    const revoke = new FormData();
    revoke.set("residencyId", request.id);
    await expect(revokeFlatMembership({}, revoke)).resolves.toMatchObject({ error: expect.stringMatching(/confirm/i) });
    expect(await all("SELECT token FROM session WHERE userId = ?", userId)).toHaveLength(1);
    revoke.set("confirm", "yes");
    await expect(revokeFlatMembership({}, revoke)).resolves.toEqual({});

    expect(await one("SELECT status, verifiedVia FROM residency WHERE id = ?", request.id)).toEqual({ status: "revoked", verifiedVia: "committee" });
    expect(await all("SELECT token FROM session WHERE userId = ?", userId)).toEqual([]);
    cookieJar.set("jodo_live_session", activeCookie);
    expect(await getMe()).toBeNull();
    const nextSession = await account(userId);
    expect(() => requireSocietyMember(nextSession)).toThrow(/verified resident/i);
    expect(await claim(userId, "Z-913")).toMatchObject({ status: "pending" });
    expect(await one("SELECT status FROM residency WHERE id = ?", request.id)).toEqual({ status: "revoked" });
  });

  it("keeps legacy verified membership authoritative when a stale request also exists", async () => {
    await run(
      `INSERT INTO residency (id, userId, societyId, flat, type, status, createdAt)
       VALUES ('stale-committee-claim', 'usr_kulkarni', ?, 'Z-910', 'owner', 'pending', '2099-01-01')`,
      PALM,
    );
    expect((await account("usr_kulkarni")).residency).toMatchObject({ societyId: GREEN, status: "verified" });
  });
});
