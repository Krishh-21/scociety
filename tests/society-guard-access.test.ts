import { beforeAll, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";
import type { User } from "@/lib/types";

process.env.JODO_DB = ":memory:";
const { all, one, run } = await import("@/lib/db");
const { claimResidency, findOrCreateUser } = await import("@/lib/session");
const { registerGuard, requireSocietyGuard, setGuardActive } = await import("@/lib/society-access");

const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";
const NOW = "2026-01-01T00:00:00.000Z";
let committee: Me;

beforeAll(async () => {
  committee = {
    user: (await one<User>("SELECT * FROM user WHERE id = 'usr_kulkarni'"))!,
    residency: (await one<NonNullable<Me["residency"]>>(
      `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
       WHERE r.userId = 'usr_kulkarni'`,
    ))!,
  };
});

describe("guard enrollment", () => {
  it("enrolls an account created by phone sign-in before onboarding and ends its old sessions", async () => {
    const user = await findOrCreateUser("9876512200");
    await run(
      `INSERT INTO session (token, userId, createdAt, expiresAt)
       VALUES ('first-device', ?, ?, '2099-01-01T00:00:00.000Z'), ('second-device', ?, ?, '2099-01-01T00:00:00.000Z')`,
      user.id, NOW, user.id, NOW,
    );

    expect(await registerGuard(committee, user.phone, "Morning Shift")).toBe(user.id);

    const signedInGuard = await findOrCreateUser(user.phone);
    expect(signedInGuard).toMatchObject({ id: user.id, name: "Morning Shift", role: "guard" });
    await expect(requireSocietyGuard({ user: signedInGuard, residency: null })).resolves.toMatchObject({ societyId: GREEN });
    expect(await all("SELECT token FROM session WHERE userId = ?", user.id)).toEqual([]);
  });

  it.each([
    ["pending", "9876512201"],
    ["rejected", "9876512202"],
    ["revoked", "9876512203"],
    ["verified", "9876512207"],
  ])("preserves resident accounts with a %s flat record at another society", async (status, phone) => {
    const user = await findOrCreateUser(phone);
    await run(
      "INSERT INTO residency (id, userId, societyId, flat, status, createdAt) VALUES (?, ?, ?, 'Z-809', ?, ?)",
      `res_guard_enrollment_${status}`, user.id, PALM, status, NOW,
    );

    await expect(registerGuard(committee, phone, "Morning Shift")).rejects.toThrow(/use a separate guard number/i);
    expect(await findOrCreateUser(phone)).toEqual(user);
    expect(await one("SELECT userId FROM guard_assignment WHERE userId = ?", user.id)).toBeNull();
  });

  it("preserves resident accounts linked to a vendor", async () => {
    const user = await findOrCreateUser("9876512204");
    await run("UPDATE user SET vendorId = 'ven_linked' WHERE id = ?", user.id);

    await expect(registerGuard(committee, user.phone, "Morning Shift")).rejects.toThrow(/use a separate guard number/i);
    expect(await findOrCreateUser(user.phone)).toMatchObject({ role: "resident", vendorId: "ven_linked" });
  });

  it.each([
    ["secretary", "9876512208"],
    ["vendor", "9876512209"],
    ["ops", "9876512210"],
  ])("preserves a %s account with no flat record", async (role, phone) => {
    const user = await findOrCreateUser(phone);
    await run("UPDATE user SET role = ? WHERE id = ?", role, user.id);

    await expect(registerGuard(committee, phone, "Morning Shift")).rejects.toThrow(/use a separate guard number/i);
    expect(await findOrCreateUser(phone)).toMatchObject({ role });
  });

  it("directs a committee to its existing active guard account", async () => {
    const guard = await findOrCreateUser("9000000098");
    await expect(registerGuard(committee, guard.phone, "Another Name")).rejects.toThrow(/Guard accounts/);
  });

  it.each([
    ["active", "9876512205", 1],
    ["paused", "9876512211", 0],
  ])("preserves a guard's %s assignment at another society", async (_, phone, active) => {
    const otherCommittee = { ...committee, residency: { ...committee.residency!, societyId: PALM } };
    const otherGuardId = await registerGuard(otherCommittee, phone, "Other Shift");
    if (!active) await setGuardActive(otherCommittee, otherGuardId, false);

    await expect(registerGuard(committee, phone, "Morning Shift")).rejects.toThrow(/another society/i);
    expect(await one("SELECT societyId, isActive FROM guard_assignment WHERE userId = ?", otherGuardId))
      .toEqual({ societyId: PALM, isActive: active });
  });

  it("directs the original committee to Restore access for a paused guard", async () => {
    const phone = "9876512206";
    const guardId = await registerGuard(committee, phone, "Evening Shift");
    await setGuardActive(committee, guardId, false);

    await expect(registerGuard(committee, phone, "Another Name")).rejects.toThrow(/Restore access/);
    expect(await one("SELECT isActive FROM guard_assignment WHERE userId = ?", guardId)).toEqual({ isActive: 0 });
  });

  it("rejects a flat claim if the database already identifies the requester as a guard", async () => {
    const guardId = "usr_guard_green";
    await expect(claimResidency({
      userId: guardId, name: "Former onboarding name", societyId: GREEN, flat: "Z-809", type: "owner",
    })).rejects.toThrow(/resident account/i);
    expect(await one("SELECT id FROM residency WHERE userId = ?", guardId)).toBeNull();
  });
});
