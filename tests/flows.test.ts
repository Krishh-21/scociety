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

async function freeResident(dealId: string) {
  return (await one<{ id: string; flat: string }>(
    `SELECT u.id, r.flat FROM user u JOIN residency r ON r.userId = u.id AND r.societyId = ?
     WHERE u.id NOT IN (SELECT userId FROM deal_member WHERE dealId = ? AND status <> 'left')
     ORDER BY r.flat LIMIT 1`,
    GREEN, dealId,
  ))!;
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
  it("refuses a join that would over-book a crew's slot", async () => {
    const view = (await getDealView(AC))!;
    const slot = view.slotLoad[0];
    const room = slot.capacity - slot.used;
    const r = await freeResident(AC);
    await expect(joinDeal({
      dealId: AC, userId: r.id, flat: r.flat, units: room + 1,
      slot: slot.slot, paymentMethod: "upi", societyId: GREEN,
    })).rejects.toThrow(/slot/i);
  });

  it("reports how full each slot is", async () => {
    const view = (await getDealView(AC))!;
    const total = view.slotLoad.reduce((n, s) => n + s.used, 0);
    expect(total).toBe(view.unitsJoined);
    expect(view.slotLoad.every((s) => s.capacity === view.sku.unitsPerSlot)).toBe(true);
  });
});

describe("committee approval", () => {
  it("holds a new group for approval in a society that asked for it", async () => {
    await run("INSERT OR IGNORE INTO residency (id,userId,societyId,flat,type,status,verifiedVia,createdAt) VALUES ('res_palm','usr_kulkarni',?,'D-101','owner','verified','ops',?)",
      PALM, new Date().toISOString());
    const id = await createDeal({
      societyId: PALM, skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: "usr_kulkarni",
      serviceDate: new Date(Date.now() + 6 * 86_400_000).toISOString(), targetFlats: 10, deadlineHours: 48,
    });
    expect((await getDealView(id))!.status).toBe("pending");

    await expect(joinDeal({
      dealId: id, userId: "usr_kulkarni", flat: "D-101", units: 1,
      slot: "10:00–12:00", paymentMethod: "upi", societyId: PALM,
    })).rejects.toThrow(/closed for joining/i);

    const approved = await approveDeal(id, "usr_kulkarni");
    expect(approved.status).toBe("open");
    expect(approved.approvedBy).toBe("usr_kulkarni");
  });

  it("goes live immediately where no approval is required", async () => {
    expect((await getDealView(await newDeal()))!.status).toBe("open");
  });
});

describe("one automatic extension", () => {
  it("extends a group that nearly made it instead of killing it", async () => {
    const id = await newDeal({ target: 10 });
    await simulateJoins(id, 6); // mvs is 8 for pest control, 60% of it is 5
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);

    await tickDeal(id);
    const extended = (await getDealView(id))!;
    expect(extended.status).toBe("open");
    expect(extended.extendedAt).not.toBeNull();
    expect(extended.msToDeadline).toBeGreaterThan(24 * 3_600_000);

    // …but only once.
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);
    await tickDeal(id);
    expect((await getDealView(id))!.status).toBe("expired");
  });

  it("expires a group nobody joined, without an extension", async () => {
    const id = await newDeal();
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);
    await tickDeal(id);
    expect((await getDealView(id))!.status).toBe("expired");
  });
});

describe("payment ledger", () => {
  it("authorises on join, captures on lock, and never before", async () => {
    const id = await newDeal({ target: 10 });
    await simulateJoins(id, 9);
    const joined = (await getDealView(id))!;
    const member = joined.members[0];

    const authorised = await paymentsForMember(member.id);
    expect(authorised).toHaveLength(1);
    expect(authorised[0]).toMatchObject({ type: "authorisation", status: "held" });

    await lockDeal(id);
    const afterLock = await paymentsForMember(member.id);
    expect(afterLock.find((p) => p.type === "authorisation")!.status).toBe("captured");
    const capture = afterLock.find((p) => p.type === "capture")!;
    expect(capture.amountPaise).toBe((await getDealView(id))!.currentPricePaise * member.units);

    await expect(expireDeal(id)).rejects.toThrow(DealError);
    expect(await paymentsForMember(member.id)).toEqual(afterLock);
    expect((await getDealView(id))!.status).toBe("locked");
  });

  it("releases every authorisation when a group expires", async () => {
    const id = await newDeal();
    await simulateJoins(id, 2);
    const member = (await getDealView(id))!.members[0];
    await run("UPDATE deal SET joinDeadline = ?, extendedAt = ? WHERE id = ?",
      new Date(Date.now() - 60_000).toISOString(), new Date().toISOString(), id);
    await tickDeal(id);

    const payments = await paymentsForMember(member.id);
    expect(payments.find((p) => p.type === "authorisation")!.status).toBe("released");
    expect(payments.some((p) => p.type === "capture")).toBe(false);
  });
});

describe("service day", () => {
  async function bookedDeal() {
    const id = await newDeal({ target: 10 });
    await simulateJoins(id, 9);
    await lockDeal(id);
    return id;
  }

  it("gives the confirmed demo group a visit for every booking", async () => {
    const deal = (await getDealView("deal_carwash"))!;
    expect(deal.status).toBe("locked");
    const jobs = await all<{ status: string; startOtp: string }>("SELECT * FROM job WHERE dealId = ?", deal.id);
    expect(jobs).toHaveLength(deal.members.length);
    expect(jobs.every((job) => job.status === "scheduled" && /^\d{4}$/.test(job.startOtp))).toBe(true);
    const member = deal.members[0];
    expect(await paymentsForMember(member.id)).toMatchObject([
      { type: "capture", amountPaise: member.finalPricePaise! * member.units },
    ]);
  });

  it("repairs an existing demo group whose service day started without any jobs", async () => {
    const id = "deal_carwash";
    await run("DELETE FROM job WHERE dealId = ?", id);
    await run("DELETE FROM payment WHERE dealId = ?", id);
    await run("UPDATE deal SET status = 'in_progress' WHERE id = ?", id);

    seedIfEmpty(getDb());
    const jobs = await all<{ id: string; status: string; slot: string }>(
      "SELECT id, status, slot FROM job WHERE dealId = ? ORDER BY slot, id", id,
    );
    expect(jobs).toHaveLength((await getDealView(id))!.members.length);
    expect(jobs.every((job) => job.status === (job.slot === jobs[0].slot ? "en_route" : "scheduled"))).toBe(true);

    seedIfEmpty(getDb());
    expect(await all("SELECT id, status, slot FROM job WHERE dealId = ? ORDER BY slot, id", id)).toEqual(jobs);
    expect(await all("SELECT id FROM payment WHERE dealId = ? AND type = 'capture'", id)).toHaveLength(jobs.length);
  });

  it("sends out one slot at a time", async () => {
    const id = await bookedDeal();
    await startService(id);
    const jobs = await all<{ slot: string; status: string }>("SELECT slot, status FROM job WHERE dealId = ?", id);
    const enRoute = new Set(jobs.filter((j) => j.status === "en_route").map((j) => j.slot));
    expect(enRoute.size).toBe(1);
    expect(jobs.some((j) => j.status === "scheduled")).toBe(true);
  });

  it("needs the resident's start code, then their completion code", async () => {
    const id = await bookedDeal();
    await startService(id);
    const job = (await one<{ id: string; startOtp: string; endOtp: string }>(
      "SELECT * FROM job WHERE dealId = ? AND status='en_route' LIMIT 1", id,
    ))!;

    await expect(startJob(job.id, "0000")).rejects.toThrow(/start code/i);
    await startJob(job.id, job.startOtp);
    await expect(completeJob(job.id, "0000")).rejects.toThrow(/OTP/i);
    await completeJob(job.id, job.endOtp);

    expect((await one<{ status: string }>("SELECT status FROM job WHERE id = ?", job.id))!.status).toBe("completed");
  });

  it("rejects out-of-order service actions and leaves a completed visit unchanged on retry", async () => {
    const id = await bookedDeal();
    const job = (await one<{ id: string; startOtp: string; endOtp: string; userId: string }>(
      `SELECT j.*, m.userId FROM job j JOIN deal_member m ON m.id = j.memberId
       WHERE j.dealId = ? ORDER BY j.slot LIMIT 1`, id,
    ))!;

    await expect(startJob(job.id, job.startOtp)).rejects.toThrow(DealError);
    await expect(completeJob(job.id, job.endOtp)).rejects.toThrow(DealError);
    await expect(rateJob(job.id, 5, "Too early")).rejects.toThrow(DealError);
    await startService(id);
    const nextSlot = (await one<{ id: string; startOtp: string }>(
      "SELECT * FROM job WHERE dealId = ? AND status='scheduled' LIMIT 1", id,
    ))!;
    await expect(startJob(nextSlot.id, nextSlot.startOtp)).rejects.toThrow(DealError);
    await expect(completeJob(job.id, job.endOtp)).rejects.toThrow(DealError);

    await startJob(job.id, job.startOtp);
    await expect(startJob(job.id, job.startOtp)).rejects.toThrow(DealError);
    await completeJob(job.id, job.endOtp);
    expect((await getDealView(id))!.status).toBe("in_progress");
    await rateJob(job.id, 5, "All done");
    const visit = await one("SELECT * FROM job WHERE id = ?", job.id);
    await expect(completeJob(job.id, job.endOtp)).rejects.toThrow(DealError);
    expect(await one("SELECT * FROM job WHERE id = ?", job.id)).toEqual(visit);
    expect((await listNotifications(job.userId)).filter((n) => n.dealId === id && n.type === "job_done")).toHaveLength(1);
  });

  it("tells a resident how many flats are ahead of them", async () => {
    const id = await bookedDeal();
    await startService(id);
    const jobs = await all<{ id: string }>("SELECT id FROM job WHERE dealId = ? ORDER BY slot, flat", id);
    expect(await queueAhead(id, jobs[0].id)).toMatchObject({ ahead: 0 });
    expect((await queueAhead(id, jobs[2].id))!.ahead).toBe(2);
  });

  it("marks the whole group completed once the last job closes", async () => {
    const id = await bookedDeal();
    await startService(id);
    let guard = 0;
    while (guard++ < 50) {
      const job = await one<{ id: string; startOtp: string; endOtp: string }>(
        "SELECT * FROM job WHERE dealId = ? AND status = 'en_route' LIMIT 1", id,
      );
      if (!job) break;
      await startJob(job.id, job.startOtp);
      await completeJob(job.id, job.endOtp);
    }
    expect((await getDealView(id))!.status).toBe("completed");
  });
});

describe("disputes and warranty", () => {
  async function completedJob() {
    const id = await newDeal({ target: 10 });
    await simulateJoins(id, 9);
    await lockDeal(id);
    await startService(id);
    const job = (await one<{ id: string; startOtp: string; endOtp: string; memberId: string }>(
      "SELECT * FROM job WHERE dealId = ? AND status='en_route' LIMIT 1", id,
    ))!;
    await startJob(job.id, job.startOtp);
    await completeJob(job.id, job.endOtp);
    const member = (await one<{ userId: string }>("SELECT userId FROM deal_member WHERE id = ?", job.memberId))!;
    return { dealId: id, job, userId: member.userId };
  }

  it("lets the resident raise an issue inside the warranty window", async () => {
    const { job, userId } = await completedJob();
    const disputeId = await raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "Still seeing ants." });
    expect((await openDisputes()).find((d) => d.id === disputeId)!.status).toBe("open");
  });

  it("refuses a second open issue on the same job", async () => {
    const { job, userId } = await completedJob();
    await raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Arrived two hours late." });
    await expect(raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Again." })).rejects.toThrow(DealError);
  });

  it("refuses an issue once the warranty window has closed", async () => {
    const { job, userId } = await completedJob();
    await run("UPDATE job SET finishedAt = ? WHERE id = ?", new Date(Date.now() - 400 * 86_400_000).toISOString(), job.id);
    await expect(raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Old job." })).rejects.toThrow(/warranty/i);
  });

  it("writes a refund to the ledger when ops refunds", async () => {
    const { job, userId } = await completedJob();
    const disputeId = await raiseDispute({ jobId: job.id, userId, reason: "Damage", detail: "Scratched the wall." });
    await resolveDispute(disputeId, "refund", "Refunded in full, vendor warned.");

    const payments = await paymentsForMember(job.memberId);
    const refund = payments.find((p) => p.type === "refund")!;
    expect(refund.amountPaise).toBeGreaterThan(0);
    expect((await openDisputes()).find((d) => d.id === disputeId)!.status).toBe("resolved");

    const secondIssue = await raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "Separate issue." });
    await expect(resolveDispute(secondIssue, "refund", "Second refund")).rejects.toThrow(/already refunded/i);
    expect((await paymentsForMember(job.memberId)).filter((p) => p.type === "refund")).toHaveLength(1);
    expect((await openDisputes()).find((d) => d.id === secondIssue)!.status).toBe("open");
  });

  it("turns an approved revisit into a separate no-charge visit with its own confirmation codes", async () => {
    const { dealId, job, userId } = await completedJob();
    const disputeId = await raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "Still seeing ants." });
    const originalJob = await one("SELECT * FROM job WHERE id = ?", job.id);
    const originalPayments = await paymentsForMember(job.memberId);
    const indiaDate = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" }).format(date);
    const today = indiaDate(new Date());
    const tomorrow = indiaDate(new Date(Date.now() + 86_400_000));
    const slot = "10:00–12:00";

    await resolveDispute(disputeId, "revisit", "Check the affected rooms.");
    expect((await listNotifications(userId)).some((n) => n.dealId === dealId && n.type === "revisit_requested")).toBe(true);
    const revisit = (await revisitsForResident(userId)).find((visit) => visit.disputeId === disputeId)!;
    expect(revisit).toMatchObject({ dealId, status: "awaiting_schedule", serviceDate: null });
    expect(revisit.startOtp).not.toBe(revisit.endOtp);
    expect([job.startOtp, job.endOtp]).not.toContain(revisit.startOtp);
    expect([job.startOtp, job.endOtp]).not.toContain(revisit.endOtp);
    expect(await revisitsForOps()).toContainEqual(revisit);
    expect(await revisitsForVendor("ven_greenshield")).toContainEqual(revisit);
    expect(await revisitsForVendor("ven_coolcare")).not.toContainEqual(revisit);
    expect(await revisitsForResident("usr_rahul")).not.toContainEqual(revisit);

    const sampleVendor = (await one<User>("SELECT * FROM user WHERE id = 'usr_vendor_cool'"))!;
    const assignedVendor = { user: { ...sampleVendor, vendorId: "ven_greenshield" }, residency: null };
    const otherVendor = { user: sampleVendor, residency: null };
    for (const kind of ["job.schedule_revisit", "job.start", "job.complete"] as const) {
      expect(await can(assignedVendor, { kind, jobId: revisit.id })).toBe(true);
      expect(await can(otherVendor, { kind, jobId: revisit.id })).toBe(false);
    }
    const otherIssue = await raiseDispute({ jobId: job.id, userId, reason: "Late", detail: "A second issue." });
    await expect(resolveDispute(otherIssue, "revisit", "")).rejects.toThrow(/already pending or underway/i);
    await expect(completeJob(revisit.id, revisit.endOtp)).rejects.toThrow(DealError);
    await expect(scheduleRevisit(revisit.id, "2035-02-31", slot)).rejects.toThrow(DealError);
    await expect(scheduleRevisit(revisit.id, today, "09:15")).rejects.toThrow(DealError);
    await scheduleRevisit(revisit.id, tomorrow, slot);
    await expect(startJob(revisit.id, revisit.startOtp)).rejects.toThrow(DealError);
    await scheduleRevisit(revisit.id, today, slot);
    expect((await revisitsForResident(userId)).find((visit) => visit.id === revisit.id)).toMatchObject({
      status: "scheduled", serviceDate: today, slot,
    });
    await expect(startJob(revisit.id, "0000")).rejects.toThrow(/start code/i);
    await startJob(revisit.id, revisit.startOtp);
    await expect(scheduleRevisit(revisit.id, tomorrow, slot)).rejects.toThrow(DealError);
    await expect(completeJob(revisit.id, "0000")).rejects.toThrow(DealError);
    await completeJob(revisit.id, revisit.endOtp);
    await expect(completeJob(revisit.id, revisit.endOtp)).rejects.toThrow(DealError);

    expect((await revisitsForResident(userId)).find((visit) => visit.id === revisit.id)?.status).toBe("completed");
    const visitEvents = (await listNotifications(userId)).filter((n) => n.dealId === dealId).map((n) => n.type);
    expect(visitEvents).toEqual(expect.arrayContaining(["revisit_scheduled", "revisit_started", "revisit_completed"]));
    expect(visitEvents.filter((type) => type === "revisit_completed")).toHaveLength(1);
    expect((await getDealView(dealId))?.status).toBe("in_progress");
    expect(await one("SELECT * FROM job WHERE id = ?", job.id)).toEqual(originalJob);
    expect(await paymentsForMember(job.memberId)).toEqual(originalPayments);
  });

  it("brings prior approved revisits into the scheduling queue once", async () => {
    const { job, userId } = await completedJob();
    const oldId = await raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "First legacy approval" });
    await run("UPDATE dispute SET status = 'resolved', resolution = 'revisit: First approval.', resolvedAt = ? WHERE id = ?", new Date(Date.now() - 1000).toISOString(), oldId);
    const disputeId = await raiseDispute({ jobId: job.id, userId, reason: "Work not done properly", detail: "Latest legacy approval" });
    await run("UPDATE dispute SET status = 'resolved', resolution = 'revisit: Check again.', resolvedAt = ? WHERE id = ?", new Date().toISOString(), disputeId);
    seedIfEmpty(getDb());
    seedIfEmpty(getDb());
    const visits = (await revisitsForResident(userId)).filter((visit) => visit.disputeId === disputeId);
    expect(visits).toHaveLength(1);
    expect(visits[0].status).toBe("awaiting_schedule");
    expect(visits[0].startOtp).not.toBe(visits[0].endOtp);
    expect((await revisitsForResident(userId)).some((visit) => visit.disputeId === oldId)).toBe(false);
  });
});

describe("notifications", () => {
  it("tells the neighbours already in when the price drops", async () => {
    const id = await newDeal({ target: 10 });
    await simulateJoins(id, 5); // the fifth join crosses the first slab
    const first = (await getDealView(id))!.members[0];
    const theirs = (await listNotifications(first.userId)).filter((n) => n.dealId === id);
    expect(theirs.some((n) => n.type === "price_drop")).toBe(true);
    expect(await unreadCount(first.userId)).toBeGreaterThan(0);
  });

  it("tells the society when a group is confirmed, and when one doesn't fill", async () => {
    const locked = await newDeal({ target: 10 });
    await simulateJoins(locked, 9);
    const member = (await getDealView(locked))!.members[0];
    await lockDeal(locked);
    expect((await listNotifications(member.userId)).some((n) => n.type === "locked")).toBe(true);

    const dead = await newDeal();
    await simulateJoins(dead, 1);
    const lonely = (await getDealView(dead))!.members[0];
    await run("UPDATE deal SET joinDeadline = ?, extendedAt = ? WHERE id = ?",
      new Date(Date.now() - 60_000).toISOString(), new Date().toISOString(), dead);
    await tickDeal(dead);
    expect((await listNotifications(lonely.userId)).some((n) => n.type === "expired")).toBe(true);
  });

  it("announces a new group to the rest of the society", async () => {
    const before = (await listNotifications("usr_kulkarni")).length;
    await newDeal();
    expect((await listNotifications("usr_kulkarni")).length).toBeGreaterThan(before);
  });
});
