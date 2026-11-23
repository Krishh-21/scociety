import { describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";
import type { User } from "@/lib/types";

process.env.JODO_DB = ":memory:";
const { one } = await import("@/lib/db");
const { createComplaint, listComplaints, updateComplaint, complaintSummary } = await import("@/lib/society-complaints");
const { listSocietyGuards, registerGuard, requireSocietyGuard, setGuardActive, SocietyAccessError } = await import("@/lib/society-access");

function actor(id: string): Me {
  return {
    user: one<User>("SELECT * FROM user WHERE id = ?", id)!,
    residency: one<NonNullable<Me["residency"]>>(
      "SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId WHERE r.userId = ?", id,
    ),
  };
}

describe("society complaints", () => {
  it("keeps a resident ticket private and tracks assignment through resolution", () => {
    const resident = actor("usr_rahul");
    const committee = actor("usr_kulkarni");
    const neighbour = actor("usr_n1");
    const id = createComplaint(resident, "Lift", "Lift stuck", "Tower A lift stops at floor 2.");
    expect(listComplaints(resident).find((ticket) => ticket.id === id)?.status).toBe("open");
    expect(complaintSummary(resident.residency!.societyId).openComplaints).toBe(1);
    expect(listComplaints(neighbour)).toHaveLength(0);
    expect(listComplaints(committee).some((ticket) => ticket.id === id)).toBe(true);
    expect(() => updateComplaint(resident, id, "assigned", "Maintenance team", "")).toThrow(SocietyAccessError);
    expect(() => updateComplaint(committee, id, "resolved", "", "")).toThrow(/assign/i);
    updateComplaint(committee, id, "assigned", "Maintenance team", "");
    updateComplaint(committee, id, "in_progress", "", "Technician is on site.");
    updateComplaint(committee, id, "resolved", "", "Lift returned to service.");
    const resolved = listComplaints(resident).find((ticket) => ticket.id === id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.history.map((event) => event.status)).toEqual(["open", "assigned", "in_progress", "resolved"]);
    expect(complaintSummary(resident.residency!.societyId).openComplaints).toBe(0);
    expect(() => updateComplaint(committee, id, "resolved", "", "Retry")).toThrow(/already resolved/i);
  });

  it("prevents cross-society committee access and separates the guard role", () => {
    const resident = actor("usr_rahul");
    const committee = actor("usr_kulkarni");
    const otherCommittee: Me = { ...committee, residency: { ...committee.residency!, societyId: "soc_palm_grove" } };
    const id = createComplaint(resident, "Water", "Low pressure", "No water on the top floor.");
    expect(listComplaints(otherCommittee)).toHaveLength(0);
    expect(() => updateComplaint(otherCommittee, id, "assigned", "Staff", "")).toThrow(/not found/i);
    expect(requireSocietyGuard(actor("usr_guard_green")).societyId).toBe("soc_green_valley");
    expect(() => requireSocietyGuard(resident)).toThrow(SocietyAccessError);
    expect(() => listComplaints(actor("usr_guard_green"))).toThrow(SocietyAccessError);
  });

  it("lets a committee assign and revoke guard access without taking over resident accounts", () => {
    const committee = actor("usr_kulkarni");
    const resident = actor("usr_rahul");
    expect(() => registerGuard(resident, "9876543210", "Morning Shift")).toThrow(SocietyAccessError);
    expect(() => registerGuard(committee, resident.user.phone, "Morning Shift")).toThrow(/already in use/i);
    const id = registerGuard(committee, "9876543210", "Morning Shift");
    expect(listSocietyGuards(committee).some((guard) => guard.userId === id && guard.isActive === 1)).toBe(true);
    const guard = actor(id);
    expect(requireSocietyGuard(guard).societyId).toBe("soc_green_valley");
    const otherCommittee = { ...committee, residency: { ...committee.residency!, societyId: "soc_palm_grove" } };
    expect(() => setGuardActive(otherCommittee, id, false)).toThrow(/not found/i);
    setGuardActive(committee, id, false);
    expect(() => requireSocietyGuard(guard)).toThrow(SocietyAccessError);
    setGuardActive(committee, id, true);
    expect(requireSocietyGuard(guard).societyId).toBe("soc_green_valley");
  });
});
