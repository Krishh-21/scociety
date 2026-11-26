import { all, inTransaction, one, run } from "./db";
import { isDemoMode } from "./auth-mode";
import type { Me } from "./session";
import { requireSocietyCommittee } from "./society-access";
import type { Residency } from "./types";

export class MembershipError extends Error {}

type MembershipRequest = Pick<Residency, "id" | "flat" | "type"> & {
  name: string;
  phone: string;
  createdAt: string;
};

const CURRENT_RESIDENT = `r.societyId = ? AND r.status = 'verified' AND u.role = 'resident' AND r.id = (
  SELECT latest.id FROM residency latest WHERE latest.userId = r.userId AND latest.status = 'verified'
  ORDER BY latest.createdAt DESC, latest.id LIMIT 1
)`;

export async function listMembershipRequests(me: Me | null) {
  const { societyId } = requireSocietyCommittee(me);
  return all<MembershipRequest>(
    `SELECT r.id, r.flat, r.type, r.createdAt, u.name, u.phone
       FROM residency r JOIN user u ON u.id = r.userId
      WHERE r.societyId = ? AND r.status = 'pending' ORDER BY r.createdAt, r.id`,
    societyId,
  );
}

export async function reviewMembershipRequest(me: Me | null, requestId: string, decision: string) {
  const { societyId } = requireSocietyCommittee(me);
  if (decision !== "approve" && decision !== "reject") {
    throw new MembershipError("Choose whether to approve or reject this request.");
  }

  return inTransaction(async () => {
    const request = await one<Pick<Residency, "userId" | "flat">>(
      "SELECT userId, flat FROM residency WHERE id = ? AND societyId = ? AND status = 'pending'",
      requestId, societyId,
    );
    if (!request) throw new MembershipError("This flat request is no longer awaiting review.");

    if (decision === "approve") {
      const verified = await one<Pick<Residency, "userId">>(
        `SELECT userId FROM residency WHERE status = 'verified' AND
           (userId = ? OR (societyId = ? AND flat = ?))`,
        request.userId, societyId, request.flat,
      );
      if (verified?.userId === request.userId) {
        throw new MembershipError("This applicant already has a verified flat.");
      }
      if (verified) throw new MembershipError(`${request.flat} is already verified for another resident.`);
    }

    await run(
      "UPDATE residency SET status = ?, verifiedVia = ? WHERE id = ? AND societyId = ? AND status = 'pending'",
      decision === "approve" ? "verified" : "rejected", decision === "approve" ? "committee" : null, requestId, societyId,
    );
  });
}

export async function listVerifiedResidents(me: Me | null) {
  const { societyId } = requireSocietyCommittee(me);
  return all<Pick<MembershipRequest, "id" | "flat" | "name" | "phone">>(
    `SELECT r.id, r.flat, u.name, u.phone FROM residency r JOIN user u ON u.id = r.userId
     WHERE ${CURRENT_RESIDENT} ORDER BY r.flat`,
    societyId,
  );
}

export async function revokeMembership(me: Me | null, residencyId: string) {
  const { societyId } = requireSocietyCommittee(me);
  if (isDemoMode()) throw new MembershipError("Membership revocation is available in live societies.");

  return inTransaction(async () => {
    const target = await one<Pick<Residency, "userId">>(
      `SELECT r.userId FROM residency r JOIN user u ON u.id = r.userId WHERE ${CURRENT_RESIDENT} AND r.id = ?`,
      societyId, residencyId,
    );
    if (!target) throw new MembershipError("This account is no longer a verified resident of your society.");

    await run(
      "UPDATE residency SET status = 'revoked' WHERE userId = ? AND societyId = ? AND status = 'verified'",
      target.userId, societyId,
    );
    await run("DELETE FROM session WHERE userId = ?", target.userId);
  });
}
