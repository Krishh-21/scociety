import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = path.join(os.tmpdir(), `jodo-app-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { all, getDb, one, resetAllData, run } = await import("@/lib/db");
const { DealError, createDeal, feed, getDealView, vendorsForSku } = await import("@/lib/deals");
const { ResidencyError, claimResidency, findOrCreateUser, isValidPhone, normaliseFlat } = await import("@/lib/session");
const { LeadError, createLead, listLeads, publicStats } = await import("@/lib/leads");

const GREEN = "soc_green_valley";
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

beforeAll(() => {
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

describe("sign-in", () => {
  it("accepts only real Indian mobile numbers", () => {
    expect(isValidPhone("9000000001")).toBe(true);
    expect(isValidPhone("6123456789")).toBe(true);
    expect(isValidPhone("")).toBe(false); // used to sign in as a user with no phone
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("5123456789")).toBe(false);
    expect(isValidPhone("90000000011")).toBe(false);
  });
});

describe("claiming a flat", () => {
  it("normalises the ways people type a flat number", () => {
    expect(normaliseFlat("a402")).toBe("A-402");
    expect(normaliseFlat(" A 402 ")).toBe("A-402");
    expect(normaliseFlat("b/1204")).toBe("B-1204");
    expect(normaliseFlat("AB-101")).toBe("AB-101");
    expect(normaliseFlat("402")).toBeNull();
    expect(normaliseFlat("tower A")).toBeNull();
  });

  it("refuses a flat a verified neighbour already holds", () => {
    const u = findOrCreateUser("9876500001");
    expect(() =>
      claimResidency({ userId: u.id, name: "Someone Else", societyId: GREEN, flat: "a-402", type: "owner" }),
    ).toThrow(/already verified/);
  });

  it("refuses a society that doesn't exist", () => {
    const u = findOrCreateUser("9876500002");
    expect(() =>
      claimResidency({ userId: u.id, name: "Asha Rao", societyId: "soc_nowhere", flat: "C-909", type: "owner" }),
    ).toThrow(ResidencyError);
  });

  it("puts a new neighbour in a free flat, verified, with a tidy flat number", () => {
    const u = findOrCreateUser("9876500003");
    const res = claimResidency({ userId: u.id, name: "  Asha   Rao ", societyId: GREEN, flat: "c909", type: "tenant" });
    expect(res.flat).toBe("C-909");
    const row = one<{ flat: string; status: string; type: string }>(
      "SELECT flat, status, type FROM residency WHERE userId = ?", u.id,
    )!;
    expect(row).toMatchObject({ flat: "C-909", status: "verified", type: "tenant" });
    expect(one<{ name: string }>("SELECT name FROM user WHERE id = ?", u.id)!.name).toBe("Asha Rao");
  });

  it("lets the same person re-claim their own flat", () => {
    const u = findOrCreateUser("9876500003");
    const original = one<{ id: string }>("SELECT id FROM residency WHERE userId = ?", u.id);
    expect(() =>
      claimResidency({ userId: u.id, name: "Asha Rao", societyId: GREEN, flat: "C-909", type: "owner" }),
    ).not.toThrow();
    expect(one("SELECT id FROM residency WHERE userId = ?", u.id)).toEqual(original);
  });

  it("prevents a verified secretary from transferring committee access through onboarding", () => {
    expect(() => claimResidency({
      userId: "usr_kulkarni", name: "Amit Kulkarni", societyId: "soc_palm_grove", flat: "Z-902", type: "owner",
    })).toThrow(/already verified/i);
    expect(one("SELECT societyId FROM residency WHERE userId = 'usr_kulkarni'")).toEqual({ societyId: GREEN });
  });
});

describe("vendors per service", () => {
  it("only offers vendors who do the service", () => {
    const ac = vendorsForSku("sku_ac_service").map((v) => v.id);
    expect(ac).toContain("ven_coolcare");
    expect(ac).toContain("ven_frostline");
    expect(ac).not.toContain("ven_greenshield");
    expect(vendorsForSku("sku_car_wash").map((v) => v.id)).toEqual(["ven_shinewash"]);
  });

  it("refuses to give a car-wash group to the AC vendor", () => {
    expect(() =>
      createDeal({
        societyId: GREEN, skuId: "sku_car_wash", vendorId: "ven_coolcare", createdBy: "usr_rahul",
        serviceDate: inDays(6), targetFlats: 20, deadlineHours: 48,
      }),
    ).toThrow(/doesn't offer/);
  });

  it("accepts the right vendor", () => {
    const id = createDeal({
      societyId: GREEN, skuId: "sku_ac_service", vendorId: "ven_frostline", createdBy: "usr_rahul",
      serviceDate: inDays(6), targetFlats: 20, deadlineHours: 48,
    });
    expect(getDealView(id)!.vendor.id).toBe("ven_frostline");
  });

  it("refuses an unknown vendor", () => {
    expect(() =>
      createDeal({
        societyId: GREEN, skuId: "sku_ac_service", vendorId: "ven_nobody", createdBy: "usr_rahul",
        serviceDate: inDays(6), targetFlats: 20, deadlineHours: 48,
      }),
    ).toThrow(DealError);
  });
});

describe("the feed never shows a closed group as open", () => {
  it("closes a group past its deadline before rendering it", () => {
    const id = createDeal({
      societyId: GREEN, skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: "usr_rahul",
      serviceDate: inDays(6), targetFlats: 10, deadlineHours: 48,
    });
    run("UPDATE deal SET joinDeadline = ? WHERE id = ?", inDays(-1), id);

    const { live, past } = feed(GREEN);
    expect(live.some((d) => d.id === id)).toBe(false);
    expect(past.find((d) => d.id === id)?.status).toBe("expired");
  });
});

describe("website sign-ups", () => {
  it("records a society request", () => {
    const res = createLead({
      kind: "society", name: "Meera Iyer", phone: "98765 43210", org: "Palm Grove Residency", city: "Pune",
      detail: { role: "secretary", flats: 164 },
    });
    expect(res.duplicate).toBe(false);
    const lead = listLeads().find((l) => l.id === res.id)!;
    expect(lead).toMatchObject({ kind: "society", phone: "9876543210", org: "Palm Grove Residency", status: "new" });
    expect(lead.detail).toMatchObject({ role: "secretary", flats: 164 });
  });

  it("doesn't create a second lead for the same phone the same day", () => {
    const again = createLead({ kind: "society", name: "Meera Iyer", phone: "9876543210", org: "Palm Grove", city: "Pune" });
    expect(again.duplicate).toBe(true);
    expect(listLeads().filter((l) => l.phone === "9876543210" && l.kind === "society")).toHaveLength(1);
  });

  it("validates what it stores", () => {
    expect(() => createLead({ kind: "vendor", name: "R", phone: "9876543211", org: "Crew", city: "Pune" })).toThrow(LeadError);
    expect(() => createLead({ kind: "vendor", name: "Ravi", phone: "123", org: "Crew", city: "Pune" })).toThrow(/10-digit/);
    expect(() => createLead({ kind: "vendor", name: "Ravi", phone: "9876543211", org: "", city: "Pune" })).toThrow(/business/);
  });

  it("publishes only numbers that come from the database", () => {
    const s = publicStats();
    expect(s.societies).toBe(one<{ n: number }>("SELECT COUNT(*) AS n FROM society")!.n);
    expect(s.confirmed).toBeGreaterThan(0);
    expect(s.savedPaise).toBeGreaterThan(0);
  });
});

describe("demo reset", () => {
  it("puts the seed back and keeps website leads", () => {
    const leadsBefore = listLeads().length;
    run("DELETE FROM deal WHERE id = 'deal_ac_sunday'");
    resetAllData();
    expect(getDealView("deal_ac_sunday")!.status).toBe("open");
    expect(all("SELECT id FROM deal")).toHaveLength(5);
    expect(listLeads().length).toBe(leadsBefore);
  });
});
