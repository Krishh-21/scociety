import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Point the engine at a throwaway database before any of it loads.
const dbFile = path.join(os.tmpdir(), `jodo-test-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { all, getDb, one, run } = await import("@/lib/db");
const {
  DealError, createDeal, expireDeal, getDealView, joinDeal, leaveDeal, lockDeal,
  tickDeal, updateSlabs,
} = await import("@/lib/deals");

const AC = "deal_ac_sunday"; // 12 neighbours seeded, ladder counts AC units
const GREEN = "soc_green_valley";

function freeResidents(dealId: string) {
  return all<{ id: string; flat: string }>(
    `SELECT u.id, r.flat FROM user u
     JOIN residency r ON r.userId = u.id AND r.societyId = ?
     WHERE u.id NOT IN (SELECT userId FROM deal_member WHERE dealId = ? AND status <> 'left')
     ORDER BY r.flat`,
    GREEN, dealId,
  );
}

/** Joins real residents one at a time into whichever slot still has room. */
async function fill(dealId: string, upTo: number, units = 1) {
  for (const r of await freeResidents(dealId)) {
    const view = (await getDealView(dealId))!;
    if (view.basisCount >= upTo) break;
    const roomiest = [...view.slotLoad].sort((a, b) => b.capacity - b.used - (a.capacity - a.used))[0];
    const take = Math.min(units, roomiest.capacity - roomiest.used);
    if (take < 1) break;
    await joinDeal({
      dealId, userId: r.id, flat: r.flat, units: take,
      slot: roomiest.slot, paymentMethod: "upi", societyId: view.societyId,
    });
  }
  return (await getDealView(dealId))!;
}

async function roomySlot(dealId: string, units = 1) {
  return (await getDealView(dealId))!.slotLoad.find((s) => s.capacity - s.used >= units)!.slot;
}

async function resetDeal(dealId: string) {
  // Restore the published ladder too — one test edits it.
  const sku = (await one<{ defaultSlabs: string }>(
    "SELECT s.defaultSlabs FROM deal d JOIN sku s ON s.id = d.skuId WHERE d.id = ?", dealId,
  ))!;
  await run("UPDATE deal SET slabs = ? WHERE id = ?", sku.defaultSlabs, dealId);
  await run("DELETE FROM job WHERE dealId = ?", dealId);
  await run("UPDATE deal SET status='open', lockedAt=NULL, floorPricePaise=NULL WHERE id = ?", dealId);
  await run("UPDATE deal_member SET status='joined', finalPricePaise=NULL WHERE dealId = ?", dealId);
}

beforeEach(async () => {
  getDb();
  await resetDeal(AC);
  await run(
    "UPDATE deal SET joinDeadline = ? WHERE id = ?",
    new Date(Date.now() + 2 * 86_400_000).toISOString(), AC,
  );
  await run("DELETE FROM deal_member WHERE dealId = ? AND userId IN ('usr_rahul','usr_kulkarni')", AC);
});

afterAll(() => {
  try {
    fs.rmSync(dbFile, { force: true });
    fs.rmSync(`${dbFile}-wal`, { force: true });
    fs.rmSync(`${dbFile}-shm`, { force: true });
  } catch {
    /* the OS can have it */
  }
});

describe("the seeded deal", () => {
  it("starts where the reel does: 12 units, ₹749, ₹645 at 20", async () => {
    const view = (await getDealView(AC))!;
    expect(view.basis).toBe("units");
    expect(view.basisCount).toBe(12);
    expect(view.currentPricePaise).toBe(74900);
    expect(view.nextSlab).toMatchObject({ away: 8, pricePaise: 64500 });
  });
});

describe("invariant 1 — everyone pays the final price", () => {
  it("charges the first joiner the same as the last", async () => {
    const first = (await getDealView(AC))!.members[0];
    const priceWhenFirstJoined = 99900;
    const view = await fill(AC, 20);
    expect(view.currentPricePaise).toBe(64500);

    const locked = await lockDeal(AC);
    const prices = new Set(locked.members.map((m) => m.finalPricePaise));
    expect(prices.size).toBe(1);
    expect([...prices][0]).toBe(64500);

    const firstAfter = locked.members.find((m) => m.id === first.id)!;
    expect(firstAfter.finalPricePaise).toBe(64500);
    expect(firstAfter.finalPricePaise).toBeLessThan(priceWhenFirstJoined);
  });

  it("creates exactly one job per member when it locks", async () => {
    await fill(AC, 20);
    const locked = await lockDeal(AC);
    const jobs = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM job WHERE dealId = ?", AC))!;
    expect(jobs.n).toBe(locked.members.length);
  });
});

describe("invariant 2 — the price can only fall", () => {
  it("holds the price when a neighbour leaves", async () => {
    const filled = await fill(AC, 20);
    expect(filled.currentPricePaise).toBe(64500);

    const leaver = filled.members.at(-1)!;
    const after = await leaveDeal(AC, leaver.userId);

    expect(after.basisCount).toBe(19);
    expect(after.slabPricePaise).toBe(74900); // the slab table alone would go back up
    expect(after.currentPricePaise).toBe(64500); // …but nobody pays more
    expect(after.priceHeld).toBe(true);
  });

  it("still lets the price fall further after a hold", async () => {
    await fill(AC, 20);
    const leaver = (await getDealView(AC))!.members.at(-1)!;
    await leaveDeal(AC, leaver.userId);
    const after = await fill(AC, 35, 4); // a few flats with several ACs each
    expect(after.currentPricePaise).toBe(59900);
    expect(after.priceHeld).toBe(false);
  });

  it("refuses a ladder edit that charges a joined group more", async () => {
    const view = (await getDealView(AC))!;
    const dearer = view.slabs.map((s) => (s.minFlats === 20 ? { ...s, pricePaise: 74000 } : s));
    await expect(updateSlabs(AC, dearer)).rejects.toThrow(DealError);
    expect((await getDealView(AC))!.slabs).toEqual(view.slabs);
  });

  it("accepts a ladder edit that is cheaper everywhere", async () => {
    const view = (await getDealView(AC))!;
    const cheaper = view.slabs.map((s) => (s.minFlats === 20 ? { ...s, pricePaise: 60000 } : s));
    const updated = await updateSlabs(AC, cheaper);
    expect(updated.slabs.find((s) => s.minFlats === 20)!.pricePaise).toBe(60000);
  });
});

describe("invariant 3 — a group that misses its minimum charges nobody", () => {
  it("expires without a single final price", async () => {
    const id = await createDeal({
      societyId: GREEN, skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: "usr_rahul",
      serviceDate: new Date(Date.now() + 5 * 86_400_000).toISOString(), targetFlats: 10, deadlineHours: 48,
    });
    const view = (await getDealView(id))!;
    await joinDeal({
      dealId: id, userId: "usr_rahul", flat: "A-402", units: 1,
      slot: view.slotWindows[0], paymentMethod: "upi", societyId: GREEN,
    });

    const expired = await expireDeal(id);
    expect(expired.status).toBe("expired");
    expect(expired.members.every((m) => m.finalPricePaise === null)).toBe(true);
    expect((await one<{ n: number }>("SELECT COUNT(*) AS n FROM job WHERE dealId = ?", id))!.n).toBe(0);
  });

  it("refuses to lock below the minimum", async () => {
    const id = await createDeal({
      societyId: GREEN, skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: "usr_rahul",
      serviceDate: new Date(Date.now() + 5 * 86_400_000).toISOString(), targetFlats: 10, deadlineHours: 48,
    });
    await expect(lockDeal(id)).rejects.toThrow(DealError);
  });

  it("closes a deal whose deadline has passed when the page asks for it", async () => {
    const id = await createDeal({
      societyId: GREEN, skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: "usr_rahul",
      serviceDate: new Date(Date.now() + 5 * 86_400_000).toISOString(), targetFlats: 10, deadlineHours: 48,
    });
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), id);

    expect((await getDealView(id))!.status).toBe("open");
    await tickDeal(id);
    expect((await getDealView(id))!.status).toBe("expired");
  });

  it("locks instead of expiring when the minimum was met", async () => {
    await fill(AC, 20);
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), AC);
    await tickDeal(AC);
    const view = (await getDealView(AC))!;
    expect(view.status).toBe("locked");
    expect(view.members.every((m) => m.finalPricePaise === 64500)).toBe(true);
  });
});

describe("joining rules", () => {
  it("keeps a group private to its own society", async () => {
    await expect(joinDeal({
      dealId: AC, userId: "usr_rahul", flat: "A-402", units: 1,
      slot: "10:00–12:00", paymentMethod: "upi", societyId: "soc_palm_grove",
    })).rejects.toThrow(/private/);
  });

  it("refuses a join after the deadline", async () => {
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", new Date(Date.now() - 60_000).toISOString(), AC);
    await expect(joinDeal({
      dealId: AC, userId: "usr_rahul", flat: "A-402", units: 1,
      slot: "10:00–12:00", paymentMethod: "upi", societyId: GREEN,
    })).rejects.toThrow(/closed/i);
  });

  it("refuses a second join from the same flat", async () => {
    const args = {
      dealId: AC, userId: "usr_rahul", flat: "A-402", units: 1,
      slot: "10:00–12:00" as const, paymentMethod: "upi" as const, societyId: GREEN,
    };
    await joinDeal(args);
    await expect(joinDeal(args)).rejects.toThrow(/already joined/i);
  });

  it("refuses an invalid slot", async () => {
    await expect(joinDeal({
      dealId: AC, userId: "usr_rahul", flat: "A-402", units: 1,
      slot: "03:00–04:00", paymentMethod: "upi", societyId: GREEN,
    })).rejects.toThrow(/valid slot/i);
  });

  it("refuses leaving once the group has locked", async () => {
    await fill(AC, 20);
    const locked = await lockDeal(AC);
    await expect(leaveDeal(AC, locked.members[0].userId)).rejects.toThrow(/before it locks/i);
  });
});

describe("ladder basis", () => {
  it("counts units, not flats, where the vendor's trip is per unit", async () => {
    const before = (await getDealView(AC))!;
    const r = (await freeResidents(AC))[0];
    await joinDeal({
      dealId: AC, userId: r.id, flat: r.flat, units: 3,
      slot: await roomySlot(AC, 3), paymentMethod: "upi", societyId: GREEN,
    });
    const after = (await getDealView(AC))!;
    expect(after.flatsJoined).toBe(before.flatsJoined + 1);
    expect(after.basisCount).toBe(before.basisCount + 3);
  });

  it("counts flats for a per-flat service", async () => {
    const view = (await getDealView("deal_deepclean"))!;
    expect(view.basis).toBe("flats");
    expect(view.basisCount).toBe(view.flatsJoined);
  });
});
