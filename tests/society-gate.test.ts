import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";
import { SOCIETY_GATE_SCHEMA } from "@/lib/society-gate-schema";
import type { Residency, User } from "@/lib/types";

const dbFile = path.join(os.tmpdir(), `jodo-gate-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { getDb, one, run } = await import("@/lib/db");
const { listNotifications, notify } = await import("@/lib/notify");
const {
  cancelVisit, committeeGateVisits, createGuestPass, decideVisit, gateDirectory, gateSummary, guardVisits, logVisit,
  recordVisitMovement, redeemGuestPass, residentPasses, residentPendingVisits, residentVisits, revokeGuestPass,
} = await import("@/lib/society-gate");

const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";
const at = new Date("2026-11-22T20:00:00.000Z");

async function account(userId: string): Promise<Me> {
  return {
    user: (await one<User>("SELECT * FROM user WHERE id = ?", userId))!,
    residency: (await one<Residency & { societyName: string }>(
      `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
       WHERE r.userId = ?`,
      userId,
    )),
  };
}

async function requestVisit(now = at) {
  return (await logVisit((await account("usr_test_gate_green")), { residencyId: (await account("usr_rahul")).residency!.id, kind: "delivery", name: "Parcel delivery" }, now));
}

beforeAll(async () => {
  const legacyDb = new DatabaseSync(dbFile);
  legacyDb.exec(SOCIETY_GATE_SCHEMA);
  legacyDb.exec(`
    ALTER TABLE gate_visit DROP COLUMN cancelledBy;
    ALTER TABLE gate_visit DROP COLUMN cancelledAt;
    ALTER TABLE gate_pass DROP COLUMN revokedAt;
    CREATE TABLE notification (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, dealId TEXT, type TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, readAt TEXT
    );
    INSERT INTO notification (id, userId, type, title, body, createdAt)
    VALUES ('ntf_legacy_gate', 'usr_rahul', 'gate_request', 'Visitor at the gate', 'Open Visitors.', '2026-11-22T20:00:00.000Z');
  `);
  legacyDb.close();
  getDb();
  for (const [userId, phone, societyId] of [
    ["usr_test_gate_green", "9000010001", GREEN],
    ["usr_test_gate_palm", "9000010002", PALM],
  ]) {
    (await run("INSERT INTO user (id, phone, name, role) VALUES (?, ?, 'Test guard', 'guard')", userId, phone));
    (await run("INSERT INTO guard_assignment (userId, societyId) VALUES (?, ?)", userId, societyId));
  }
  (await run("INSERT INTO user (id, phone, name, role) VALUES ('usr_test_gate_secretary', '9000010003', 'Palm secretary', 'secretary')"));
  (await run(`INSERT INTO residency (id, userId, societyId, flat, status, createdAt)
       VALUES ('res_test_gate_secretary', 'usr_test_gate_secretary', ?, 'A-101', 'verified', ?)`, PALM, at.toISOString()));
});

afterAll(() => {
  const db = globalThis.__jodoDb;
  db?.close();
  globalThis.__jodoDb = undefined;
  for (const file of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(file, { force: true });
});

describe("Society gate requests", () => {
  it("alerts only the assigned flat and keeps its request out of other dashboards", async () => {
    const visitId = (await requestVisit());
    expect((await residentVisits((await account("usr_rahul")), at))).toContainEqual(expect.objectContaining({ id: visitId, status: "pending" }));
    expect((await residentVisits((await account("usr_kulkarni")), at))).not.toContainEqual(expect.objectContaining({ id: visitId }));
    expect((await listNotifications("usr_rahul"))).toContainEqual(expect.objectContaining({ type: "gate_request", gateVisitId: visitId, readAt: null }));
    expect((await listNotifications("usr_kulkarni"))).not.toContainEqual(expect.objectContaining({ gateVisitId: visitId }));
    expect((await guardVisits((await account("usr_test_gate_palm"))))).not.toContainEqual(expect.objectContaining({ id: visitId }));
  });

  it("keeps legacy gate notifications without a linked visit", async () => {
    expect(await listNotifications("usr_rahul", 1000)).toContainEqual(expect.objectContaining({
      id: "ntf_legacy_gate", gateVisitId: null, readAt: null,
    }));
  });

  it("lists only pending visits for the verified resident's own flat", async () => {
    const resident = (await account("usr_rahul"));
    const otherFlat = (await account("usr_kulkarni"));
    const pending = (await requestVisit());
    const decided = (await requestVisit());
    (await decideVisit(resident, decided, "approved", at));

    expect((await residentPendingVisits(resident, at))).toContainEqual(expect.objectContaining({ id: pending, status: "pending" }));
    expect((await residentPendingVisits(resident, at))).not.toContainEqual(expect.objectContaining({ id: decided }));
    expect((await residentPendingVisits(otherFlat, at))).not.toContainEqual(expect.objectContaining({ id: pending }));
    await expect((async () => (await residentPendingVisits(null)))()).rejects.toThrow(/verified resident/i);
    await expect((async () => (await residentPendingVisits({ ...resident, residency: { ...resident.residency!, status: "pending" } })))()).rejects.toThrow(/verified resident/i);
  });

  it("marks only the decided visit's gate notification read for its resident", async () => {
    const resident = (await account("usr_rahul"));
    const otherFlat = (await account("usr_kulkarni"));
    const decided = (await requestVisit());
    const pending = (await requestVisit());
    (await notify([resident.user.id], { type: "notice", title: "Society notice", body: "An unrelated notice.", gateVisitId: decided }));
    (await notify([otherFlat.user.id], { type: "gate_request", title: "Other flat's alert", body: "A separate alert.", gateVisitId: decided }));

    await expect((async () => (await decideVisit(otherFlat, decided, "approved", at)))()).rejects.toThrow();
    expect((await listNotifications(resident.user.id))).toContainEqual(expect.objectContaining({ gateVisitId: decided, type: "gate_request", readAt: null }));
    (await decideVisit(resident, decided, "denied", at));

    expect((await listNotifications(resident.user.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ gateVisitId: decided, type: "gate_request", readAt: at.toISOString() }),
      expect.objectContaining({ gateVisitId: pending, type: "gate_request", readAt: null }),
      expect.objectContaining({ title: "Society notice", readAt: null }),
    ]));
    expect((await listNotifications(otherFlat.user.id))).toContainEqual(expect.objectContaining({ title: "Other flat's alert", readAt: null }));
  });

  it("gives only the society committee a read-only view of society-wide records", async () => {
    const visitId = (await requestVisit());
    expect((await committeeGateVisits((await account("usr_kulkarni"))))).toContainEqual(expect.objectContaining({ id: visitId }));
    expect((await committeeGateVisits((await account("usr_test_gate_secretary"))))).not.toContainEqual(expect.objectContaining({ id: visitId }));
    await expect((async () => (await committeeGateVisits((await account("usr_rahul")))))()).rejects.toThrow();
    await expect((async () => (await recordVisitMovement((await account("usr_kulkarni")), visitId, "in")))()).rejects.toThrow();
  });

  it("requires a verified flat in the guard's assigned society", async () => {
    const palmGuard = (await account("usr_test_gate_palm"));
    expect((await gateDirectory(palmGuard))).not.toContainEqual(expect.objectContaining({ name: "Rahul Mehta" }));
    await expect((async () => (await logVisit(palmGuard, { residencyId: (await account("usr_rahul")).residency!.id, kind: "help", name: "Cleaner" })))()).rejects.toThrow(/verified flat/i);
    await expect((async () => (await gateDirectory((await account("usr_vendor_cool")))))()).rejects.toThrow();
  });

  it("rejects a stale directory selection when the flat has a new residency", async () => {
    const resident = (await account("usr_rahul")).residency!;
    const arrival = { residencyId: resident.id, kind: "guest", name: "Veena Mehta" };
    (await run("UPDATE residency SET id = 'res_new_occupant' WHERE id = ?", resident.id));
    try {
      await expect((async () => (await logVisit((await account("usr_test_gate_green")), arrival)))()).rejects.toThrow(/verified flat/i);
    } finally {
      (await run("UPDATE residency SET id = ? WHERE id = 'res_new_occupant'", resident.id));
    }
  });

  it("moves stale requests and approvals to history when their residency changes", async () => {
    const resident = await account("usr_rahul");
    const { id: residencyId, flat } = resident.residency!;
    const guard = await account("usr_test_gate_green");
    const loggedAt = new Date("2026-11-24T07:45:00.000Z");
    const checkedInAt = new Date("2026-11-24T08:00:00.000Z");
    const pending = await requestVisit(loggedAt);
    const approved = await requestVisit(loggedAt);
    const inside = await requestVisit(loggedAt);
    await decideVisit(resident, approved, "approved", loggedAt);
    await decideVisit(resident, inside, "approved", loggedAt);
    await recordVisitMovement(guard, inside, "in", checkedInAt);

    await run("UPDATE residency SET flat = 'A-990' WHERE id = ?", residencyId);
    try {
      expect(await guardVisits(guard, checkedInAt)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: pending, status: "host_unavailable" }),
        expect.objectContaining({ id: approved, status: "host_unavailable" }),
        expect.objectContaining({ id: inside, status: "checked_in" }),
      ]));
      expect(await residentPendingVisits(resident, checkedInAt)).not.toContainEqual(expect.objectContaining({ id: pending }));
      await expect(recordVisitMovement(guard, approved, "in", checkedInAt)).rejects.toThrow(/verified host/);
      await recordVisitMovement(guard, inside, "out", checkedInAt);
      expect(await guardVisits(guard, checkedInAt)).toContainEqual(expect.objectContaining({ id: inside, status: "checked_out" }));
    } finally {
      await run("UPDATE residency SET flat = ? WHERE id = ?", flat, residencyId);
    }
  });

  it("enforces approval, check-in and check-out in order and records who acted", async () => {
    const guard = (await account("usr_test_gate_green"));
    const visitId = (await requestVisit());
    await expect((async () => (await recordVisitMovement(guard, visitId, "in")))()).rejects.toThrow();
    await expect((async () => (await decideVisit((await account("usr_kulkarni")), visitId, "approved")))()).rejects.toThrow();
    (await decideVisit((await account("usr_rahul")), visitId, "approved", at));
    await expect((async () => (await decideVisit((await account("usr_rahul")), visitId, "denied")))()).rejects.toThrow();
    await expect((async () => (await recordVisitMovement((await account("usr_test_gate_palm")), visitId, "in")))()).rejects.toThrow();
    (await recordVisitMovement(guard, visitId, "in", at));
    await expect((async () => (await recordVisitMovement(guard, visitId, "in")))()).rejects.toThrow();
    (await recordVisitMovement(guard, visitId, "out", at));
    expect((await guardVisits(guard))).toContainEqual(expect.objectContaining({ id: visitId, status: "checked_out" }));
    expect((await one("SELECT decidedBy, checkedInBy, checkedOutBy, checkedInAt FROM gate_visit WHERE id = ?", visitId))).toEqual({
      decidedBy: "usr_rahul", checkedInBy: guard.user.id, checkedOutBy: guard.user.id, checkedInAt: at.toISOString(),
    });
    expect((await gateSummary(GREEN, new Date("2026-11-23T12:00:00.000Z"))).visitorsToday).toBe(1);
    expect((await gateSummary(GREEN, new Date("2026-11-22T12:00:00.000Z"))).visitorsToday).toBe(0);
  });

  it("keeps a denied visitor from being checked in", async () => {
    const visitId = (await requestVisit());
    (await decideVisit((await account("usr_rahul")), visitId, "denied", at));
    await expect((async () => (await recordVisitMovement((await account("usr_test_gate_green")), visitId, "in")))()).rejects.toThrow();
  });

  it("closes an unanswered request at 30 minutes across the guard and resident views", async () => {
    const resident = await account("usr_rahul");
    const guard = await account("usr_test_gate_green");
    const secretary = await account("usr_kulkarni");
    const visitId = await requestVisit();
    const lastMoment = new Date("2026-11-22T20:29:59.999Z");
    const expiry = new Date("2026-11-22T20:30:00.000Z");
    expect(await residentPendingVisits(resident, lastMoment)).toContainEqual(expect.objectContaining({ id: visitId }));
    expect(await residentPendingVisits(resident, expiry)).not.toContainEqual(expect.objectContaining({ id: visitId }));
    const expired = expect.objectContaining({ id: visitId, status: "expired" });
    expect(await residentVisits(resident, expiry)).toContainEqual(expired);
    expect(await guardVisits(guard, expiry)).toContainEqual(expired);
    expect(await committeeGateVisits(secretary, expiry)).toContainEqual(expired);
    await expect(decideVisit(resident, visitId, "approved", expiry)).rejects.toThrow(/no longer pending/i);
    await expect(decideVisit(resident, visitId, "denied", expiry)).rejects.toThrow(/no longer pending/i);
    await expect(cancelVisit(guard, visitId, expiry)).rejects.toThrow();
  });

  it("expires an unused approval 30 minutes after the decision and allows later checkout", async () => {
    const resident = await account("usr_rahul");
    const guard = await account("usr_test_gate_green");
    const stale = await requestVisit();
    const entering = await requestVisit();
    const decisionAt = new Date("2026-11-22T20:29:59.999Z");
    const lastMoment = new Date("2026-11-22T20:59:59.998Z");
    const expiry = new Date("2026-11-22T20:59:59.999Z");
    await decideVisit(resident, stale, "approved", decisionAt);
    await decideVisit(resident, entering, "approved", decisionAt);
    expect(await guardVisits(guard, lastMoment)).toContainEqual(expect.objectContaining({ id: stale, status: "approved" }));
    await recordVisitMovement(guard, entering, "in", lastMoment);
    await expect(recordVisitMovement(guard, stale, "in", expiry)).rejects.toThrow(/expired/i);
    expect(await guardVisits(guard, expiry)).toContainEqual(expect.objectContaining({ id: stale, status: "expired" }));
    await expect(cancelVisit(guard, entering, expiry)).rejects.toThrow();
    const leaving = new Date("2026-11-23T12:00:00.000Z");
    await recordVisitMovement(guard, entering, "out", leaving);
    expect(await residentVisits(resident, leaving)).toContainEqual(expect.objectContaining({ id: entering, status: "checked_out" }));
  });

  it("lets only the assigned society's guard cancel an open ticket", async () => {
    const resident = await account("usr_rahul");
    const guard = await account("usr_test_gate_green");
    const otherGuard = await account("usr_test_gate_palm");
    const pending = await requestVisit();
    const approved = await requestVisit();
    const cancellation = new Date("2026-11-22T20:05:00.000Z");
    await decideVisit(resident, approved, "approved", at);
    await expect(cancelVisit(resident, pending, cancellation)).rejects.toThrow();
    await expect(cancelVisit(otherGuard, pending, cancellation)).rejects.toThrow();
    await cancelVisit(guard, pending, cancellation);
    await cancelVisit(guard, approved, cancellation);
    const cancelledAt = cancellation.toISOString();
    expect(await guardVisits(guard, cancellation)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: pending, status: "cancelled", cancelledAt }),
      expect.objectContaining({ id: approved, status: "cancelled", cancelledAt }),
    ]));
    expect(await residentPendingVisits(resident, cancellation)).not.toContainEqual(expect.objectContaining({ id: pending }));
    expect(await listNotifications(resident.user.id)).toContainEqual(expect.objectContaining({ gateVisitId: pending, readAt: cancelledAt }));
    await expect(decideVisit(resident, pending, "approved", cancellation)).rejects.toThrow();
    await expect(recordVisitMovement(guard, approved, "in", cancellation)).rejects.toThrow();
    await expect(cancelVisit(guard, pending, cancellation)).rejects.toThrow();
  });

  it("allows at most one of cancelling a ticket and checking the visitor in", async () => {
    const resident = await account("usr_rahul");
    const guard = await account("usr_test_gate_green");
    const visitId = await requestVisit();
    await decideVisit(resident, visitId, "approved", at);
    const results = await Promise.allSettled([cancelVisit(guard, visitId, at), recordVisitMovement(guard, visitId, "in", at)]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await guardVisits(guard, at)).toContainEqual(expect.objectContaining({
      id: visitId, status: results[0].status === "fulfilled" ? "cancelled" : "checked_in",
    }));
  });
});

describe("Society guest passes", () => {
  it("preapproves one guest at the host society and still requires guard check-in", async () => {
    const guard = (await account("usr_test_gate_green"));
    const pass = (await createGuestPass((await account("usr_rahul")), "Asha Mehta", at));
    await expect((async () => (await redeemGuestPass((await account("usr_test_gate_palm")), pass.code, at)))()).rejects.toThrow();
    const visitId = (await redeemGuestPass(guard, pass.code.toLowerCase(), at));
    expect((await guardVisits(guard, at))).toContainEqual(expect.objectContaining({ id: visitId, kind: "guest", status: "approved", checkedInAt: null }));
    await expect((async () => (await redeemGuestPass(guard, pass.code, at)))()).rejects.toThrow();
    expect((await one<{ codeHash: string }>("SELECT codeHash FROM gate_pass WHERE id = ?", pass.id))?.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a pass after 24 hours or when its host moves flats", async () => {
    const resident = (await account("usr_rahul"));
    const guard = (await account("usr_test_gate_green"));
    const pass = (await createGuestPass(resident, "Arun Mehta", at));
    const tomorrow = new Date(at.getTime() + 86_400_000);
    await expect((async () => (await redeemGuestPass(guard, pass.code, tomorrow)))()).rejects.toThrow();
    (await run("UPDATE residency SET flat = 'A-990' WHERE id = ?", resident.residency!.id));
    try {
      await expect((async () => (await redeemGuestPass(guard, pass.code, at)))()).rejects.toThrow();
    } finally {
      (await run("UPDATE residency SET flat = ? WHERE id = ?", resident.residency!.flat, resident.residency!.id));
    }
  });

  it("requires check-in before the redeemed pass expires", async () => {
    const guard = (await account("usr_test_gate_green"));
    const pass = (await createGuestPass((await account("usr_rahul")), "Uma Mehta", at));
    const expiry = new Date(pass.expiresAt);
    const visitId = (await redeemGuestPass(guard, pass.code, new Date(expiry.getTime() - 1)));
    await expect((async () => (await recordVisitMovement(guard, visitId, "in", expiry)))()).rejects.toThrow();
    expect((await guardVisits(guard, expiry))).toContainEqual(expect.objectContaining({ id: visitId, status: "expired" }));
  });

  it("lets the pass owner revoke an unused pass and stops the guard from redeeming it", async () => {
    const resident = await account("usr_rahul");
    const otherResident = await account("usr_kulkarni");
    const guard = await account("usr_test_gate_green");
    const pass = await createGuestPass(resident, "Asha Mehta", at);
    const revocation = new Date("2026-11-22T20:05:00.000Z");
    await expect(revokeGuestPass(otherResident, pass.id, revocation)).rejects.toThrow();
    await expect(revokeGuestPass(guard, pass.id, revocation)).rejects.toThrow();
    await revokeGuestPass(resident, pass.id, revocation);
    expect(await residentPasses(resident)).toContainEqual(expect.objectContaining({
      id: pass.id, usedAt: null, revokedAt: revocation.toISOString(),
    }));
    await expect(redeemGuestPass(guard, pass.code, revocation)).rejects.toThrow();
    await expect(revokeGuestPass(resident, pass.id, revocation)).rejects.toThrow();
  });

  it("preserves a redeemed pass and its open entry when revocation is attempted", async () => {
    const resident = await account("usr_rahul");
    const guard = await account("usr_test_gate_green");
    const pass = await createGuestPass(resident, "Asha Mehta", at);
    const visitId = await redeemGuestPass(guard, pass.code, at);
    await expect(revokeGuestPass(resident, pass.id, at)).rejects.toThrow();
    await recordVisitMovement(guard, visitId, "in", at);
    expect(await guardVisits(guard, at)).toContainEqual(expect.objectContaining({ id: visitId, status: "checked_in" }));
  });

  it("allows at most one of redeeming a pass and revoking it", async () => {
    const resident = await account("usr_rahul");
    const guard = await account("usr_test_gate_green");
    const pass = await createGuestPass(resident, "Asha Mehta", at);
    const results = await Promise.allSettled([redeemGuestPass(guard, pass.code, at), revokeGuestPass(resident, pass.id, at)]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const savedPass = (await residentPasses(resident)).find(({ id }) => id === pass.id);
    expect(Boolean(savedPass?.usedAt)).toBe(results[0].status === "fulfilled");
    expect(Boolean(savedPass?.revokedAt)).toBe(results[1].status === "fulfilled");
  });
});
