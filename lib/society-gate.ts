import { createHash, randomBytes, randomUUID } from "node:crypto";
import { all, inTransaction, one, run } from "./db";
import { notify } from "./notify";
import type { Me } from "./session";
import { requireSocietyCommittee, requireSocietyGuard, requireSocietyMember } from "./society-access";

const KIND_LABELS = { guest: "Guest", delivery: "Delivery", help: "Home help" } as const;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
export const GATE_TICKET_WINDOW_MINUTES = 30;
const VISIT_FIELDS = "v.id, v.kind, v.visitorName, v.flat, v.passId, v.createdAt, v.decidedAt, v.checkedInAt, v.checkedOutAt, v.cancelledAt";
const PENDING_IN_WINDOW = "v.createdAt > ?";
const APPROVAL_IN_WINDOW = `(
  (v.passId IS NULL AND v.decidedAt IS NOT NULL AND v.decidedAt > ?)
  OR EXISTS (SELECT 1 FROM gate_pass p WHERE p.id = v.passId AND p.expiresAt > ?)
)`;
const PASS_CAN_BE_USED = "usedAt IS NULL AND revokedAt IS NULL AND createdAt <= ? AND expiresAt > ?";
const RESIDENT_VISIT_SCOPE = "v.residencyId = ? AND v.residentId = ? AND v.societyId = ? AND v.flat = ?";
const VERIFIED_HOSTS = `FROM residency r JOIN user u ON u.id = r.userId
  WHERE r.status = 'verified' AND u.role IN ('resident', 'secretary')`;
const VISIT_HAS_VERIFIED_HOST = `EXISTS (SELECT 1 ${VERIFIED_HOSTS}
  AND r.id = v.residencyId AND r.userId = v.residentId AND r.societyId = v.societyId AND r.flat = v.flat)`;
const indiaDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" });

export const gateKindLabels = KIND_LABELS;

export type GateKind = keyof typeof KIND_LABELS;
export type GateStatus = "pending" | "approved" | "denied" | "checked_in" | "checked_out" | "cancelled" | "expired" | "host_unavailable";
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
  cancelledAt: string | null;
};

type GateHost = { residencyId: string; residentId: string; societyId: string; flat: string };
type GuestPass = {
  id: string;
  guestName: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export class GateError extends Error {}

function ticketCutoff(now: Date) {
  return new Date(now.getTime() - GATE_TICKET_WINDOW_MINUTES * 60 * 1000).toISOString();
}

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
    `SELECT 1 ${VERIFIED_HOSTS} AND r.id = ? AND r.userId = ? AND r.societyId = ? AND r.flat = ?`,
    host.residencyId, host.residentId, host.societyId, host.flat,
  ));
}

async function gateVisits(where: string, now: Date, ...params: string[]) {
  const cutoff = ticketCutoff(now);
  return all<GateVisit>(
    `WITH scoped AS (
       SELECT ${VISIT_FIELDS},
              CASE
                WHEN v.cancelledAt IS NOT NULL THEN 'cancelled'
                WHEN v.status = 'pending' AND NOT (${PENDING_IN_WINDOW}) THEN 'expired'
                WHEN v.status = 'approved' AND NOT ${APPROVAL_IN_WINDOW} THEN 'expired'
                WHEN v.status IN ('pending', 'approved') AND NOT ${VISIT_HAS_VERIFIED_HOST} THEN 'host_unavailable'
                ELSE v.status
              END AS status
       FROM gate_visit v WHERE ${where}
     ), recent AS (
       SELECT * FROM scoped WHERE status IN ('denied', 'checked_out', 'cancelled', 'expired', 'host_unavailable')
       ORDER BY createdAt DESC, id DESC LIMIT 40
     )
     SELECT * FROM scoped WHERE status IN ('pending', 'approved', 'checked_in')
     UNION ALL SELECT * FROM recent
     ORDER BY createdAt DESC, id DESC`,
    cutoff, cutoff, now.toISOString(), ...params,
  );
}

export async function gateDirectory(me: Me | null) {
  const { societyId } = await requireSocietyGuard(me);
  return all<{ id: string; flat: string; name: string }>(
    `SELECT r.id, r.flat, u.name ${VERIFIED_HOSTS} AND r.societyId = ?
     ORDER BY r.flat`,
    societyId,
  );
}

export async function guardVisits(me: Me | null, now = new Date()) {
  const { societyId } = await requireSocietyGuard(me);
  return gateVisits("v.societyId = ?", now, societyId);
}

export async function committeeGateVisits(me: Me | null, now = new Date()) {
  const { societyId } = requireSocietyCommittee(me);
  return gateVisits("v.societyId = ?", now, societyId);
}

export async function residentVisits(me: Me | null, now = new Date()) {
  const host = memberHost(me);
  return gateVisits(RESIDENT_VISIT_SCOPE, now, host.residencyId, host.residentId, host.societyId, host.flat);
}

export async function residentPendingVisits(me: Me | null, now = new Date()): Promise<GateVisit[]> {
  const host = memberHost(me);
  return all<GateVisit>(
    `SELECT ${VISIT_FIELDS}, v.status FROM gate_visit v
     WHERE ${RESIDENT_VISIT_SCOPE} AND v.status = 'pending' AND v.cancelledAt IS NULL
       AND ${PENDING_IN_WINDOW} AND ${VISIT_HAS_VERIFIED_HOST}
     ORDER BY v.createdAt DESC, v.id DESC`,
    host.residencyId, host.residentId, host.societyId, host.flat, ticketCutoff(now),
  );
}

export async function gateSummary(societyId: string, now = new Date()) {
  const start = new Date(`${indiaDate.format(now)}T00:00:00+05:30`);
  const end = new Date(start.getTime() + DAY_MS);
  const result = await one<{ count: number }>(
    "SELECT COUNT(*) AS count FROM gate_visit WHERE societyId = ? AND checkedInAt >= ? AND checkedInAt < ?",
    societyId, start.toISOString(), end.toISOString(),
  );
  return { visitorsToday: result?.count ?? 0 };
}

export async function logVisit(me: Me | null, input: { residencyId: string; kind: string; name: string }, now?: Date) {
  return inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const name = visitorName(input.name);
    const kind = input.kind;
    if (!Object.hasOwn(KIND_LABELS, kind)) throw new GateError("Choose a visitor type.");
    const host = await one<GateHost>(
      `SELECT r.id AS residencyId, r.userId AS residentId, r.societyId, r.flat
       ${VERIFIED_HOSTS} AND r.societyId = ? AND r.id = ?`,
      societyId, input.residencyId,
    );
    if (!host) throw new GateError("Choose a verified flat in your society.");

    const visitId = randomUUID();
    await run(
      `INSERT INTO gate_visit (id, societyId, residencyId, residentId, flat, kind, visitorName, status, loggedBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      visitId, societyId, host.residencyId, host.residentId, host.flat, kind, name, me!.user.id, (now ?? new Date()).toISOString(),
    );
    await notify([host.residentId], {
      type: "gate_request",
      gateVisitId: visitId,
      societyId: host.societyId,
      title: "Visitor at the gate",
      body: `${KIND_LABELS[kind as GateKind]} arrival for flat ${host.flat}. Open Visitors to approve or deny entry.`,
    });
    return visitId;
  });
}

async function markGateRequestRead(visitId: string, at: string) {
  await run(
    `UPDATE notification SET readAt = ?
     WHERE gateVisitId = ? AND type = 'gate_request' AND readAt IS NULL
       AND userId = (SELECT residentId FROM gate_visit WHERE id = ?)`,
    at, visitId, visitId,
  );
}

export async function decideVisit(me: Me | null, visitId: string, decision: string, now?: Date) {
  await inTransaction(async () => {
    const host = memberHost(me);
    if (!(await isHostVerified(host))) throw new GateError("Verify your flat to respond to visitors.");
    if (decision !== "approved" && decision !== "denied") throw new GateError("Choose approve or deny.");
    const actionTime = now ?? new Date();
    const at = actionTime.toISOString();
    const result = await run(
      `UPDATE gate_visit AS v SET status = ?, decidedBy = ?, decidedAt = ?
       WHERE v.id = ? AND ${RESIDENT_VISIT_SCOPE} AND v.status = 'pending' AND v.cancelledAt IS NULL
         AND ${PENDING_IN_WINDOW}`,
      decision, host.residentId, at, visitId, host.residencyId, host.residentId, host.societyId, host.flat, ticketCutoff(actionTime),
    );
    if (!result.changes) throw new GateError("That request is no longer pending for your flat.");
    await markGateRequestRead(visitId, at);
  });
}

export async function cancelVisit(me: Me | null, visitId: string, now?: Date) {
  await inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const actionTime = now ?? new Date();
    const at = actionTime.toISOString();
    const cutoff = ticketCutoff(actionTime);
    const result = await run(
      `UPDATE gate_visit AS v SET cancelledAt = ?, cancelledBy = ?
       WHERE v.id = ? AND v.societyId = ? AND v.cancelledAt IS NULL AND ${VISIT_HAS_VERIFIED_HOST}
         AND ((v.status = 'pending' AND ${PENDING_IN_WINDOW})
           OR (v.status = 'approved' AND ${APPROVAL_IN_WINDOW}))`,
      at, me!.user.id, visitId, societyId, cutoff, cutoff, at,
    );
    if (!result.changes) throw new GateError("That ticket is no longer open at your gate.");
    await markGateRequestRead(visitId, at);
  });
}

export async function recordVisitMovement(me: Me | null, visitId: string, direction: string, now?: Date) {
  await inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const actionTime = now ?? new Date();
    const at = actionTime.toISOString();
    if (direction === "in") {
      const cutoff = ticketCutoff(actionTime);
      const result = await run(
        `UPDATE gate_visit AS v SET status = 'checked_in', checkedInBy = ?, checkedInAt = ?
         WHERE v.id = ? AND v.societyId = ? AND v.status = 'approved' AND v.cancelledAt IS NULL
           AND ${APPROVAL_IN_WINDOW} AND ${VISIT_HAS_VERIFIED_HOST}`,
        me!.user.id, at, visitId, societyId, cutoff, at,
      );
      if (result.changes) return;
      const expired = await one<{ passId: string | null }>(
        `SELECT v.passId FROM gate_visit v
         WHERE v.id = ? AND v.societyId = ? AND v.status = 'approved' AND v.cancelledAt IS NULL
           AND NOT ${APPROVAL_IN_WINDOW}`,
        visitId, societyId, cutoff, at,
      );
      if (expired) {
        throw new GateError(expired.passId
          ? "That guest pass has expired. Request entry for the guest."
          : "That approval has expired. Send a new entry request.");
      }
      throw new GateError("Entry requires approval from the visitor’s verified host.");
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
    `SELECT id, guestName, createdAt, expiresAt, usedAt, revokedAt FROM gate_pass
     WHERE societyId = ? AND residencyId = ? AND residentId = ? AND flat = ?
     ORDER BY createdAt DESC, id DESC LIMIT 40`,
    host.societyId, host.residencyId, host.residentId, host.flat,
  );
}

export async function createGuestPass(me: Me | null, rawName: string, now?: Date) {
  return inTransaction(async () => {
    const host = memberHost(me);
    if (!(await isHostVerified(host))) throw new GateError("Verify your flat to create a guest pass.");
    const name = visitorName(rawName);
    const code = Array.from(randomBytes(CODE_LENGTH), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    const id = randomUUID();
    const actionTime = now ?? new Date();
    const expiresAt = new Date(actionTime.getTime() + DAY_MS).toISOString();
    await run(
      `INSERT INTO gate_pass (id, societyId, residencyId, residentId, flat, guestName, codeHash, createdAt, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, host.societyId, host.residencyId, host.residentId, host.flat, name, hashCode(code), actionTime.toISOString(), expiresAt,
    );
    return { id, code: `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`, expiresAt };
  });
}

export async function revokeGuestPass(me: Me | null, passId: string, now?: Date) {
  await inTransaction(async () => {
    const host = memberHost(me);
    if (!(await isHostVerified(host))) throw new GateError("Verify your flat to revoke a guest pass.");
    const at = (now ?? new Date()).toISOString();
    const result = await run(
      `UPDATE gate_pass SET revokedAt = ?
       WHERE id = ? AND societyId = ? AND residencyId = ? AND residentId = ? AND flat = ? AND ${PASS_CAN_BE_USED}`,
      at, passId, host.societyId, host.residencyId, host.residentId, host.flat, at, at,
    );
    if (!result.changes) throw new GateError("Only an active, unused guest pass can be revoked.");
  });
}

export async function redeemGuestPass(me: Me | null, rawCode: string, now?: Date) {
  return inTransaction(async () => {
    const { societyId } = await requireSocietyGuard(me);
    const unavailable = "That guest pass is invalid, expired, revoked or already used.";
    const code = rawCode.trim().replace(/[\s-]/g, "").toUpperCase();
    if (code.length !== CODE_LENGTH) throw new GateError(unavailable);
    const at = (now ?? new Date()).toISOString();
    const pass = await one<GateHost & GuestPass>(
      `SELECT * FROM gate_pass
       WHERE societyId = ? AND codeHash = ? AND ${PASS_CAN_BE_USED}`,
      societyId, hashCode(code), at, at,
    );
    if (!pass || !(await isHostVerified(pass))) throw new GateError(unavailable);

    const visitId = randomUUID();
    const result = await run(`UPDATE gate_pass SET usedAt = ? WHERE id = ? AND ${PASS_CAN_BE_USED}`, at, pass.id, at, at);
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
