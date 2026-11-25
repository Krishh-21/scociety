import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";
import type { Residency, User } from "@/lib/types";

const dbFile = path.join(os.tmpdir(), `jodo-gate-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { getDb, one, run } = await import("@/lib/db");
const { listNotifications, notify } = await import("@/lib/notify");
const {
  committeeGateVisits, createGuestPass, decideVisit, gateDirectory, gateSummary, guardVisits, logVisit,
  recordVisitMovement, redeemGuestPass, residentPendingVisits, residentVisits,
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

async function requestVisit() {
  return (await logVisit((await account("usr_test_gate_green")), { residencyId: (await account("usr_rahul")).residency!.id, kind: "delivery", name: "Parcel delivery" }, at));
}

beforeAll(async () => {
  const legacyDb = new DatabaseSync(dbFile);
  legacyDb.exec(`
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
    expect((await residentVisits((await account("usr_rahul"))))).toContainEqual(expect.objectContaining({ id: visitId, status: "pending" }));
    expect((await residentVisits((await account("usr_kulkarni"))))).not.toContainEqual(expect.objectContaining({ id: visitId }));
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

    expect((await residentPendingVisits(resident))).toContainEqual(expect.objectContaining({ id: pending, status: "pending" }));
    expect((await residentPendingVisits(resident))).not.toContainEqual(expect.objectContaining({ id: decided }));
    expect((await residentPendingVisits(otherFlat))).not.toContainEqual(expect.objectContaining({ id: pending }));
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
    (await decideVisit((await account("usr_rahul")), visitId, "denied"));
    await expect((async () => (await recordVisitMovement((await account("usr_test_gate_green")), visitId, "in")))()).rejects.toThrow();
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
});
