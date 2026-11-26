import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Me } from "@/lib/session";

process.env.JODO_DB = ":memory:";

const { can } = await import("@/lib/authz");
const { getDb, one, run } = await import("@/lib/db");
const { createDeal, feed, leaveDeal, lockDeal, myBookings, societySavings, tick, tickDeal } = await import("@/lib/deals");

const AC = "deal_ac_sunday";
const GREEN = "soc_green_valley";

beforeEach(() => {
  vi.stubEnv("JODO_AUTH_MODE", "demo");
  getDb();
  vi.stubEnv("JODO_AUTH_MODE", "sms");
});

afterEach(() => {
  globalThis.__jodoDb?.close();
  globalThis.__jodoDb = undefined;
  vi.unstubAllEnvs();
});

describe("service bookings in live mode", () => {
  it("retains ops access for leads while withholding booking permissions", async () => {
    const ops = { user: (await one<Me["user"]>("SELECT * FROM user WHERE id = 'usr_ops'"))!, residency: null };
    await expect(can(ops, { kind: "console.ops" })).resolves.toBe(true);
    await expect(can(ops, { kind: "console.vendor" })).resolves.toBe(false);
    await expect(can(ops, { kind: "deal.lock", dealId: AC })).resolves.toBe(false);
    await expect(can(ops, { kind: "dispute.resolve" })).resolves.toBe(false);
  });

  it("keeps deadline checks and dashboards from processing demo bookings", async () => {
    await run("UPDATE deal SET joinDeadline = ? WHERE id = ?", "2020-01-01T00:00:00.000Z", AC);
    await expect(tick()).resolves.toBe(0);
    await tickDeal(AC);
    await expect(feed(GREEN)).resolves.toEqual({ live: [], pending: [], confirmed: [], past: [] });
    await expect(myBookings("usr_n1")).resolves.toEqual([]);
    await expect(societySavings(GREEN)).resolves.toBe(0);
    await expect(one("SELECT status FROM deal WHERE id = ?", AC)).resolves.toEqual({ status: "open" });
    await expect(one("SELECT id FROM payment WHERE dealId = ?", AC)).resolves.toBeNull();
  });

  it("rejects direct booking mutations before changing the simulated ledger", async () => {
    const member = (await one<{ userId: string }>("SELECT userId FROM deal_member WHERE dealId = ? LIMIT 1", AC))!;
    await expect(leaveDeal(AC, member.userId)).rejects.toThrow(/bookings are unavailable/i);
    await expect(lockDeal(AC)).rejects.toThrow(/bookings are unavailable/i);
    await expect(createDeal({
      societyId: GREEN, skuId: "sku_ac_service", vendorId: "ven_coolcare", createdBy: "usr_rahul",
      serviceDate: new Date(Date.now() + 7 * 86_400_000).toISOString(), targetFlats: 20, deadlineHours: 72,
    })).rejects.toThrow(/bookings are unavailable/i);
    await expect(one("SELECT status FROM deal_member WHERE dealId = ? AND userId = ?", AC, member.userId))
      .resolves.toEqual({ status: "joined" });
    await expect(one("SELECT id FROM payment WHERE dealId = ?", AC)).resolves.toBeNull();
  });
});
