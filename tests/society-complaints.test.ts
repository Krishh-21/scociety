import { describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";
import type { User } from "@/lib/types";

process.env.JODO_DB = ":memory:";
const { one } = await import("@/lib/db");
const { createComplaint, listComplaints, updateComplaint, complaintSummary } = await import("@/lib/society-complaints");
const { listSocietyGuards, registerGuard, requireSocietyGuard, setGuardActive, SocietyAccessError } = await import("@/lib/society-access");

async function actor(id: string): Promise<Me> {
  return {
    user: (await one<User>("SELECT * FROM user WHERE id = ?", id))!,
    residency: (await one<NonNullable<Me["residency"]>>(
      "SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId WHERE r.userId = ?", id,
    )),
  };
}

describe("society complaints", () => {
  it("keeps a resident ticket private and tracks assignment through resolution", async () => {
    const resident = (await actor("usr_rahul"));
    const committee = (await actor("usr_kulkarni"));
    const neighbour = (await actor("usr_n1"));
    const id = (await createComplaint(resident, "Lift", "Lift stuck", "Tower A lift stops at floor 2."));
    expect((await listComplaints(resident)).find((ticket) => ticket.id === id)?.status).toBe("open");
    expect((await complaintSummary(resident.residency!.societyId)).openComplaints).toBe(1);
    expect((await listComplaints(neighbour))).toHaveLength(0);
    expect((await listComplaints(committee)).some((ticket) => ticket.id === id)).toBe(true);
    await expect((async () => (await updateComplaint(resident, id, "assigned", "Maintenance team", "")))()).rejects.toThrow(SocietyAccessError);
    await expect((async () => (await updateComplaint(committee, id, "resolved", "", "")))()).rejects.toThrow(/assign/i);
    (await updateComplaint(committee, id, "assigned", "Maintenance team", ""));
    (await updateComplaint(committee, id, "in_progress", "", "Technician is on site."));
    (await updateComplaint(committee, id, "resolved", "", "Lift returned to service."));
    const resolved = (await listComplaints(resident)).find((ticket) => ticket.id === id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.history.map((event) => event.status)).toEqual(["open", "assigned", "in_progress", "resolved"]);
    expect((await complaintSummary(resident.residency!.societyId)).openComplaints).toBe(0);
    await expect((async () => (await updateComplaint(committee, id, "resolved", "", "Retry")))()).rejects.toThrow(/already resolved/i);
  });

  it("prevents cross-society committee access and separates the guard role", async () => {
    const resident = (await actor("usr_rahul"));
    const committee = (await actor("usr_kulkarni"));
    const otherCommittee: Me = { ...committee, residency: { ...committee.residency!, societyId: "soc_palm_grove" } };
    const id = (await createComplaint(resident, "Water", "Low pressure", "No water on the top floor."));
    expect((await listComplaints(otherCommittee))).toHaveLength(0);
    await expect((async () => (await updateComplaint(otherCommittee, id, "assigned", "Staff", "")))()).rejects.toThrow(/not found/i);
    expect((await requireSocietyGuard((await actor("usr_guard_green")))).societyId).toBe("soc_green_valley");
    await expect((async () => (await requireSocietyGuard(resident)))()).rejects.toThrow(SocietyAccessError);
    await expect((async () => (await listComplaints((await actor("usr_guard_green")))))()).rejects.toThrow(SocietyAccessError);
  });

  it("lets a committee assign and revoke guard access without taking over resident accounts", async () => {
    const committee = (await actor("usr_kulkarni"));
    const resident = (await actor("usr_rahul"));
    await expect((async () => (await registerGuard(resident, "9876543210", "Morning Shift")))()).rejects.toThrow(SocietyAccessError);
    await expect((async () => (await registerGuard(committee, resident.user.phone, "Morning Shift")))()).rejects.toThrow(/already in use/i);
    const id = (await registerGuard(committee, "9876543210", "Morning Shift"));
    expect((await listSocietyGuards(committee)).some((guard) => guard.userId === id && guard.isActive === 1)).toBe(true);
    const guard = (await actor(id));
    expect((await requireSocietyGuard(guard)).societyId).toBe("soc_green_valley");
    const otherCommittee = { ...committee, residency: { ...committee.residency!, societyId: "soc_palm_grove" } };
    await expect((async () => (await setGuardActive(otherCommittee, id, false)))()).rejects.toThrow(/not found/i);
    (await setGuardActive(committee, id, false));
    await expect((async () => (await requireSocietyGuard(guard)))()).rejects.toThrow(SocietyAccessError);
    (await setGuardActive(committee, id, true));
    expect((await requireSocietyGuard(guard)).societyId).toBe("soc_green_valley");
  });
});
