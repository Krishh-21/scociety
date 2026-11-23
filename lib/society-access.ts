import { all, id, inTransaction, one, run } from "./db";
import { isValidPhone, type Me } from "./session";

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

export function requireSocietyGuard(me: Me | null) {
  if (me?.user.role !== "guard") throw new SocietyAccessError("Sign in as the assigned society guard.");
  const assignment = one<{ societyId: string; societyName: string }>(
    `SELECT g.societyId, s.name AS societyName FROM guard_assignment g
     JOIN society s ON s.id = g.societyId WHERE g.userId = ? AND g.isActive = 1`,
    me.user.id,
  );
  if (!assignment) throw new SocietyAccessError("This guard account has no society assignment.");
  return assignment;
}

export function listSocietyGuards(me: Me | null) {
  const { societyId } = requireSocietyCommittee(me);
  return all<{ userId: string; name: string; phone: string; isActive: 0 | 1 }>(
    `SELECT g.userId, u.name, u.phone, g.isActive FROM guard_assignment g
     JOIN user u ON u.id = g.userId WHERE g.societyId = ? ORDER BY g.isActive DESC, u.name`,
    societyId,
  );
}

export function registerGuard(me: Me | null, phone: string, name: string) {
  const { societyId } = requireSocietyCommittee(me);
  const displayName = name.trim();
  if (!isValidPhone(phone.trim())) throw new SocietyAccessError("Enter a valid 10-digit mobile number.");
  if (displayName.length < 2 || displayName.length > 60) throw new SocietyAccessError("Enter a guard name of 2 to 60 characters.");
  return inTransaction(() => {
    if (one("SELECT id FROM user WHERE phone = ?", phone.trim())) throw new SocietyAccessError("This mobile number is already in use.");
    const guardId = id("usr_guard");
    run("INSERT INTO user (id, phone, name, role) VALUES (?, ?, ?, 'guard')", guardId, phone.trim(), displayName);
    run("INSERT INTO guard_assignment (userId, societyId) VALUES (?, ?)", guardId, societyId);
    return guardId;
  });
}

export function setGuardActive(me: Me | null, guardId: string, active: boolean) {
  const { societyId } = requireSocietyCommittee(me);
  return inTransaction(() => {
    const result = run("UPDATE guard_assignment SET isActive = ? WHERE userId = ? AND societyId = ?", Number(active), guardId, societyId);
    if (result.changes === 0) throw new SocietyAccessError("Guard account not found in your society.");
    if (!active) run("DELETE FROM session WHERE userId = ?", guardId);
  });
}
