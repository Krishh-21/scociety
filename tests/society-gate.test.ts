import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";
import type { Residency, User } from "@/lib/types";

const dbFile = path.join(os.tmpdir(), `jodo-gate-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { getDb, one, run } = await import("@/lib/db");
const { listNotifications } = await import("@/lib/notify");
const {
  committeeGateVisits, createGuestPass, decideVisit, gateDirectory, gateSummary, guardVisits, logVisit,
  recordVisitMovement, redeemGuestPass, residentVisits,
} = await import("@/lib/society-gate");

const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";
const at = new Date("2026-11-22T20:00:00.000Z");

function account(userId: string): Me {
  return {
    user: one<User>("SELECT * FROM user WHERE id = ?", userId)!,
    residency: one<Residency & { societyName: string }>(
      `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
       WHERE r.userId = ?`,
      userId,
    ),
  };
}

function requestVisit() {
  return logVisit(account("usr_test_gate_green"), { residencyId: account("usr_rahul").residency!.id, kind: "delivery", name: "Parcel delivery" }, at);
}

beforeAll(() => {
  getDb();
  for (const [userId, phone, societyId] of [
    ["usr_test_gate_green", "9000010001", GREEN],
    ["usr_test_gate_palm", "9000010002", PALM],
  ]) {
    run("INSERT INTO user (id, phone, name, role) VALUES (?, ?, 'Test guard', 'guard')", userId, phone);
    run("INSERT INTO guard_assignment (userId, societyId) VALUES (?, ?)", userId, societyId);
  }
  run("INSERT INTO user (id, phone, name, role) VALUES ('usr_test_gate_secretary', '9000010003', 'Palm secretary', 'secretary')");
  run(`INSERT INTO residency (id, userId, societyId, flat, status, createdAt)
       VALUES ('res_test_gate_secretary', 'usr_test_gate_secretary', ?, 'A-101', 'verified', ?)`, PALM, at.toISOString());
});

afterAll(() => {
  const db = globalThis.__jodoDb;
  db?.close();
  globalThis.__jodoDb = undefined;
  for (const file of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(file, { force: true });
});

describe("Society gate requests", () => {
  it("alerts only the assigned flat and keeps its request out of other dashboards", () => {
    const visitId = requestVisit();
    expect(residentVisits(account("usr_rahul"))).toContainEqual(expect.objectContaining({ id: visitId, status: "pending" }));
    expect(residentVisits(account("usr_kulkarni"))).not.toContainEqual(expect.objectContaining({ id: visitId }));
    expect(listNotifications("usr_rahul")).toContainEqual(expect.objectContaining({ type: "gate_request" }));
    expect(listNotifications("usr_kulkarni")).not.toContainEqual(expect.objectContaining({ type: "gate_request" }));
    expect(guardVisits(account("usr_test_gate_palm"))).not.toContainEqual(expect.objectContaining({ id: visitId }));
  });

  it("gives only the society committee a read-only view of society-wide records", () => {
    const visitId = requestVisit();
    expect(committeeGateVisits(account("usr_kulkarni"))).toContainEqual(expect.objectContaining({ id: visitId }));
    expect(committeeGateVisits(account("usr_test_gate_secretary"))).not.toContainEqual(expect.objectContaining({ id: visitId }));
    expect(() => committeeGateVisits(account("usr_rahul"))).toThrow();
    expect(() => recordVisitMovement(account("usr_kulkarni"), visitId, "in")).toThrow();
  });

  it("requires a verified flat in the guard's assigned society", () => {
    const palmGuard = account("usr_test_gate_palm");
    expect(gateDirectory(palmGuard)).not.toContainEqual(expect.objectContaining({ name: "Rahul Mehta" }));
    expect(() => logVisit(palmGuard, { residencyId: account("usr_rahul").residency!.id, kind: "help", name: "Cleaner" })).toThrow(/verified flat/i);
    expect(() => gateDirectory(account("usr_vendor_cool"))).toThrow();
  });

  it("rejects a stale directory selection when the flat has a new residency", () => {
    const resident = account("usr_rahul").residency!;
    const arrival = { residencyId: resident.id, kind: "guest", name: "Veena Mehta" };
    run("UPDATE residency SET id = 'res_new_occupant' WHERE id = ?", resident.id);
    try {
      expect(() => logVisit(account("usr_test_gate_green"), arrival)).toThrow(/verified flat/i);
    } finally {
      run("UPDATE residency SET id = ? WHERE id = 'res_new_occupant'", resident.id);
    }
  });

  it("enforces approval, check-in and check-out in order and records who acted", () => {
    const guard = account("usr_test_gate_green");
    const visitId = requestVisit();
    expect(() => recordVisitMovement(guard, visitId, "in")).toThrow();
    expect(() => decideVisit(account("usr_kulkarni"), visitId, "approved")).toThrow();
    decideVisit(account("usr_rahul"), visitId, "approved", at);
    expect(() => decideVisit(account("usr_rahul"), visitId, "denied")).toThrow();
    expect(() => recordVisitMovement(account("usr_test_gate_palm"), visitId, "in")).toThrow();
    recordVisitMovement(guard, visitId, "in", at);
    expect(() => recordVisitMovement(guard, visitId, "in")).toThrow();
    recordVisitMovement(guard, visitId, "out", at);
    expect(guardVisits(guard)).toContainEqual(expect.objectContaining({ id: visitId, status: "checked_out" }));
    expect(one("SELECT decidedBy, checkedInBy, checkedOutBy, checkedInAt FROM gate_visit WHERE id = ?", visitId)).toEqual({
      decidedBy: "usr_rahul", checkedInBy: guard.user.id, checkedOutBy: guard.user.id, checkedInAt: at.toISOString(),
    });
    expect(gateSummary(GREEN, new Date("2026-11-23T12:00:00.000Z")).visitorsToday).toBe(1);
    expect(gateSummary(GREEN, new Date("2026-11-22T12:00:00.000Z")).visitorsToday).toBe(0);
  });

  it("keeps a denied visitor from being checked in", () => {
    const visitId = requestVisit();
    decideVisit(account("usr_rahul"), visitId, "denied");
    expect(() => recordVisitMovement(account("usr_test_gate_green"), visitId, "in")).toThrow();
  });
});

describe("Society guest passes", () => {
  it("preapproves one guest at the host society and still requires guard check-in", () => {
    const guard = account("usr_test_gate_green");
    const pass = createGuestPass(account("usr_rahul"), "Asha Mehta", at);
    expect(() => redeemGuestPass(account("usr_test_gate_palm"), pass.code, at)).toThrow();
    const visitId = redeemGuestPass(guard, pass.code.toLowerCase(), at);
    expect(guardVisits(guard, at)).toContainEqual(expect.objectContaining({ id: visitId, kind: "guest", status: "approved", checkedInAt: null }));
    expect(() => redeemGuestPass(guard, pass.code, at)).toThrow();
    expect(one<{ codeHash: string }>("SELECT codeHash FROM gate_pass WHERE id = ?", pass.id)?.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a pass after 24 hours or when its host moves flats", () => {
    const resident = account("usr_rahul");
    const guard = account("usr_test_gate_green");
    const pass = createGuestPass(resident, "Arun Mehta", at);
    const tomorrow = new Date(at.getTime() + 86_400_000);
    expect(() => redeemGuestPass(guard, pass.code, tomorrow)).toThrow();
    run("UPDATE residency SET flat = 'A-990' WHERE id = ?", resident.residency!.id);
    try {
      expect(() => redeemGuestPass(guard, pass.code, at)).toThrow();
    } finally {
      run("UPDATE residency SET flat = ? WHERE id = ?", resident.residency!.flat, resident.residency!.id);
    }
  });

  it("requires check-in before the redeemed pass expires", () => {
    const guard = account("usr_test_gate_green");
    const pass = createGuestPass(account("usr_rahul"), "Uma Mehta", at);
    const expiry = new Date(pass.expiresAt);
    const visitId = redeemGuestPass(guard, pass.code, new Date(expiry.getTime() - 1));
    expect(() => recordVisitMovement(guard, visitId, "in", expiry)).toThrow();
    expect(guardVisits(guard, expiry)).toContainEqual(expect.objectContaining({ id: visitId, status: "expired" }));
  });
});
