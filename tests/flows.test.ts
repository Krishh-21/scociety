import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/lib/types";

const dbFile = path.join(os.tmpdir(), `jodo-flows-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { all, getDb, one, run, seedIfEmpty } = await import("@/lib/db");
const {
  DealError, approveDeal, completeJob, createDeal, expireDeal, getDealView, joinDeal, lockDeal,
  openDisputes, paymentsForMember, queueAhead, raiseDispute, rateJob, resolveDispute, simulateJoins,
  revisitsForOps, revisitsForResident, revisitsForVendor, scheduleRevisit, startJob, startService, tickDeal,
} = await import("@/lib/deals");
const { listNotifications, unreadCount } = await import("@/lib/notify");
const { can } = await import("@/lib/authz");

const AC = "deal_ac_sunday";
const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";

function freeResident(dealId: string) {
  return one<{ id: string; flat: string }>(
    `SELECT u.id, r.flat FROM user u JOIN residency r ON r.userId = u.id AND r.societyId = ?
     WHERE u.id NOT IN (SELECT userId FROM deal_member WHERE dealId = ? AND status <> 'left')
     ORDER BY r.flat LIMIT 1`,
    GREEN, dealId,
  )!;
}

function newDeal(opts: { skuId?: string; societyId?: string; target?: number; hours?: number } = {}) {
  return createDeal({
    societyId: opts.societyId ?? GREEN,
    skuId: opts.skuId ?? "sku_pest",
    vendorId: "ven_greenshield",
    createdBy: "usr_rahul",
    serviceDate: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    targetFlats: opts.target ?? 10,
    deadlineHours: opts.hours ?? 48,
  });
}

beforeEach(() => {
  getDb();
});

afterAll(() => {
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      /* the OS can have it */
    }
  }
});

describe("slot capacity", () => {
  it("refuses a join that would over-book a crew's slot", () => {
    const view = getDealView(AC)!;
    const slot = view.slotLoad[0];
    const room = slot.capacity - slot.used;
    const r = freeResident(AC);
    expect(() =>
      joinDeal({
        dealId: AC, userId: r.id, flat: r.flat, units: room + 1,
        slot: slot.slot, paymentMethod: "upi", societyId: GREEN,
      }),
    ).toThrow(/slot/i);
  });

  it("reports how full each slot is", () => {
    const view = getDealView(AC)!;
    const total = view.slotLoad.reduce((n, s) => n + s.used, 0);
    expect(total).toBe(view.unitsJoined);
    expect(view.slotLoad.every((s) => s.capacity === view.sku.unitsPerSlot)).toBe(true);
  });
});

describe("committee approval", () => {
  it("holds a new group for approval in a society that asked for it", () => {
    run("INSERT OR IGNORE INTO residency (id,userId,societyId,flat,type,status,verifiedVia,createdAt) VALUES ('res_palm','usr_kulkarni',?,'D-101','owner','verified','ops',?)",
      PALM, new Date().toISOString());
    const id = createDeal({
      societyId: PALM, skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: "usr_kulkarni",
      serviceDate: new Date(Date.now() + 6 * 86_400_000).toISOString(), targetFlats: 10, deadlineHours: 48,
    });
    expect(getDealView(id)!.status).toBe("pending");

    expect(() =>
      joinDeal({
        dealId: id, userId: "usr_kulkarni", flat: "D-101", units: 1,
        slot: "10:00–12:00", paymentMethod: "upi", societyId: PALM,
      }),
    ).toThrow(/closed for joining/i);

    const approved = approveDeal(id, "usr_kulkarni");
    expect(approved.status).toBe("open");
    expect(approved.approvedBy).toBe("usr_kulkarni");
  });

  it("goes live immediately where no approval is required", () => {
    expect(getDealView(newDeal())!.status).toBe("open");
  });
});

describe("one automatic extension", () => {
  it("extends a group that nearly made it instead of killing it", () => {
    const id = newDeal({ target: 10 });
    simulateJoins(id, 6); // mvs is 8 for pest control, 60% of it is 5
    run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);

    tickDeal(id);
    const extended = getDealView(id)!;
    expect(extended.status).toBe("open");
    expect(extended.extendedAt).not.toBeNull();
    expect(extended.msToDeadline).toBeGreaterThan(24 * 3_600_000);

    // …but only once.
    run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);
    tickDeal(id);
    expect(getDealView(id)!.status).toBe("expired");
  });

  it("expires a group nobody joined, without an extension", () => {
    const id = newDeal();
    run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);
    tickDeal(id);
    expect(getDealView(id)!.status).toBe("expired");
  });
});

describe("payment ledger", () => {
  it("authorises on join, captures on lock, and never before", () => {
    const id = newDeal({ target: 10 });
    simulateJoins(id, 9);
    const joined = getDealView(id)!;
    const member = joined.members[0];

    const authorised = paymentsForMember(member.id);
    expect(authorised).toHaveLength(1);
    expect(authorised[0]).toMatchObject({ type: "authorisation", status: "held" });

    lockDeal(id);
    const afterLock = paymentsForMember(member.id);
    expect(afterLock.find((p) => p.type === "authorisation")!.status).toBe("captured");
    const capture = afterLock.find((p) => p.type === "capture")!;
    expect(capture.amountPaise).toBe(getDealView(id)!.currentPricePaise * member.units);

    expect(() => expireDeal(id)).toThrow(DealError);
    expect(paymentsForMember(member.id)).toEqual(afterLock);
    expect(getDealView(id)!.status).toBe("locked");
  });

  it("releases every authorisation when a group expires", () => {
    const id = newDeal();
    simulateJoins(id, 2);
    const member = getDealView(id)!.members[0];
    run("UPDATE deal SET joinDeadline = ?, extendedAt = ? WHERE id = ?",
      new Date(Date.now() - 60_000).toISOString(), new Date().toISOString(), id);
    tickDeal(id);

    const payments = paymentsForMember(member.id);
    expect(payments.find((p) => p.type === "authorisation")!.status).toBe("released");
    expect(payments.some((p) => p.type === "capture")).toBe(false);
  });
});

describe("service day", () => {
  function bookedDeal() {
    const id = newDeal({ target: 10 });
    simulateJoins(id, 9);
    lockDeal(id);
    return id;
  }

  it("gives the confirmed demo group a visit for every booking", () => {
    const deal = getDealView("deal_carwash")!;
    expect(deal.status).toBe("locked");
    const jobs = all<{ status: string; startOtp: string }>("SELECT * FROM job WHERE dealId = ?", deal.id);
    expect(jobs).toHaveLength(deal.members.length);
    expect(jobs.every((job) => job.status === "scheduled" && /^\d{4}$/.test(job.startOtp))).toBe(true);
    const member = deal.members[0];
    expect(paymentsForMember(member.id)).toMatchObject([
      { type: "capture", amountPaise: member.finalPricePaise! * member.units },
    ]);
  });

  it("repairs an existing demo group whose service day started without any jobs", () => {
    const id = "deal_carwash";
    run("DELETE FROM job WHERE dealId = ?", id);
    run("DELETE FROM payment WHERE dealId = ?", id);
    run("UPDATE deal SET status = 'in_progress' WHERE id = ?", id);

    seedIfEmpty(getDb());
    const jobs = all<{ id: string; status: string; slot: string }>(
      "SELECT id, status, slot FROM job WHERE dealId = ? ORDER BY slot, id", id,
    );
    expect(jobs).toHaveLength(getDealView(id)!.members.length);
    expect(jobs.every((job) => job.status === (job.slot === jobs[0].slot ? "en_route" : "scheduled"))).toBe(true);

    seedIfEmpty(getDb());
    expect(all("SELECT id, status, slot FROM job WHERE dealId = ? ORDER BY slot, id", id)).toEqual(jobs);
    expect(all("SELECT id FROM payment WHERE dealId = ? AND type = 'capture'", id)).toHaveLength(jobs.length);
  });

  it("sends out one slot at a time", () => {
    const id = bookedDeal();
    startService(id);
    const jobs = all<{ slot: string; status: string }>("SELECT slot, status FROM job WHERE dealId = ?", id);
    const enRoute = new Set(jobs.filter((j) => j.status === "en_route").map((j) => j.slot));
    expect(enRoute.size).toBe(1);
    expect(jobs.some((j) => j.status === "scheduled")).toBe(true);
  });

  it("needs the resident's start code, then their completion code", () => {
    const id = bookedDeal();
    startService(id);
    const job = one<{ id: string; startOtp: string; endOtp: string }>(
      "SELECT * FROM job WHERE dealId = ? AND status='en_route' LIMIT 1", id,
    )!;

    expect(() => startJob(job.id, "0000")).toThrow(/start code/i);
    startJob(job.id, job.startOtp);
    expect(() => completeJob(job.id, "0000")).toThrow(/OTP/i);
    completeJob(job.id, job.endOtp);

    expect(one<{ status: string }>("SELECT status FROM job WHERE id = ?", job.id)!.status).toBe("completed");
  });

  it("rejects out-of-order service actions and leaves a completed visit unchanged on retry", () => {
    const id = bookedDeal();
    const job = one<{ id: string; startOtp: string; endOtp: string; userId: string }>(
      `SELECT j.*, m.userId FROM job j JOIN deal_member m ON m.id = j.memberId
       WHERE j.dealId = ? ORDER BY j.slot LIMIT 1`, id,
    )!;

    expect(() => startJob(job.id, job.startOtp)).toThrow(DealError);
    expect(() => completeJob(job.id, job.endOtp)).toThrow(DealError);
    expect(() => rateJob(job.id, 5, "Too early")).toThrow(DealError);
    startService(id);
    const nextSlot = one<{ id: string; startOtp: string }>(
      "SELECT * FROM job WHERE dealId = ? AND status='scheduled' LIMIT 1", id,
    )!;
    expect(() => startJob(nextSlot.id, nextSlot.startOtp)).toThrow(DealError);
    expect(() => completeJob(job.id, job.endOtp)).toThrow(DealError);

    startJob(job.id, job.startOtp);
    expect(() => startJob(job.id, job.startOtp)).toThrow(DealError);
    completeJob(job.id, job.endOtp);
    expect(getDealView(id)!.status).toBe("in_progress");
    rateJob(job.id, 5, "All done");
    const visit = one("SELECT * FROM job WHERE id = ?", job.id);
    expect(() => completeJob(job.id, job.endOtp)).toThrow(DealError);
    expect(one("SELECT * FROM job WHERE id = ?", job.id)).toEqual(visit);
    expect(listNotifications(job.userId).filter((n) => n.dealId === id && n.type === "job_done")).toHaveLength(1);
  });

  it("tells a resident how many flats are ahead of them", () => {
    const id = bookedDeal();
    startService(id);
    const jobs = all<{ id: string }>("SELECT id FROM job WHERE dealId = ? ORDER BY slot, flat", id);
    expect(queueAhead(id, jobs[0].id)).toMatchObject({ ahead: 0 });
    expect(queueAhead(id, jobs[2].id)!.ahead).toBe(2);
  });

  it("marks the whole group completed once the last job closes", () => {
    const id = bookedDeal();
    startService(id);
    let guard = 0;
    while (guard++ < 50) {
      const job = one<{ id: string; startOtp: string; endOtp: string }>(
        "SELECT * FROM job WHERE dealId = ? AND status = 'en_route' LIMIT 1", id,
      );
      if (!job) break;
      startJob(job.id, job.startOtp);
      completeJob(job.id, job.endOtp);
    }
    expect(getDealView(id)!.status).toBe("completed");
  });
});

describe("disputes and warranty", () => {
  function completedJob() {
    const id = newDeal({ target: 10 });
    simulateJoins(id, 9);
    lockDeal(id);
    startService(id);
    const job = one<{ id: string; startOtp: string; endOtp: string; memberId: string }>(
      "SELECT * FROM job WHERE dealId = ? AND status='en_route' LIMIT 1", id,
    )!;
    startJob(job.id, job.startOtp);
    completeJob(job.id, job.endOtp);
    const member = one<{ userId: string }>("SELECT userId FROM deal_member WHERE id = ?", job.memberId)!;
    return { dealId: id, job, userId: member.userId };
  }

  it("lets the resident raise an issue inside the warranty window", () => {
    const { job, userId } = completedJob();
    const disputeId = raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "Still seeing ants." });
    expect(openDisputes().find((d) => d.id === disputeId)!.status).toBe("open");
  });

  it("refuses a second open issue on the same job", () => {
    const { job, userId } = completedJob();
    raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Arrived two hours late." });
    expect(() => raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Again." })).toThrow(DealError);
  });

  it("refuses an issue once the warranty window has closed", () => {
    const { job, userId } = completedJob();
    run("UPDATE job SET finishedAt = ? WHERE id = ?", new Date(Date.now() - 400 * 86_400_000).toISOString(), job.id);
    expect(() => raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Old job." })).toThrow(/warranty/i);
  });

  it("writes a refund to the ledger when ops refunds", () => {
    const { job, userId } = completedJob();
    const disputeId = raiseDispute({ jobId: job.id, userId, reason: "Damage", detail: "Scratched the wall." });
    resolveDispute(disputeId, "refund", "Refunded in full, vendor warned.");

    const payments = paymentsForMember(job.memberId);
    const refund = payments.find((p) => p.type === "refund")!;
    expect(refund.amountPaise).toBeGreaterThan(0);
    expect(openDisputes().find((d) => d.id === disputeId)!.status).toBe("resolved");

    const secondIssue = raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Separate issue." });
    expect(() => resolveDispute(secondIssue, "refund", "Second refund")).toThrow(/already refunded/i);
    expect(paymentsForMember(job.memberId).filter((p) => p.type === "refund")).toHaveLength(1);
    expect(openDisputes().find((d) => d.id === secondIssue)!.status).toBe("open");
  });

  it("turns an approved revisit into a separate no-charge visit with its own confirmation codes", () => {
    const { dealId, job, userId } = completedJob();
    const disputeId = raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "Still seeing ants." });
    const originalJob = one("SELECT * FROM job WHERE id = ?", job.id);
    const originalPayments = paymentsForMember(job.memberId);
    const indiaDate = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" }).format(date);
    const today = indiaDate(new Date());
    const tomorrow = indiaDate(new Date(Date.now() + 86_400_000));
    const slot = "10:00–12:00";

    resolveDispute(disputeId, "revisit", "Check the affected rooms.");
    expect(listNotifications(userId).some((n) => n.dealId === dealId && n.type === "revisit_requested")).toBe(true);
    const revisit = revisitsForResident(userId).find((visit) => visit.disputeId === disputeId)!;
    expect(revisit).toMatchObject({ dealId, status: "awaiting_schedule", serviceDate: null });
    expect(revisit.startOtp).not.toBe(revisit.endOtp);
    expect([job.startOtp, job.endOtp]).not.toContain(revisit.startOtp);
    expect([job.startOtp, job.endOtp]).not.toContain(revisit.endOtp);
    expect(revisitsForOps()).toContainEqual(revisit);
    expect(revisitsForVendor("ven_greenshield")).toContainEqual(revisit);
    expect(revisitsForVendor("ven_coolcare")).not.toContainEqual(revisit);
    expect(revisitsForResident("usr_rahul")).not.toContainEqual(revisit);

    const sampleVendor = one<User>("SELECT * FROM user WHERE id = 'usr_vendor_cool'")!;
    const assignedVendor = { user: { ...sampleVendor, vendorId: "ven_greenshield" }, residency: null };
    const otherVendor = { user: sampleVendor, residency: null };
    for (const kind of ["job.schedule_revisit", "job.start", "job.complete"] as const) {
      expect(can(assignedVendor, { kind, jobId: revisit.id })).toBe(true);
      expect(can(otherVendor, { kind, jobId: revisit.id })).toBe(false);
    }
    const otherIssue = raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "A second issue." });
    expect(() => resolveDispute(otherIssue, "revisit", "")).toThrow(/already pending or underway/i);
    expect(() => completeJob(revisit.id, revisit.endOtp)).toThrow(DealError);
    expect(() => scheduleRevisit(revisit.id, "2035-02-31", slot)).toThrow(DealError);
    expect(() => scheduleRevisit(revisit.id, today, "09:15")).toThrow(DealError);
    scheduleRevisit(revisit.id, tomorrow, slot);
    expect(() => startJob(revisit.id, revisit.startOtp)).toThrow(DealError);
    scheduleRevisit(revisit.id, today, slot);
    expect(revisitsForResident(userId).find((visit) => visit.id === revisit.id)).toMatchObject({
      status: "scheduled", serviceDate: today, slot,
    });
    expect(() => startJob(revisit.id, "0000")).toThrow(/start code/i);
    startJob(revisit.id, revisit.startOtp);
    expect(() => scheduleRevisit(revisit.id, tomorrow, slot)).toThrow(DealError);
    expect(() => completeJob(revisit.id, "0000")).toThrow(DealError);
    completeJob(revisit.id, revisit.endOtp);
    expect(() => completeJob(revisit.id, revisit.endOtp)).toThrow(DealError);

    expect(revisitsForResident(userId).find((visit) => visit.id === revisit.id)?.status).toBe("completed");
    const visitEvents = listNotifications(userId).filter((n) => n.dealId === dealId).map((n) => n.type);
    expect(visitEvents).toEqual(expect.arrayContaining(["revisit_scheduled", "revisit_started", "revisit_completed"]));
    expect(visitEvents.filter((type) => type === "revisit_completed")).toHaveLength(1);
    expect(getDealView(dealId)?.status).toBe("in_progress");
    expect(one("SELECT * FROM job WHERE id = ?", job.id)).toEqual(originalJob);
    expect(paymentsForMember(job.memberId)).toEqual(originalPayments);
  });

  it("brings prior approved revisits into the scheduling queue once", () => {
    const { job, userId } = completedJob();
    const oldId = raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "First legacy approval" });
    run("UPDATE dispute SET status = 'resolved', resolution = 'revisit: First approval.', resolvedAt = ? WHERE id = ?", new Date(Date.now() - 1000).toISOString(), oldId);
    const disputeId = raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "Latest legacy approval" });
    run("UPDATE dispute SET status = 'resolved', resolution = 'revisit: Check again.', resolvedAt = ? WHERE id = ?", new Date().toISOString(), disputeId);
    seedIfEmpty(getDb());
    seedIfEmpty(getDb());
    const visits = revisitsForResident(userId).filter((visit) => visit.disputeId === disputeId);
    expect(visits).toHaveLength(1);
    expect(visits[0].status).toBe("awaiting_schedule");
    expect(visits[0].startOtp).not.toBe(visits[0].endOtp);
    expect(revisitsForResident(userId).some((visit) => visit.disputeId === oldId)).toBe(false);
  });
});

describe("notifications", () => {
  it("tells the neighbours already in when the price drops", () => {
    const id = newDeal({ target: 10 });
    simulateJoins(id, 5); // the fifth join crosses the first slab
    const first = getDealView(id)!.members[0];
    const theirs = listNotifications(first.userId).filter((n) => n.dealId === id);
    expect(theirs.some((n) => n.type === "price_drop")).toBe(true);
    expect(unreadCount(first.userId)).toBeGreaterThan(0);
  });

  it("tells the society when a group is confirmed, and when one doesn't fill", () => {
    const locked = newDeal({ target: 10 });
    simulateJoins(locked, 9);
    const member = getDealView(locked)!.members[0];
    lockDeal(locked);
    expect(listNotifications(member.userId).some((n) => n.type === "locked")).toBe(true);

    const dead = newDeal();
    simulateJoins(dead, 1);
    const lonely = getDealView(dead)!.members[0];
    run("UPDATE deal SET joinDeadline = ?, extendedAt = ? WHERE id = ?",
      new Date(Date.now() - 60_000).toISOString(), new Date().toISOString(), dead);
    tickDeal(dead);
    expect(listNotifications(lonely.userId).some((n) => n.type === "expired")).toBe(true);
  });

  it("announces a new group to the rest of the society", () => {
    const before = listNotifications("usr_kulkarni").length;
    newDeal();
    expect(listNotifications("usr_kulkarni").length).toBeGreaterThan(before);
  });
});
