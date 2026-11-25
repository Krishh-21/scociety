import { createHash, randomBytes, randomUUID } from "node:crypto";
import { all, inTransaction, one, run } from "./db";
import { notify } from "./notify";
import type { Me } from "./session";
import { requireSocietyCommittee, requireSocietyGuard, requireSocietyMember } from "./society-access";

const KIND_LABELS = { guest: "Guest", delivery: "Delivery", help: "Home help" } as const;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const PASS_LIFETIME_MS = 24 * 60 * 60 * 1000;
const VISIT_FIELDS = "v.id, v.kind, v.visitorName, v.flat, v.passId, v.createdAt, v.decidedAt, v.checkedInAt, v.checkedOutAt";
const RESIDENT_VISIT_SCOPE = "v.residencyId = ? AND v.residentId = ? AND v.societyId = ? AND v.flat = ?";
const indiaDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" });

export const gateKindLabels = KIND_LABELS;

export type GateKind = keyof typeof KIND_LABELS;
export type GateStatus = "pending" | "approved" | "denied" | "checked_in" | "checked_out" | "expired";
export type GateVisit = {
  id: string;
  kind: GateKind;
  visitorName: string;
  flat: string;
  status: GateStatus;
  passId: string | null;
  createdAt: string;
  decidedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

type GateHost = { residencyId: string; residentId: string; societyId: string; flat: string };
type GuestPass = { id: string; guestName: string; createdAt: string; expiresAt: string; usedAt: string | null };

export class GateError extends Error {}

function visitorName(raw: string) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value || value.length > 60) throw new GateError("Enter a name with up to 60 characters.");
  return value;
}

function memberHost(me: Me | null): GateHost {
  const { id, userId, societyId, flat } = requireSocietyMember(me);
  return { residencyId: id, residentId: userId, societyId, flat };
}

async function isHostVerified(host: GateHost) {
  return Boolean(await one(
    `SELECT 1 FROM residency r JOIN user u ON u.id = r.userId
     WHERE r.id = ? AND r.userId = ? AND r.societyId = ? AND r.flat = ? AND r.status = 'verified'
       AND u.role IN ('resident', 'secretary')`,
    host.residencyId, host.residentId, host.societyId, host.flat,
  ));
}

async function gateVisits(where: string, now: Date, ...params: string[]) {
  return all<GateVisit>(
    `WITH scoped AS (
       SELECT ${VISIT_FIELDS},
              CASE WHEN v.status = 'approved' AND p.expiresAt <= ? THEN 'expired' ELSE v.status END AS status
       FROM gate_visit v LEFT JOIN gate_pass p ON p.id = v.passId WHERE ${where}
     ), recent AS (
       SELECT * FROM scoped WHERE status IN ('denied', 'checked_out', 'expired') ORDER BY createdAt DESC LIMIT 40
     )
     SELECT * FROM scoped WHERE status IN ('pending', 'approved', 'checked_in')
     UNION ALL SELECT * FROM recent
     ORDER BY createdAt DESC, id DESC`,
    now.toISOString(), ...params,
  );
}

export async function gateDirectory(me: Me | null) {
  const { societyId } = await requireSocietyGuard(me);
  return all<{ id: string; flat: string; name: string }>(
    `SELECT r.id, r.flat, u.name FROM residency r JOIN user u ON u.id = r.userId
     WHERE r.societyId = ? AND r.status = 'verified' AND u.role IN ('resident', 'secretary')
     ORDER BY r.flat`,
    societyId,
  );
}

export async function guardVisits(me: Me | null, now = new Date()) {
  const { societyId } = await requireSocietyGuard(me);
  return gateVisits("v.societyId = ?", now, societyId);
}

export async function committeeGateVisits(me: Me | null) {
  const { societyId } = requireSocietyCommittee(me);
  return gateVisits("v.societyId = ?", new Date(), societyId);
}

export async function residentVisits(me: Me | null) {
  const host = memberHost(me);
  return gateVisits(RESIDENT_VISIT_SCOPE, new Date(), host.residencyId, host.residentId, host.societyId, host.flat);
}

export async function residentPendingVisits(me: Me | null): Promise<GateVisit[]> {
  const host = memberHost(me);
  return all<GateVisit>(
    `SELECT ${VISIT_FIELDS}, v.status FROM gate_visit v
     WHERE ${RESIDENT_VISIT_SCOPE} AND v.status = 'pending'
     ORDER BY v.createdAt DESC, v.id DESC`,
    host.residencyId, host.residentId, host.societyId, host.flat,
  );
}

export async function gateSummary(societyId: string, now = new Date()) {
  const start = new Date(`${indiaDate.format(now)}T00:00:00+05:30`);
  const end = new Date(start.getTime() + PASS_LIFETIME_MS);
  const result = await one<{ count: number }>(
    "SELECT COUNT(*) AS count FROM gate_visit WHERE societyId = ? AND checkedInAt >= ? AND checkedInAt < ?",
    societyId, start.toISOString(), end.toISOString(),
  );
  return { visitorsToday: result?.count ?? 0 };
}

export async function logVisit(me: Me | null, input: { residencyId: string; kind: string; name: string }, now = new Date()) {
  return inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const name = visitorName(input.name);
    const kind = input.kind;
    if (!Object.hasOwn(KIND_LABELS, kind)) throw new GateError("Choose a visitor type.");
    const host = await one<GateHost>(
      `SELECT r.id AS residencyId, r.userId AS residentId, r.societyId, r.flat
       FROM residency r JOIN user u ON u.id = r.userId
       WHERE r.societyId = ? AND r.id = ? AND r.status = 'verified' AND u.role IN ('resident', 'secretary')`,
      societyId, input.residencyId,
    );
    if (!host) throw new GateError("Choose a verified flat in your society.");

    const visitId = randomUUID();
    await run(
      `INSERT INTO gate_visit (id, societyId, residencyId, residentId, flat, kind, visitorName, status, loggedBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      visitId, societyId, host.residencyId, host.residentId, host.flat, kind, name, me!.user.id, now.toISOString(),
    );
    await notify([host.residentId], {
      type: "gate_request",
      gateVisitId: visitId,
      title: "Visitor at the gate",
      body: `${KIND_LABELS[kind as GateKind]} arrival for flat ${host.flat}. Open Visitors to approve or deny entry.`,
    });
    return visitId;
  });
}

export async function decideVisit(me: Me | null, visitId: string, decision: string, now = new Date()) {
  await inTransaction(async () => {
    const host = memberHost(me);
    if (!(await isHostVerified(host))) throw new GateError("Verify your flat to respond to visitors.");
    if (decision !== "approved" && decision !== "denied") throw new GateError("Choose approve or deny.");
    const at = now.toISOString();
    const result = await run(
      `UPDATE gate_visit SET status = ?, decidedBy = ?, decidedAt = ?
       WHERE id = ? AND societyId = ? AND residencyId = ? AND residentId = ? AND flat = ? AND status = 'pending'`,
      decision, host.residentId, at, visitId, host.societyId, host.residencyId, host.residentId, host.flat,
    );
    if (!result.changes) throw new GateError("That request is no longer pending for your flat.");
    await run(
      `UPDATE notification SET readAt = ?
       WHERE userId = ? AND gateVisitId = ? AND type = 'gate_request' AND readAt IS NULL`,
      at, host.residentId, visitId,
    );
  });
}

export async function recordVisitMovement(me: Me | null, visitId: string, direction: string, now = new Date()) {
  await inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const at = now.toISOString();
    if (direction === "in") {
      const host = await one<GateHost & { expiresAt: string | null }>(
        `SELECT v.residencyId, v.residentId, v.societyId, v.flat, p.expiresAt
         FROM gate_visit v LEFT JOIN gate_pass p ON p.id = v.passId
         WHERE v.id = ? AND v.societyId = ? AND v.status = 'approved'`,
        visitId, societyId,
      );
      if (!host || !(await isHostVerified(host))) throw new GateError("Entry requires approval from the visitor’s verified host.");
      if (host.expiresAt && host.expiresAt <= at) throw new GateError("That guest pass has expired. Request entry for the guest.");
      const result = await run(
        `UPDATE gate_visit SET status = 'checked_in', checkedInBy = ?, checkedInAt = ?
         WHERE id = ? AND societyId = ? AND status = 'approved'`,
        me!.user.id, at, visitId, societyId,
      );
      if (!result.changes) throw new GateError("Entry requires approval from the visitor’s verified host.");
      return;
    }
    if (direction !== "out") throw new GateError("Choose check-in or check-out.");
    const result = await run(
      `UPDATE gate_visit SET status = 'checked_out', checkedOutBy = ?, checkedOutAt = ?
       WHERE id = ? AND societyId = ? AND status = 'checked_in'`,
      me!.user.id, at, visitId, societyId,
    );
    if (!result.changes) throw new GateError("Only visitors currently checked in can be checked out.");
  });
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function residentPasses(me: Me | null) {
  const host = memberHost(me);
  return all<GuestPass>(
    `SELECT id, guestName, createdAt, expiresAt, usedAt FROM gate_pass
     WHERE societyId = ? AND residencyId = ? AND residentId = ? AND flat = ?
     ORDER BY createdAt DESC, id DESC LIMIT 40`,
    host.societyId, host.residencyId, host.residentId, host.flat,
  );
}

export async function createGuestPass(me: Me | null, rawName: string, now = new Date()) {
  return inTransaction(async () => {
    const host = memberHost(me);
    if (!(await isHostVerified(host))) throw new GateError("Verify your flat to create a guest pass.");
    const name = visitorName(rawName);
    const code = Array.from(randomBytes(CODE_LENGTH), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + PASS_LIFETIME_MS).toISOString();
    await run(
      `INSERT INTO gate_pass (id, societyId, residencyId, residentId, flat, guestName, codeHash, createdAt, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, host.societyId, host.residencyId, host.residentId, host.flat, name, hashCode(code), now.toISOString(), expiresAt,
    );
    return { id, code: `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`, expiresAt };
  });
}

export async function redeemGuestPass(me: Me | null, rawCode: string, now = new Date()) {
  return inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const unavailable = "That guest pass is invalid, expired or already used.";
    const code = rawCode.trim().replace(/[\s-]/g, "").toUpperCase();
    if (code.length !== CODE_LENGTH) throw new GateError(unavailable);
    const at = now.toISOString();
    const pass = await one<GateHost & GuestPass>(
      `SELECT * FROM gate_pass
       WHERE societyId = ? AND codeHash = ? AND usedAt IS NULL AND createdAt <= ? AND expiresAt > ?`,
      societyId, hashCode(code), at, at,
    );
    if (!pass || !(await isHostVerified(pass))) throw new GateError(unavailable);

    const visitId = randomUUID();
    const result = await run("UPDATE gate_pass SET usedAt = ? WHERE id = ? AND usedAt IS NULL", at, pass.id);
    if (!result.changes) throw new GateError(unavailable);
    await run(
      `INSERT INTO gate_visit (id, societyId, residencyId, residentId, flat, kind, visitorName, status,
         passId, loggedBy, createdAt, decidedBy, decidedAt)
       VALUES (?, ?, ?, ?, ?, 'guest', ?, 'approved', ?, ?, ?, ?, ?)`,
      visitId, societyId, pass.residencyId, pass.residentId, pass.flat, pass.guestName,
      pass.id, me!.user.id, at, pass.residentId, pass.createdAt,
    );
    return visitId;
  });
}
