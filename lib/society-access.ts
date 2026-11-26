import { all, id, inTransaction, one, run } from "./db";
import { isValidPhone, type Me } from "./session";
import type { User } from "./types";

export class SocietyAccessError extends Error {}

export function requireSocietyMember(me: Me | null): NonNullable<Me["residency"]> {
  if (!me || (me.user.role !== "resident" && me.user.role !== "secretary") || me.residency?.status !== "verified") {
    throw new SocietyAccessError("Sign in as a verified resident to use these society tools.");
  }
  return me.residency;
}

export function requireSocietyCommittee(me: Me | null): NonNullable<Me["residency"]> {
  const residency = requireSocietyMember(me);
  if (me?.user.role !== "secretary") {
    throw new SocietyAccessError("Only this society’s committee can make that change.");
  }
  return residency;
}

export async function requireSocietyGuard(me: Me | null) {
  if (me?.user.role !== "guard") throw new SocietyAccessError("Sign in as the assigned society guard.");
  const assignment = await one<{ societyId: string; societyName: string }>(
    `SELECT g.societyId, s.name AS societyName FROM guard_assignment g
     JOIN society s ON s.id = g.societyId WHERE g.userId = ? AND g.isActive = 1`,
    me.user.id,
  );
  if (!assignment) throw new SocietyAccessError("This guard account has no society assignment.");
  return assignment;
}

export async function listSocietyGuards(me: Me | null) {
  const { societyId } = requireSocietyCommittee(me);
  return all<{ userId: string; name: string; phone: string; isActive: 0 | 1 }>(
    `SELECT g.userId, u.name, u.phone, g.isActive FROM guard_assignment g
     JOIN user u ON u.id = g.userId WHERE g.societyId = ? ORDER BY g.isActive DESC, u.name`,
    societyId,
  );
}

export async function registerGuard(me: Me | null, phone: string, name: string) {
  const { societyId } = requireSocietyCommittee(me);
  const mobile = phone.trim();
  const displayName = name.trim();
  if (!isValidPhone(mobile)) throw new SocietyAccessError("Enter a valid 10-digit mobile number.");
  if (displayName.length < 2 || displayName.length > 60) throw new SocietyAccessError("Enter a guard name of 2 to 60 characters.");

  return inTransaction(async () => {
    let guardId = id("usr_guard");
    const result = await run(
      "INSERT INTO user (id, phone, name, role) VALUES (?, ?, ?, 'guard') ON CONFLICT(phone) DO NOTHING",
      guardId, mobile, displayName,
    );

    if (!result.changes) {
      // Phone sign-in creates a resident account before the first flat request.
      const account = await one<Pick<User, "id" | "role" | "vendorId"> & {
        guardSocietyId: string | null; guardActive: 0 | 1 | null; hasResidency: boolean | 0 | 1;
      }>(
        `SELECT u.id, u.role, u.vendorId, g.societyId AS guardSocietyId, g.isActive AS guardActive,
                EXISTS (SELECT 1 FROM residency r WHERE r.userId = u.id) AS hasResidency
         FROM user u LEFT JOIN guard_assignment g ON g.userId = u.id WHERE u.phone = ?`,
        mobile,
      );
      if (account?.guardSocietyId === societyId) {
        throw new SocietyAccessError(account.guardActive === 1
          ? "This guard is already assigned. Manage their access under Guard accounts."
          : "This guard is paused. Choose Restore access under Guard accounts.");
      }
      if (account?.guardSocietyId) {
        throw new SocietyAccessError("This mobile number has a guard assignment at another society. Use a different number.");
      }
      if (account?.hasResidency) {
        throw new SocietyAccessError("This mobile number is already in use by a resident with a flat request or membership record. Use a separate guard number.");
      }
      if (account?.role !== "resident" || account.vendorId !== null) {
        throw new SocietyAccessError("This mobile number is already in use by another JODO account. Use a separate guard number.");
      }
      guardId = account.id;
      await run("UPDATE user SET name = ?, role = 'guard' WHERE id = ?", displayName, guardId);
      await run("DELETE FROM session WHERE userId = ?", guardId);
    }

    await run("INSERT INTO guard_assignment (userId, societyId) VALUES (?, ?)", guardId, societyId);
    return guardId;
  });
}

export async function setGuardActive(me: Me | null, guardId: string, active: boolean) {
  const { societyId } = requireSocietyCommittee(me);
  return inTransaction(async () => {
    const result = await run("UPDATE guard_assignment SET isActive = ? WHERE userId = ? AND societyId = ?", Number(active), guardId, societyId);
    if (result.changes === 0) throw new SocietyAccessError("Guard account not found in your society.");
    if (!active) await run("DELETE FROM session WHERE userId = ?", guardId);
  });
}
