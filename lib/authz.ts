import { one } from "./db";
import type { Me } from "./session";

/**
 * Every mutating action goes through assertCan. Deny by default: a signed-in
 * resident must not be able to lock a group, re-price a vendor's ladder, close
 * someone else's job, or rate a job that isn't theirs.
 */
export class ForbiddenError extends Error {}

type DealRow = { id: string; societyId: string; vendorId: string; createdBy: string };

function deal(dealId: string): DealRow {
  const row = one<DealRow>("SELECT id, societyId, vendorId, createdBy FROM deal WHERE id = ?", dealId);
  if (!row) throw new ForbiddenError("Deal not found.");
  return row;
}

const isOps = (me: Me) => me.user.role === "ops";
const isDealVendor = (me: Me, d: DealRow) => !!me.user.vendorId && me.user.vendorId === d.vendorId;
const isResidentOf = (me: Me, societyId: string) =>
  me.residency?.status === "verified" && me.residency.societyId === societyId;
const isCommittee = (me: Me, societyId: string) =>
  me.user.role === "secretary" && isResidentOf(me, societyId);

export type Action =
  | { kind: "deal.view"; dealId: string }
  | { kind: "deal.join"; dealId: string }
  | { kind: "deal.comment"; dealId: string }
  | { kind: "deal.lock"; dealId: string }
  | { kind: "deal.expire"; dealId: string }
  | { kind: "deal.start_service"; dealId: string }
  | { kind: "deal.update_slabs"; dealId: string }
  | { kind: "deal.simulate"; dealId: string }
  | { kind: "deal.approve"; dealId: string }
  | { kind: "job.start"; jobId: string }
  | { kind: "dispute.raise"; jobId: string }
  | { kind: "dispute.resolve" }
  | { kind: "job.complete"; jobId: string }
  | { kind: "job.rate"; jobId: string }
  | { kind: "demo.reset" }
  | { kind: "console.ops" }
  | { kind: "console.vendor" };

export function can(me: Me, action: Action): boolean {
  switch (action.kind) {
    case "console.ops":
      return isOps(me);
    case "console.vendor":
      return isOps(me) || !!me.user.vendorId;

    case "deal.view":
    case "deal.join":
    case "deal.comment": {
      const d = deal(action.dealId);
      if (isOps(me)) return action.kind === "deal.view";
      if (isDealVendor(me, d)) return action.kind === "deal.view";
      return isResidentOf(me, d.societyId);
    }

    case "deal.lock":
    case "deal.expire": {
      const d = deal(action.dealId);
      return isOps(me) || isDealVendor(me, d) || isCommittee(me, d.societyId);
    }

    case "deal.start_service":
    case "deal.update_slabs": {
      const d = deal(action.dealId);
      return isOps(me) || isDealVendor(me, d);
    }

    case "deal.approve": {
      const d = deal(action.dealId);
      return isOps(me) || isCommittee(me, d.societyId);
    }

    case "dispute.resolve":
      return isOps(me);

    case "dispute.raise": {
      const row = one<{ userId: string }>(
        "SELECT m.userId FROM job j JOIN deal_member m ON m.id = j.memberId WHERE j.id = ?",
        action.jobId,
      );
      return !!row && row.userId === me.user.id;
    }

    case "job.start": {
      const row = one<{ dealId: string }>("SELECT dealId FROM job WHERE id = ?", action.jobId);
      if (!row) return false;
      return isOps(me) || isDealVendor(me, deal(row.dealId));
    }

    case "deal.simulate":
    case "demo.reset":
      // Demo controls: ops only, and never in a production deployment.
      return isOps(me) && process.env.NODE_ENV !== "production";

    case "job.complete": {
      const row = one<{ dealId: string }>("SELECT dealId FROM job WHERE id = ?", action.jobId);
      if (!row) return false;
      return isOps(me) || isDealVendor(me, deal(row.dealId));
    }

    case "job.rate": {
      const row = one<{ userId: string }>(
        "SELECT m.userId FROM job j JOIN deal_member m ON m.id = j.memberId WHERE j.id = ?",
        action.jobId,
      );
      return !!row && row.userId === me.user.id;
    }

    default:
      return false;
  }
}

const MESSAGES: Record<string, string> = {
  "deal.join": "Groups are private to the society they belong to.",
  "deal.comment": "Only verified residents of this society can comment.",
  "deal.lock": "Only the vendor, the committee or JODO ops can lock a group.",
  "deal.expire": "Only the vendor, the committee or JODO ops can close a group.",
  "deal.start_service": "Only the vendor or JODO ops can start a service day.",
  "deal.update_slabs": "Only the vendor who published this ladder can change it.",
  "deal.simulate": "Demo controls are available to JODO ops in development only.",
  "demo.reset": "Demo controls are available to JODO ops in development only.",
  "job.complete": "Only the vendor on this job can close it.",
  "job.rate": "You can only rate your own job.",
  "job.start": "Only the vendor on this job can start it.",
  "deal.approve": "Only the society committee or JODO ops can approve a group.",
  "dispute.raise": "You can only raise an issue on your own job.",
  "dispute.resolve": "Only JODO ops can resolve an issue.",
};

export function assertCan(me: Me, action: Action): void {
  if (!can(me, action)) {
    throw new ForbiddenError(MESSAGES[action.kind] ?? "You don't have access to that.");
  }
}
