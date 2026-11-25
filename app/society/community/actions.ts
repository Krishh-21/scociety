"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/actions";
import { getMe, type Me } from "@/lib/session";
import { SocietyAccessError } from "@/lib/society-access";
import {
  cancelSocietyAmenityReservation, closeSocietyPoll, createSocietyAmenity, createSocietyPoll,
  publishSocietyMinutes, publishSocietyNotice, recordSocietyAttendance, reserveSocietyAmenity,
  rsvpToSocietyMeeting, scheduleSocietyMeeting, setSocietyNoticePinned, SocietyCommunityError, voteInSocietyPoll,
} from "@/lib/society-community";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

async function changeCommunity(change: (me: Me | null) => Promise<unknown>, ok: string, refreshNotice = false): Promise<ActionState> {
  try {
    await change(await getMe());
    revalidatePath("/society/community");
    if (refreshNotice) {
      revalidatePath("/society");
      revalidatePath("/");
    }
    return { ok };
  } catch (error) {
    if (error instanceof SocietyAccessError || error instanceof SocietyCommunityError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Try again." };
  }
}

export async function publishNoticeAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => publishSocietyNotice(me, {
    title: field(form, "title"), body: field(form, "body"), dealId: field(form, "dealId"), pinned: form.has("pinned"),
  }), "Notice published.", true);
}

export async function pinNoticeAction(_state: ActionState, form: FormData) {
  const pinned = field(form, "pinned") === "true";
  return changeCommunity((me) => setSocietyNoticePinned(me, field(form, "noticeId"), pinned),
    pinned ? "Notice pinned." : "Notice unpinned.", true);
}

export async function scheduleMeetingAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => scheduleSocietyMeeting(me, {
    title: field(form, "title"), agenda: field(form, "agenda"), startsAt: field(form, "startsAt"), location: field(form, "location"),
  }), "Meeting scheduled.");
}

export async function rsvpAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => rsvpToSocietyMeeting(me, field(form, "meetingId"), field(form, "response")), "RSVP saved.");
}

export async function publishMinutesAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => publishSocietyMinutes(me, field(form, "meetingId"), field(form, "minutes")), "Minutes published.");
}

export async function recordAttendanceAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => recordSocietyAttendance(me, field(form, "meetingId"), field(form, "attendance")), "Attendance saved.");
}

export async function createPollAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => createSocietyPoll(me, field(form, "question"), field(form, "options").split(/\r?\n/)), "Poll opened.");
}

export async function voteAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => voteInSocietyPoll(me, field(form, "pollId"), field(form, "optionId")), "Vote recorded.");
}

export async function closePollAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => closeSocietyPoll(me, field(form, "pollId")), "Poll closed.");
}

export async function createAmenityAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => createSocietyAmenity(me, field(form, "name"), field(form, "description")), "Amenity added.");
}

export async function reserveAmenityAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => reserveSocietyAmenity(me, {
    amenityId: field(form, "amenityId"), startsAt: field(form, "startsAt"), endsAt: field(form, "endsAt"),
  }), "Reservation confirmed.");
}

export async function cancelReservationAction(_state: ActionState, form: FormData) {
  return changeCommunity((me) => cancelSocietyAmenityReservation(me, field(form, "reservationId")), "Reservation cancelled.");
}
