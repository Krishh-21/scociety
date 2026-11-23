import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";

process.env.JODO_DB = ":memory:";

const { getDb, one, run } = await import("@/lib/db");
const community = await import("@/lib/society-community");
const { listNotifications } = await import("@/lib/notify");

const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";

function member(userId: string): Me {
  return {
    user: one<Me["user"]>("SELECT * FROM user WHERE id = ?", userId)!,
    residency: one<NonNullable<Me["residency"]>>(
      `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
       WHERE r.userId = ?`,
      userId,
    ),
  };
}

beforeEach(() => {
  getDb();
  run("UPDATE residency SET societyId = ? WHERE userId = 'usr_n1'", PALM);
});

afterEach(() => {
  getDb().close();
  globalThis.__jodoDb = undefined;
});

describe("society notices", () => {
  it("announces a notice to other verified residents in the author's society", () => {
    run("UPDATE residency SET status = 'pending' WHERE userId = 'usr_n2'");
    community.publishSocietyNotice(member("usr_kulkarni"), {
      title: "North lift maintenance", body: "The north lift will reopen this afternoon.", pinned: false,
    });

    expect(listNotifications("usr_rahul")).toContainEqual(expect.objectContaining({
      type: "society_notice", title: "North lift maintenance", dealId: null,
    }));
    for (const userId of ["usr_kulkarni", "usr_n1", "usr_n2"]) {
      expect(listNotifications(userId).some((notification) => notification.title === "North lift maintenance")).toBe(false);
    }
  });

  it("pins a single notice and hides booking links that stop accepting residents", () => {
    const secretary = member("usr_kulkarni");
    const first = community.publishSocietyNotice(secretary, {
      title: "Lift maintenance", body: "The north lift is closed.", pinned: true,
    });
    const second = community.publishSocietyNotice(secretary, {
      title: "AC service", body: "Join the Sunday group.", pinned: true, dealId: "deal_ac_sunday",
    });

    expect(community.getPinnedNotice(GREEN)).toMatchObject({ id: second, dealId: "deal_ac_sunday" });
    expect(community.getPinnedNotice(PALM)?.id).not.toBe(second);
    expect(community.listSocietyNotices(GREEN).filter((notice) => notice.id === first || notice.id === second)).toMatchObject([
      { id: second, pinned: 1, authorName: "Amit Kulkarni" }, { id: first, pinned: 0 },
    ]);

    run("UPDATE deal SET status = 'locked' WHERE id = 'deal_ac_sunday'");
    expect(community.getPinnedNotice(GREEN)).toMatchObject({ id: second, dealId: null });
    community.setSocietyNoticePinned(secretary, first, true);
    expect(community.getPinnedNotice(GREEN)?.id).toBe(first);
  });

  it("requires committee access and rejects a booking from another society", () => {
    const details = { title: "AC service", body: "Sunday.", pinned: false, dealId: "deal_ac_sunday" };
    expect(() => community.publishSocietyNotice(member("usr_rahul"), details)).toThrow(/committee/i);

    run("UPDATE residency SET societyId = ? WHERE userId = 'usr_kulkarni'", PALM);
    const before = community.listSocietyNotices(PALM);
    expect(() => community.publishSocietyNotice(member("usr_kulkarni"), details)).toThrow(/open group/i);
    expect(community.listSocietyNotices(PALM)).toEqual(before);
  });
});

describe("society meetings", () => {
  it("lets verified residents update one RSVP and the committee publish minutes after the start", () => {
    const secretary = member("usr_kulkarni");
    const resident = member("usr_rahul");
    const meeting = community.scheduleSocietyMeeting(secretary, {
      title: "Rooftop committee meeting", agenda: "Discuss the rooftop repairs.", startsAt: "2090-01-03T10:30",
    });
    expect(listNotifications(resident.user.id)).toContainEqual(expect.objectContaining({
      type: "society_meeting", title: "Rooftop committee meeting",
    }));
    expect(community.getSocietyMeeting(GREEN, meeting)).toMatchObject({ startsAt: "2090-01-03T05:00:00.000Z" });
    expect(community.getSocietyMeeting(PALM, meeting)).toBeNull();
    expect(() => community.rsvpToSocietyMeeting(member("usr_n1"), meeting, "going")).toThrow(/meeting/i);
    expect(() => community.rsvpToSocietyMeeting({ ...resident, residency: { ...resident.residency!, status: "pending" } }, meeting, "going")).toThrow();
    community.rsvpToSocietyMeeting(resident, meeting, "going");
    community.rsvpToSocietyMeeting(resident, meeting, "not_going");
    expect(community.listSocietyMeetings(GREEN, resident.user.id).find((result) => result.id === meeting)).toMatchObject({
      attending: 0, myResponse: "not_going",
    });
    expect(() => community.publishSocietyMinutes(secretary, meeting, "Repairs approved.")).toThrow(/started/);
    expect(() => community.recordSocietyAttendance(secretary, meeting, "4")).toThrow(/started/);

    run("UPDATE society_meeting SET startsAt = ? WHERE id = ?", "2000-01-03T05:00:00.000Z", meeting);
    expect(() => community.rsvpToSocietyMeeting(resident, meeting, "going")).toThrow(/RSVP/);
    expect(() => community.recordSocietyAttendance(secretary, meeting, "4.5")).toThrow(/whole number/);
    community.recordSocietyAttendance(secretary, meeting, "4");
    community.publishSocietyMinutes(secretary, meeting, "Repairs approved.");
    expect(community.getSocietyMeeting(GREEN, meeting)).toMatchObject({ minutes: "Repairs approved.", actualAttendance: 4 });
  });
});

describe("society polls", () => {
  it("accepts one vote per resident and keeps the ballot scoped to its own poll and society", () => {
    const secretary = member("usr_kulkarni");
    const resident = member("usr_rahul");
    const poll = community.createSocietyPoll(secretary, "Paint the lobby?", ["Yes", "No"]);
    const another = community.createSocietyPoll(secretary, "Preferred colour?", ["White", "Blue"]);
    const results = community.listSocietyPolls(GREEN, resident.user.id);
    const [yes, no] = results.find((result) => result.id === poll)!.options;
    const [white] = results.find((result) => result.id === another)!.options;

    expect(() => community.voteInSocietyPoll(resident, poll, white.id)).toThrow(/option/);
    expect(() => community.voteInSocietyPoll(member("usr_n1"), poll, yes.id)).toThrow(/poll/i);
    community.voteInSocietyPoll(resident, poll, yes.id);
    expect(() => community.voteInSocietyPoll(resident, poll, no.id)).toThrow(/already voted/);
    expect(community.listSocietyPolls(GREEN, resident.user.id).find((result) => result.id === poll)).toMatchObject({
      myVote: yes.id, options: [{ label: "Yes", votes: 1 }, { label: "No", votes: 0 }],
    });

    community.closeSocietyPoll(secretary, poll);
    expect(() => community.voteInSocietyPoll(secretary, poll, no.id)).toThrow(/closed/);
  });
});

describe("amenity reservations", () => {
  it("prevents overlaps, allows adjoining times and keeps other reservations private", () => {
    const secretary = member("usr_kulkarni");
    const resident = member("usr_rahul");
    const hall = community.createSocietyAmenity(secretary, "Community hall", "Ground floor");
    const firstSlot = { amenityId: hall, startsAt: "2090-01-03T10:00", endsAt: "2090-01-03T11:00" };
    const first = community.reserveSocietyAmenity(resident, firstSlot);
    expect(() => community.reserveSocietyAmenity(secretary, {
      ...firstSlot, startsAt: "2090-01-03T10:30", endsAt: "2090-01-03T11:30",
    })).toThrow(/already reserved/);
    expect(() => community.reserveSocietyAmenity(member("usr_n1"), firstSlot)).toThrow(/amenity/);
    community.reserveSocietyAmenity(secretary, { ...firstSlot, startsAt: "2090-01-03T11:00", endsAt: "2090-01-03T12:00" });

    const reservations = community.listSocietyAmenities(GREEN, secretary.user.id).find((amenity) => amenity.id === hall)!.reservations;
    expect(reservations).toMatchObject([
      { id: first, mine: 0 }, { mine: 1 },
    ]);
    expect(reservations[0]).not.toHaveProperty("userId");
    expect(() => community.cancelSocietyAmenityReservation(secretary, first)).toThrow(/your reservation/);
    community.cancelSocietyAmenityReservation(resident, first);
    expect(() => community.reserveSocietyAmenity(secretary, firstSlot)).not.toThrow();
  });
});
