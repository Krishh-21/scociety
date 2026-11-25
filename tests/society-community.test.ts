import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";

process.env.JODO_DB = ":memory:";

const { getDb, one, run } = await import("@/lib/db");
const community = await import("@/lib/society-community");
const { listNotifications } = await import("@/lib/notify");

const GREEN = "soc_green_valley";
const PALM = "soc_palm_grove";

async function member(userId: string): Promise<Me> {
  return {
    user: (await one<Me["user"]>("SELECT * FROM user WHERE id = ?", userId))!,
    residency: (await one<NonNullable<Me["residency"]>>(
      `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
       WHERE r.userId = ?`,
      userId,
    )),
  };
}

beforeEach(async () => {
  getDb();
  (await run("UPDATE residency SET societyId = ? WHERE userId = 'usr_n1'", PALM));
});

afterEach(() => {
  getDb().close();
  globalThis.__jodoDb = undefined;
});

describe("society notices", () => {
  it("announces a notice to other verified residents in the author's society", async () => {
    (await run("UPDATE residency SET status = 'pending' WHERE userId = 'usr_n2'"));
    (await community.publishSocietyNotice((await member("usr_kulkarni")), {
      title: "North lift maintenance", body: "The north lift will reopen this afternoon.", pinned: false,
    }));

    expect((await listNotifications("usr_rahul"))).toContainEqual(expect.objectContaining({
      type: "society_notice", title: "North lift maintenance", dealId: null,
    }));
    for (const userId of ["usr_kulkarni", "usr_n1", "usr_n2"]) {
      expect((await listNotifications(userId)).some((notification) => notification.title === "North lift maintenance")).toBe(false);
    }
  });

  it("pins a single notice and hides booking links that stop accepting residents", async () => {
    const secretary = (await member("usr_kulkarni"));
    const first = (await community.publishSocietyNotice(secretary, {
      title: "Lift maintenance", body: "The north lift is closed.", pinned: true,
    }));
    const second = (await community.publishSocietyNotice(secretary, {
      title: "AC service", body: "Join the Sunday group.", pinned: true, dealId: "deal_ac_sunday",
    }));

    expect((await community.getPinnedNotice(GREEN))).toMatchObject({ id: second, dealId: "deal_ac_sunday" });
    expect((await community.getPinnedNotice(PALM))?.id).not.toBe(second);
    expect((await community.listSocietyNotices(GREEN)).filter((notice) => notice.id === first || notice.id === second)).toMatchObject([
      { id: second, pinned: 1, authorName: "Amit Kulkarni" }, { id: first, pinned: 0 },
    ]);

    (await run("UPDATE deal SET status = 'locked' WHERE id = 'deal_ac_sunday'"));
    expect((await community.getPinnedNotice(GREEN))).toMatchObject({ id: second, dealId: null });
    (await community.setSocietyNoticePinned(secretary, first, true));
    expect((await community.getPinnedNotice(GREEN))?.id).toBe(first);
  });

  it("requires committee access and rejects a booking from another society", async () => {
    const details = { title: "AC service", body: "Sunday.", pinned: false, dealId: "deal_ac_sunday" };
    await expect((async () => (await community.publishSocietyNotice((await member("usr_rahul")), details)))()).rejects.toThrow(/committee/i);

    (await run("UPDATE residency SET societyId = ? WHERE userId = 'usr_kulkarni'", PALM));
    const before = (await community.listSocietyNotices(PALM));
    await expect((async () => (await community.publishSocietyNotice((await member("usr_kulkarni")), details)))()).rejects.toThrow(/open group/i);
    expect((await community.listSocietyNotices(PALM))).toEqual(before);
  });
});

describe("society meetings", () => {
  it("lets verified residents update one RSVP and the committee publish minutes after the start", async () => {
    const secretary = (await member("usr_kulkarni"));
    const resident = (await member("usr_rahul"));
    const meeting = (await community.scheduleSocietyMeeting(secretary, {
      title: "Rooftop committee meeting", agenda: "Discuss the rooftop repairs.", startsAt: "2090-01-03T10:30",
    }));
    expect((await listNotifications(resident.user.id))).toContainEqual(expect.objectContaining({
      type: "society_meeting", title: "Rooftop committee meeting",
    }));
    expect((await community.getSocietyMeeting(GREEN, meeting))).toMatchObject({ startsAt: "2090-01-03T05:00:00.000Z" });
    expect((await community.getSocietyMeeting(PALM, meeting))).toBeNull();
    await expect((async () => (await community.rsvpToSocietyMeeting((await member("usr_n1")), meeting, "going")))()).rejects.toThrow(/meeting/i);
    await expect((async () => (await community.rsvpToSocietyMeeting({ ...resident, residency: { ...resident.residency!, status: "pending" } }, meeting, "going")))()).rejects.toThrow();
    (await community.rsvpToSocietyMeeting(resident, meeting, "going"));
    (await community.rsvpToSocietyMeeting(resident, meeting, "not_going"));
    expect((await community.listSocietyMeetings(GREEN, resident.user.id)).find((result) => result.id === meeting)).toMatchObject({
      attending: 0, myResponse: "not_going",
    });
    await expect((async () => (await community.publishSocietyMinutes(secretary, meeting, "Repairs approved.")))()).rejects.toThrow(/started/);
    await expect((async () => (await community.recordSocietyAttendance(secretary, meeting, "4")))()).rejects.toThrow(/started/);

    (await run("UPDATE society_meeting SET startsAt = ? WHERE id = ?", "2000-01-03T05:00:00.000Z", meeting));
    await expect((async () => (await community.rsvpToSocietyMeeting(resident, meeting, "going")))()).rejects.toThrow(/RSVP/);
    await expect((async () => (await community.recordSocietyAttendance(secretary, meeting, "4.5")))()).rejects.toThrow(/whole number/);
    (await community.recordSocietyAttendance(secretary, meeting, "4"));
    (await community.publishSocietyMinutes(secretary, meeting, "Repairs approved."));
    expect((await community.getSocietyMeeting(GREEN, meeting))).toMatchObject({ minutes: "Repairs approved.", actualAttendance: 4 });
  });
});

describe("society polls", () => {
  it("accepts one vote per resident and keeps the ballot scoped to its own poll and society", async () => {
    const secretary = (await member("usr_kulkarni"));
    const resident = (await member("usr_rahul"));
    const poll = (await community.createSocietyPoll(secretary, "Paint the lobby?", ["Yes", "No"]));
    const another = (await community.createSocietyPoll(secretary, "Preferred colour?", ["White", "Blue"]));
    const results = (await community.listSocietyPolls(GREEN, resident.user.id));
    const [yes, no] = results.find((result) => result.id === poll)!.options;
    const [white] = results.find((result) => result.id === another)!.options;

    await expect((async () => (await community.voteInSocietyPoll(resident, poll, white.id)))()).rejects.toThrow(/option/);
    await expect((async () => (await community.voteInSocietyPoll((await member("usr_n1")), poll, yes.id)))()).rejects.toThrow(/poll/i);
    (await community.voteInSocietyPoll(resident, poll, yes.id));
    await expect((async () => (await community.voteInSocietyPoll(resident, poll, no.id)))()).rejects.toThrow(/already voted/);
    expect((await community.listSocietyPolls(GREEN, resident.user.id)).find((result) => result.id === poll)).toMatchObject({
      myVote: yes.id, options: [{ label: "Yes", votes: 1 }, { label: "No", votes: 0 }],
    });

    (await community.closeSocietyPoll(secretary, poll));
    await expect((async () => (await community.voteInSocietyPoll(secretary, poll, no.id)))()).rejects.toThrow(/closed/);
  });
});

describe("amenity reservations", () => {
  it("prevents overlaps, allows adjoining times and keeps other reservations private", async () => {
    const secretary = (await member("usr_kulkarni"));
    const resident = (await member("usr_rahul"));
    const hall = (await community.createSocietyAmenity(secretary, "Community hall", "Ground floor"));
    const firstSlot = { amenityId: hall, startsAt: "2090-01-03T10:00", endsAt: "2090-01-03T11:00" };
    const first = (await community.reserveSocietyAmenity(resident, firstSlot));
    await expect((async () => (await community.reserveSocietyAmenity(secretary, {
      ...firstSlot, startsAt: "2090-01-03T10:30", endsAt: "2090-01-03T11:30",
    })))()).rejects.toThrow(/already reserved/);
    await expect((async () => (await community.reserveSocietyAmenity((await member("usr_n1")), firstSlot)))()).rejects.toThrow(/amenity/);
    (await community.reserveSocietyAmenity(secretary, { ...firstSlot, startsAt: "2090-01-03T11:00", endsAt: "2090-01-03T12:00" }));

    const reservations = (await community.listSocietyAmenities(GREEN, secretary.user.id)).find((amenity) => amenity.id === hall)!.reservations;
    expect(reservations).toMatchObject([
      { id: first, mine: 0 }, { mine: 1 },
    ]);
    expect(reservations[0]).not.toHaveProperty("userId");
    await expect((async () => (await community.cancelSocietyAmenityReservation(secretary, first)))()).rejects.toThrow(/your reservation/);
    (await community.cancelSocietyAmenityReservation(resident, first));
    await expect((async () => (await community.reserveSocietyAmenity(secretary, firstSlot)))()).resolves.not.toBeNull();
  });
});
