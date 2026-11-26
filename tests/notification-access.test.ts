import { beforeAll, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";

process.env.JODO_DB = ":memory:";
process.env.JODO_AUTH_MODE = "sms";

const { one, run } = await import("@/lib/db");
const { listNotifications, markAllRead, notify, unreadCount } = await import("@/lib/notify");
const { claimResidency } = await import("@/lib/session");
const { reviewMembershipRequest, revokeMembership } = await import("@/lib/society-membership");
const { publishSocietyNotice } = await import("@/lib/society-community");

const societyId = "notice-test";
const residentId = "resident";
const committee: Me = {
  user: { id: "secretary", name: "Committee", phone: "9876500430", role: "secretary", vendorId: null, lang: "en" },
  residency: { id: "committee-flat", userId: "secretary", societyId, flat: "A-101", type: "owner", status: "verified", societyName: "Notice Test" },
};

beforeAll(async () => {
  await run("INSERT INTO society (id,name,locality,city,flatCount) VALUES (?,?, 'Test', 'Pune', 50)", societyId, "Notice Test");
  await run("INSERT INTO user (id,name,phone,role) VALUES ('secretary','Committee','9876500430','secretary'), ('resident','Resident','9876500431','resident')");
  await run(
    "INSERT INTO residency (id,userId,societyId,flat,status,createdAt) VALUES ('committee-flat','secretary',?,'A-101','verified','2026-01-01'), ('original-flat','resident',?,'A-102','verified','2026-01-01')",
    societyId, societyId,
  );
});

describe("resident inbox access", () => {
  it("shows notices for the current residency and keeps prior notices private after move-out and rejoining", async () => {
    await publishSocietyNotice(committee, { title: "Original notice", body: "Details for the original tenancy.", pinned: false });
    expect((await listNotifications(residentId)).map((row) => row.title)).toEqual(["Original notice"]);
    expect(await unreadCount(residentId)).toBe(1);

    await revokeMembership(committee, "original-flat");
    expect(await listNotifications(residentId)).toEqual([]);
    expect(await unreadCount(residentId)).toBe(0);
    await notify([residentId], { societyId, type: "society_notice", title: "Between memberships", body: "Private details" });
    expect(await one("SELECT id FROM notification WHERE title = ?", "Between memberships")).toBeNull();

    const claim = await claimResidency({ userId: residentId, name: "Resident", societyId, flat: "A-103", type: "tenant" });
    await reviewMembershipRequest(committee, claim.id, "approve");
    // Old live records without verified provenance must not become visible on a new tenancy.
    await run("INSERT INTO notification (id,userId,type,title,body,createdAt) VALUES ('legacy',?,'society_notice','Unscoped notice','Private details','2026-01-01')", residentId);
    await publishSocietyNotice(committee, { title: "Current notice", body: "Details for the current tenancy.", pinned: false });

    expect((await listNotifications(residentId)).map((row) => row.title)).toEqual(["Current notice"]);
    expect(await unreadCount(residentId)).toBe(1);
    await markAllRead(residentId);
    expect(await unreadCount(residentId)).toBe(0);
    expect(await one("SELECT readAt FROM notification WHERE title = ?", "Original notice")).toEqual({ readAt: null });
  });
});
