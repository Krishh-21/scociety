import { all, id, inTransaction, one, run } from "./db";
import { notify, societyResidentIds } from "./notify";
import { isValidRevisitDate } from "./revisits";
import type { Me } from "./session";
import { requireSocietyCommittee, requireSocietyMember } from "./society-access";

export class SocietyCommunityError extends Error {}

const societyDateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
});

export function formatSocietyDateTime(value: string) {
  return societyDateTime.format(new Date(value));
}

function localDateTime(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || !isValidRevisitDate(value.slice(0, 10))) {
    throw new SocietyCommunityError(`Enter a valid ${label}.`);
  }
  return new Date(`${value}:00+05:30`).toISOString();
}

function textField(value: string, label: string, max: number, required = true) {
  const trimmed = value.trim();
  if (required && !trimmed) throw new SocietyCommunityError(`Enter ${label}.`);
  if (trimmed.length > max) throw new SocietyCommunityError(`Keep ${label} within ${max} characters.`);
  return trimmed;
}

export type SocietyNotice = {
  id: string;
  title: string;
  body: string;
  pinned: 0 | 1;
  createdAt: string;
  authorName: string;
  dealId: string | null;
  dealName: string | null;
};

const NOTICE_QUERY = `
  SELECT n.id, n.title, n.body, n.pinned, n.createdAt, author.name AS authorName,
         d.id AS dealId, sku.name AS dealName
  FROM society_notice n JOIN user author ON author.id = n.authorId
  LEFT JOIN deal d ON d.id = n.dealId AND d.societyId = n.societyId
    AND d.status = 'open' AND d.joinDeadline > ?
  LEFT JOIN sku ON sku.id = d.skuId
  WHERE n.societyId = ?`;

export async function getPinnedNotice(societyId: string) {
  return one<SocietyNotice>(`${NOTICE_QUERY} AND n.pinned = 1`, new Date().toISOString(), societyId);
}

export async function listSocietyNotices(societyId: string, limit?: number) {
  return all<SocietyNotice>(
    `${NOTICE_QUERY} ORDER BY n.pinned DESC, n.createdAt DESC, n.id DESC${limit === undefined ? "" : " LIMIT ?"}`,
    new Date().toISOString(), societyId, ...(limit === undefined ? [] : [limit]),
  );
}

export async function listNoticeBookingChoices(societyId: string) {
  return all<{ id: string; name: string; serviceDate: string }>(
    `SELECT d.id, sku.name, d.serviceDate FROM deal d JOIN sku ON sku.id = d.skuId
     WHERE d.societyId = ? AND d.status = 'open' AND d.joinDeadline > ? ORDER BY d.serviceDate, d.id`,
    societyId, new Date().toISOString(),
  );
}

export async function publishSocietyNotice(me: Me | null, input: {
  title: string; body: string; pinned: boolean; dealId?: string;
}) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const title = textField(input.title, "a title", 100);
  const body = textField(input.body, "the notice", 4000);
  const dealId = input.dealId?.trim() || null;
  const noticeId = id("notice");
  const now = new Date().toISOString();
  await inTransaction(async () => {
    if (dealId && !(await one("SELECT id FROM deal WHERE id = ? AND societyId = ? AND status = 'open' AND joinDeadline > ?", dealId, societyId, now))) {
      throw new SocietyCommunityError("Choose an open group in your society.");
    }
    if (input.pinned) await run("UPDATE society_notice SET pinned = 0 WHERE societyId = ? AND pinned = 1", societyId);
    await run(`INSERT INTO society_notice (id, societyId, authorId, title, body, dealId, pinned, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, noticeId, societyId, userId, title, body, dealId, Number(input.pinned), now);
    await notify(await societyResidentIds(societyId, userId), {
      societyId,
      type: "society_notice", title, body: body.length > 160 ? `${body.slice(0, 159).trimEnd()}…` : body,
    });
  });
  return noticeId;
}

export async function setSocietyNoticePinned(me: Me | null, noticeId: string, pinned: boolean) {
  const { societyId } = requireSocietyCommittee(me);
  await inTransaction(async () => {
    if (pinned) await run("UPDATE society_notice SET pinned = 0 WHERE societyId = ? AND pinned = 1", societyId);
    const result = await run("UPDATE society_notice SET pinned = ? WHERE id = ? AND societyId = ?", Number(pinned), noticeId, societyId);
    if (!result.changes) throw new SocietyCommunityError("This notice is unavailable.");
  });
}

export type MeetingResponse = "going" | "not_going";

export type SocietyMeeting = {
  id: string;
  title: string;
  agenda: string;
  location: string;
  startsAt: string;
  minutes: string | null;
  minutesPublishedAt: string | null;
  authorName: string;
  actualAttendance: number | null;
};

export type SocietyMeetingWithAttendance = SocietyMeeting & { myResponse: MeetingResponse | null; attending: number };

export async function listSocietyMeetings(societyId: string, viewerId: string) {
  const now = new Date().toISOString();
  return all<SocietyMeetingWithAttendance>(
    `SELECT m.*, author.name AS authorName, r.response AS myResponse,
        (SELECT COUNT(*) FROM society_meeting_rsvp WHERE meetingId = m.id AND response = 'going') AS attending
     FROM society_meeting m JOIN user author ON author.id = m.authorId
     LEFT JOIN society_meeting_rsvp r ON r.meetingId = m.id AND r.userId = ?
     WHERE m.societyId = ?
     ORDER BY (m.startsAt > ?) DESC, CASE WHEN m.startsAt > ? THEN m.startsAt END, m.startsAt DESC, m.id`,
    viewerId, societyId, now, now,
  );
}

export async function getSocietyMeeting(societyId: string, meetingId: string) {
  return one<SocietyMeeting>(
    `SELECT m.*, author.name AS authorName FROM society_meeting m
     JOIN user author ON author.id = m.authorId WHERE m.id = ? AND m.societyId = ?`,
    meetingId, societyId,
  );
}

export async function scheduleSocietyMeeting(me: Me | null, input: {
  title: string; agenda: string; startsAt: string; location?: string;
}) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const title = textField(input.title, "a title", 100);
  const agenda = textField(input.agenda, "the agenda", 4000);
  const location = textField(input.location ?? "", "the location", 100, false);
  const startsAt = localDateTime(input.startsAt, "meeting date and time");
  if (startsAt <= new Date().toISOString()) throw new SocietyCommunityError("Choose a future meeting time.");
  const meetingId = id("meeting");
  await inTransaction(async () => {
    await run(`INSERT INTO society_meeting (id, societyId, authorId, title, agenda, location, startsAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, meetingId, societyId, userId, title, agenda, location, startsAt);
    await notify(await societyResidentIds(societyId, userId), {
      societyId,
      type: "society_meeting", title, body: `${formatSocietyDateTime(startsAt)} IST${location ? ` · ${location}` : ""}`,
    });
  });
  return meetingId;
}

export async function rsvpToSocietyMeeting(me: Me | null, meetingId: string, response: string) {
  const { societyId, userId } = requireSocietyMember(me);
  if (response !== "going" && response !== "not_going") throw new SocietyCommunityError("Choose an RSVP response.");
  const result = await run(
    `INSERT INTO society_meeting_rsvp (meetingId, userId, response)
     SELECT id, ?, ? FROM society_meeting WHERE id = ? AND societyId = ? AND startsAt > ?
     ON CONFLICT(meetingId, userId) DO UPDATE SET response = excluded.response`,
    userId, response, meetingId, societyId, new Date().toISOString(),
  );
  if (!result.changes) throw new SocietyCommunityError("You can only RSVP to an upcoming meeting in your society.");
}

export async function publishSocietyMinutes(me: Me | null, meetingId: string, value: string) {
  const { societyId } = requireSocietyCommittee(me);
  const minutes = textField(value, "the minutes", 20000);
  const now = new Date().toISOString();
  const result = await run(
    `UPDATE society_meeting SET minutes = ?, minutesPublishedAt = ? WHERE id = ? AND societyId = ? AND startsAt <= ?`,
    minutes, now, meetingId, societyId, now,
  );
  if (!result.changes) throw new SocietyCommunityError("Minutes can only be published once a meeting in your society has started.");
}

export async function recordSocietyAttendance(me: Me | null, meetingId: string, value: string) {
  const { societyId } = requireSocietyCommittee(me);
  const attendance = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(attendance)) {
    throw new SocietyCommunityError("Enter attendance as a whole number of zero or more.");
  }
  const result = await run(
    `UPDATE society_meeting SET actualAttendance = ? WHERE id = ? AND societyId = ? AND startsAt <= ?`,
    attendance, meetingId, societyId, new Date().toISOString(),
  );
  if (!result.changes) throw new SocietyCommunityError("Attendance can only be recorded once a meeting in your society has started.");
}

type PollOption = { id: string; label: string; votes: number };
type PollRecord = { id: string; question: string; closedAt: string | null; myVote: string | null };
export type SocietyPoll = PollRecord & { options: PollOption[] };

export async function listSocietyPolls(societyId: string, viewerId: string): Promise<SocietyPoll[]> {
  const polls = await all<PollRecord>(
    `SELECT p.id, p.question, p.closedAt, mine.optionId AS myVote
     FROM society_poll p LEFT JOIN society_poll_vote mine ON mine.pollId = p.id AND mine.userId = ?
     WHERE p.societyId = ? ORDER BY (p.closedAt IS NULL) DESC, p.createdAt DESC, p.id`,
    viewerId, societyId,
  );
  const options = await all<PollOption & { pollId: string }>(
    `SELECT o.id, o.pollId, o.label, COUNT(v.userId) AS votes
     FROM society_poll_option o JOIN society_poll p ON p.id = o.pollId
     LEFT JOIN society_poll_vote v ON v.pollId = o.pollId AND v.optionId = o.id
     WHERE p.societyId = ? GROUP BY o.id ORDER BY o.position`,
    societyId,
  );
  const optionsByPoll = new Map<string, PollOption[]>();
  for (const { pollId, ...option } of options) {
    const entries = optionsByPoll.get(pollId) ?? [];
    entries.push(option);
    optionsByPoll.set(pollId, entries);
  }
  return polls.map((poll) => ({ ...poll, options: optionsByPoll.get(poll.id) ?? [] }));
}

export async function createSocietyPoll(me: Me | null, value: string, values: string[]) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const question = textField(value, "a question", 200);
  const options = values.map((option) => option.trim()).filter(Boolean);
  if (options.length < 2 || options.length > 6 || new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    throw new SocietyCommunityError("Enter two to six distinct options.");
  }
  if (options.some((option) => option.length > 100)) throw new SocietyCommunityError("Keep each option within 100 characters.");
  const pollId = id("poll");
  await inTransaction(async () => {
    await run(`INSERT INTO society_poll (id, societyId, authorId, question, createdAt) VALUES (?, ?, ?, ?, ?)`,
      pollId, societyId, userId, question, new Date().toISOString());
    for (const [position, label] of options.entries()) {
      await run(`INSERT INTO society_poll_option (id, pollId, label, position) VALUES (?, ?, ?, ?)`,
        id("option"), pollId, label, position);
    }
  });
  return pollId;
}

export async function voteInSocietyPoll(me: Me | null, pollId: string, optionId: string) {
  const { societyId, userId } = requireSocietyMember(me);
  const result = await run(
    `INSERT INTO society_poll_vote (pollId, optionId, userId)
     SELECT p.id, o.id, ? FROM society_poll p JOIN society_poll_option o ON o.pollId = p.id
     WHERE p.id = ? AND p.societyId = ? AND p.closedAt IS NULL AND o.id = ?
     ON CONFLICT(pollId, userId) DO NOTHING`,
    userId, pollId, societyId, optionId,
  );
  if (result.changes) return;

  const poll = await one<{ closedAt: string | null }>("SELECT closedAt FROM society_poll WHERE id = ? AND societyId = ?", pollId, societyId);
  if (!poll) throw new SocietyCommunityError("This poll is unavailable.");
  if (poll.closedAt) throw new SocietyCommunityError("Voting has closed.");
  if (await one("SELECT 1 FROM society_poll_vote WHERE pollId = ? AND userId = ?", pollId, userId)) {
    throw new SocietyCommunityError("You have already voted in this poll.");
  }
  throw new SocietyCommunityError("Choose an option from this poll.");
}

export async function closeSocietyPoll(me: Me | null, pollId: string) {
  const { societyId } = requireSocietyCommittee(me);
  const result = await run("UPDATE society_poll SET closedAt = coalesce(closedAt, ?) WHERE id = ? AND societyId = ?",
    new Date().toISOString(), pollId, societyId);
  if (!result.changes) throw new SocietyCommunityError("This poll is unavailable.");
}

type AmenityReservation = { id: string; startsAt: string; endsAt: string; mine: 0 | 1 };
type AmenityRecord = { id: string; name: string; description: string };
export type SocietyAmenity = AmenityRecord & { reservations: AmenityReservation[] };

export async function listSocietyAmenities(societyId: string, viewerId: string): Promise<SocietyAmenity[]> {
  const amenities = await all<AmenityRecord>(
    "SELECT id, name, description FROM society_amenity WHERE societyId = ? ORDER BY lower(name)", societyId,
  );
  const reservations = await all<AmenityReservation & { amenityId: string }>(
    `SELECT r.id, r.amenityId, r.startsAt, r.endsAt, CASE WHEN r.userId = ? THEN 1 ELSE 0 END AS mine
     FROM society_amenity_reservation r JOIN society_amenity a ON a.id = r.amenityId
     WHERE a.societyId = ? AND r.endsAt > ? ORDER BY r.startsAt, r.id`,
    viewerId, societyId, new Date().toISOString(),
  );
  const reservationsByAmenity = new Map<string, AmenityReservation[]>();
  for (const { amenityId, ...reservation } of reservations) {
    const entries = reservationsByAmenity.get(amenityId) ?? [];
    entries.push(reservation);
    reservationsByAmenity.set(amenityId, entries);
  }
  return amenities.map((amenity) => ({ ...amenity, reservations: reservationsByAmenity.get(amenity.id) ?? [] }));
}

export async function createSocietyAmenity(me: Me | null, nameValue: string, descriptionValue: string) {
  const { societyId } = requireSocietyCommittee(me);
  const name = textField(nameValue, "an amenity name", 100);
  const description = textField(descriptionValue, "the description", 1000, false);
  const amenityId = id("amenity");
  const result = await run(
    `INSERT INTO society_amenity (id, societyId, name, description) VALUES (?, ?, ?, ?)
     ON CONFLICT DO NOTHING`, amenityId, societyId, name, description,
  );
  if (!result.changes) throw new SocietyCommunityError("An amenity with this name already exists.");
  return amenityId;
}

export async function reserveSocietyAmenity(me: Me | null, input: { amenityId: string; startsAt: string; endsAt: string }) {
  const { societyId, userId } = requireSocietyMember(me);
  const startsAt = localDateTime(input.startsAt, "start date and time");
  const endsAt = localDateTime(input.endsAt, "end date and time");
  if (startsAt <= new Date().toISOString()) throw new SocietyCommunityError("Choose a future start time.");
  if (endsAt <= startsAt) throw new SocietyCommunityError("The end time must be after the start time.");
  const reservationId = id("reservation");
  try {
    const result = await run(
      `INSERT INTO society_amenity_reservation (id, amenityId, userId, startsAt, endsAt)
       SELECT ?, id, ?, ?, ? FROM society_amenity WHERE id = ? AND societyId = ?`,
      reservationId, userId, startsAt, endsAt, input.amenityId, societyId,
    );
    if (!result.changes) throw new SocietyCommunityError("This amenity is unavailable.");
  } catch (error) {
    if (error instanceof Error && (
      error.message === "amenity reservation overlaps" ||
      ("constraint" in error && error.constraint === "jodo_amenity_reservation_overlap")
    )) {
      throw new SocietyCommunityError("This time is already reserved. Choose another time.");
    }
    throw error;
  }
  return reservationId;
}

export async function cancelSocietyAmenityReservation(me: Me | null, reservationId: string) {
  const { societyId, userId } = requireSocietyMember(me);
  const result = await run(
    `DELETE FROM society_amenity_reservation WHERE id = ? AND userId = ? AND startsAt > ?
     AND amenityId IN (SELECT id FROM society_amenity WHERE societyId = ?)`,
    reservationId, userId, new Date().toISOString(), societyId,
  );
  if (!result.changes) throw new SocietyCommunityError("You can only cancel your reservation before it starts.");
}
