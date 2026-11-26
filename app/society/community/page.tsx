import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import { formatDate } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { requireSocietyMember, SocietyAccessError } from "@/lib/society-access";
import {
  formatSocietyDateTime, getSocietyMeeting, listNoticeBookingChoices, listSocietyAmenities, listSocietyMeetings,
  listSocietyNotices, listSocietyPolls, type SocietyAmenity, type SocietyMeeting, type SocietyMeetingWithAttendance,
  type SocietyPoll,
} from "@/lib/society-community";
import {
  cancelReservationAction, closePollAction, createAmenityAction, createPollAction, pinNoticeAction,
  publishMinutesAction, publishNoticeAction, recordAttendanceAction, reserveAmenityAction, rsvpAction,
  scheduleMeetingAction, voteAction,
} from "./actions";
import { CommunityForm, PrintMinutesButton } from "./forms";

export const dynamic = "force-dynamic";

const COMMUNITY = "/society/community";
const input = "block w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-normal text-ink-900";
const sections = [
  ["notices", "Notices"], ["meetings", "Meetings"], ["polls", "Voting"], ["amenities", "Amenities"],
] as const;

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ minutes?: string | string[] }> }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role === "ops") redirect("/ops");
  if (me.user.role === "vendor") redirect("/vendor");
  if (me.user.role === "guard") redirect("/society/visitors");

  let membership: ReturnType<typeof requireSocietyMember>;
  try {
    membership = requireSocietyMember(me);
  } catch (error) {
    if (error instanceof SocietyAccessError) redirect("/onboarding");
    throw error;
  }
  const { societyId, societyName, userId } = membership;
  const { minutes } = await searchParams;
  if (typeof minutes === "string") {
    const meeting = await getSocietyMeeting(societyId, minutes);
    if (!meeting?.minutes) notFound();
    return <MinutesDocument meeting={meeting} societyName={societyName} />;
  }

  const committee = me.user.role === "secretary";
  const [notices, bookings, meetings, polls, amenities] = await Promise.all([
    listSocietyNotices(societyId),
    committee ? listNoticeBookingChoices(societyId) : [],
    listSocietyMeetings(societyId, userId),
    listSocietyPolls(societyId, userId),
    listSocietyAmenities(societyId, userId),
  ]);
  const now = new Date().toISOString();

  return (
    <Phone>
      <AppHeader title="Community" subtitle={societyName} back={{ href: "/society", label: "Back to society" }} />
      <nav aria-label="Community sections" className="flex flex-wrap gap-1.5 border-b border-line bg-surface px-4 py-2.5">
        {sections.map(([id, title]) => (
          <a key={id} href={`#${id}`} className="pill bg-canvas-alt text-ink-700 hover:text-brand-700">{title}</a>
        ))}
      </nav>
      <main className="flex flex-col gap-6 px-4 py-5 pb-10">
        <Section id="notices" title="Notices" empty={notices.length === 0 ? "No notices have been published." : undefined}>
          {committee && (
            <Composer title="Post a notice">
              <CommunityForm action={publishNoticeAction} submit="Publish notice">
                <Field label="Title"><input name="title" className={input} required maxLength={100} /></Field>
                <Field label="Notice"><textarea name="body" className={input} rows={4} required maxLength={4000} /></Field>
                {bookings.length > 0 && (
                  <Field label="Link a group booking (optional)">
                    <select defaultValue="" name="dealId" className={input}>
                      <option value="">No booking link</option>
                      {bookings.map((booking) => (
                        <option key={booking.id} value={booking.id}>{booking.name} · {formatDate(booking.serviceDate)}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="pinned" /> Pin on the resident home screen
                </label>
              </CommunityForm>
            </Composer>
          )}
          {notices.map((notice) => (
            <article key={notice.id} id={`notice-${notice.id}`} className="card flex scroll-mt-20 flex-col gap-2 p-4">
              {notice.pinned === 1 && <span className="pill self-start bg-brand-50 text-brand-700">Pinned</span>}
              <h3 className="break-words text-base font-bold">{notice.title}</h3>
              <p className="text-xs text-ink-500">{notice.authorName} · <SocietyTime value={notice.createdAt} /></p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">{notice.body}</p>
              {notice.dealId && (
                <Link href={`/deal/${notice.dealId}`} className="self-start text-sm font-bold text-brand-700 underline underline-offset-4">
                  {notice.dealName ?? "View group booking"}
                </Link>
              )}
              {committee && (
                <CommunityForm action={pinNoticeAction} submit={notice.pinned ? "Unpin notice" : "Pin notice"} quiet>
                  <input type="hidden" name="noticeId" value={notice.id} />
                  <input type="hidden" name="pinned" value={String(notice.pinned === 0)} />
                </CommunityForm>
              )}
            </article>
          ))}
        </Section>

        <Section id="meetings" title="Committee meetings" empty={meetings.length === 0 ? "No meetings have been scheduled." : undefined}>
          {committee && (
            <Composer title="Schedule a meeting">
              <CommunityForm action={scheduleMeetingAction} submit="Schedule meeting">
                <Field label="Title"><input name="title" className={input} required maxLength={100} /></Field>
                <Field label="Date and time (IST)"><input name="startsAt" type="datetime-local" className={input} required /></Field>
                <Field label="Location (optional)"><input name="location" className={input} maxLength={100} /></Field>
                <Field label="Agenda"><textarea name="agenda" className={input} rows={4} required maxLength={4000} /></Field>
              </CommunityForm>
            </Composer>
          )}
          {meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} upcoming={meeting.startsAt > now} committee={committee} />)}
        </Section>

        <Section id="polls" title="Resident voting" empty={polls.length === 0 ? "No polls have been created." : undefined}>
          {committee && (
            <Composer title="Create a poll">
              <CommunityForm action={createPollAction} submit="Open poll">
                <Field label="Question"><input name="question" className={input} required maxLength={200} /></Field>
                <Field label="Options (2–6, one per line)">
                  <textarea name="options" className={input} rows={4} required maxLength={605} />
                </Field>
              </CommunityForm>
            </Composer>
          )}
          {polls.map((poll) => <PollCard key={poll.id} poll={poll} committee={committee} />)}
        </Section>

        <Section id="amenities" title="Amenity reservations" empty={amenities.length === 0 ? "No amenities are available to reserve yet." : undefined}>
          {committee && (
            <Composer title="Add an amenity">
              <CommunityForm action={createAmenityAction} submit="Add amenity">
                <Field label="Name"><input name="name" className={input} required maxLength={100} /></Field>
                <Field label="Description (optional)"><textarea name="description" className={input} rows={3} maxLength={1000} /></Field>
              </CommunityForm>
            </Composer>
          )}
          {amenities.map((amenity) => <AmenityCard key={amenity.id} amenity={amenity} now={now} />)}
        </Section>
      </main>
      <TabBar active="community" mobile={false} />
    </Phone>
  );
}

function Section({ children, id, title, empty }: { children: ReactNode; id: string; title: string; empty?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-title`} className="text-lg font-extrabold">{title}</h2>
      {children}
      {empty && <p className="text-sm text-ink-500">{empty}</p>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex w-full min-w-0 flex-col gap-1 text-sm font-semibold">{label}{children}</label>;
}

function Composer({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-bold text-brand-700">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function SocietyTime({ value }: { value: string }) {
  return <time dateTime={value}>{formatSocietyDateTime(value)} IST</time>;
}

function MeetingCard({ meeting, upcoming, committee }: {
  meeting: SocietyMeetingWithAttendance; upcoming: boolean; committee: boolean;
}) {
  return (
    <article id={`meeting-${meeting.id}`} className="card flex scroll-mt-20 flex-col gap-3 p-4">
      <div>
        <h3 className="break-words text-base font-bold">{meeting.title}</h3>
        <p className="text-sm text-ink-700"><SocietyTime value={meeting.startsAt} /></p>
        {meeting.location && <p className="break-words text-sm text-ink-700">{meeting.location}</p>}
      </div>
      <div>
        <p className="eyebrow mb-1">Agenda</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">{meeting.agenda}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm text-ink-500">
        <p>{meeting.attending} {meeting.attending === 1 ? "resident has" : "residents have"} RSVPed yes</p>
        {meeting.myResponse && <p>Your RSVP: {meeting.myResponse === "going" ? "Going" : "Unable to attend"}</p>}
        {meeting.actualAttendance !== null && <p>Recorded attendance: {meeting.actualAttendance}</p>}
      </div>
      {upcoming && (
        <CommunityForm action={rsvpAction} submit="Save RSVP" quiet>
          <input type="hidden" name="meetingId" value={meeting.id} />
          <Field label="Your response">
            <select name="response" defaultValue={meeting.myResponse ?? ""} className={input} required>
              <option value="" disabled>Choose your response</option>
              <option value="going">Going</option>
              <option value="not_going">Unable to attend</option>
            </select>
          </Field>
        </CommunityForm>
      )}
      {meeting.minutes && (
        <Link href={`${COMMUNITY}?minutes=${encodeURIComponent(meeting.id)}`} className="self-start text-sm font-bold text-brand-700 underline underline-offset-4">
          View meeting minutes
        </Link>
      )}
      {committee && !upcoming && (
        <details className="mt-1 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm font-bold text-brand-700">Attendance and minutes</summary>
          <div className="mt-3 flex flex-col gap-4">
            <CommunityForm action={recordAttendanceAction} submit="Save attendance" quiet>
              <input type="hidden" name="meetingId" value={meeting.id} />
              <Field label="Residents who attended">
                <input type="number" name="attendance" className={input} required min={0} step={1} defaultValue={meeting.actualAttendance ?? ""} />
              </Field>
            </CommunityForm>
            <CommunityForm action={publishMinutesAction} submit={meeting.minutes ? "Update minutes" : "Publish minutes"}>
              <input type="hidden" name="meetingId" value={meeting.id} />
              <Field label="Minutes">
                <textarea name="minutes" className={input} rows={5} required maxLength={20000} defaultValue={meeting.minutes ?? ""} />
              </Field>
            </CommunityForm>
          </div>
        </details>
      )}
    </article>
  );
}

function PollCard({ poll, committee }: { poll: SocietyPoll; committee: boolean }) {
  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-base font-bold">{poll.question}</h3>
        <span className={`pill shrink-0 ${poll.closedAt ? "bg-canvas-alt text-ink-500" : "bg-save-50 text-save-700"}`}>
          {poll.closedAt ? "Closed" : "Open"}
        </span>
      </div>
      {poll.closedAt || poll.myVote ? (
        <ul className="flex flex-col gap-2 text-sm">
          {poll.options.map((option) => (
            <li key={option.id} className="flex justify-between gap-3 rounded-xl bg-canvas-alt px-3 py-2">
              <span className="min-w-0 break-words">
                {option.label}{poll.myVote === option.id && <span className="ml-2 text-xs font-bold text-brand-700">Your vote</span>}
              </span>
              <strong className="shrink-0">{option.votes} {option.votes === 1 ? "vote" : "votes"}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <CommunityForm action={voteAction} submit="Submit vote">
          <input type="hidden" name="pollId" value={poll.id} />
          <fieldset className="flex w-full flex-col gap-2">
            <legend className="sr-only">{poll.question}</legend>
            {poll.options.map((option) => (
              <label key={option.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-canvas-alt px-3 py-2.5 text-sm">
                <input type="radio" name="optionId" value={option.id} required />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            ))}
          </fieldset>
        </CommunityForm>
      )}
      {committee && !poll.closedAt && (
        <CommunityForm action={closePollAction} submit="Close poll" quiet>
          <input type="hidden" name="pollId" value={poll.id} />
        </CommunityForm>
      )}
    </article>
  );
}

function AmenityCard({ amenity, now }: { amenity: SocietyAmenity; now: string }) {
  return (
    <article className="card flex flex-col gap-3 p-4">
      <div>
        <h3 className="break-words text-base font-bold">{amenity.name}</h3>
        {amenity.description && <p className="whitespace-pre-wrap break-words text-sm text-ink-700">{amenity.description}</p>}
      </div>
      {amenity.reservations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Reserved times</p>
          <ul className="flex flex-col gap-2">
            {amenity.reservations.map((reservation) => (
              <li key={reservation.id} className="flex flex-col gap-1 rounded-xl bg-canvas-alt px-3 py-2 text-sm text-ink-700">
                <p><SocietyTime value={reservation.startsAt} /> – <SocietyTime value={reservation.endsAt} /></p>
                {reservation.mine === 1 && <p className="font-semibold">Your reservation</p>}
                {reservation.mine === 1 && reservation.startsAt > now && (
                  <CommunityForm action={cancelReservationAction} submit="Cancel reservation" quiet>
                    <input type="hidden" name="reservationId" value={reservation.id} />
                  </CommunityForm>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-bold text-brand-700">Reserve a time</summary>
        <div className="mt-3">
          <CommunityForm action={reserveAmenityAction} submit="Confirm reservation">
            <input type="hidden" name="amenityId" value={amenity.id} />
            <Field label="Start (IST)"><input type="datetime-local" name="startsAt" className={input} required /></Field>
            <Field label="End (IST)"><input type="datetime-local" name="endsAt" className={input} required /></Field>
          </CommunityForm>
        </div>
      </details>
    </article>
  );
}

function MinutesDocument({ meeting, societyName }: { meeting: SocietyMeeting; societyName: string }) {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-6 print:max-w-none print:bg-white print:p-0 print:text-black">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`${COMMUNITY}#meeting-${meeting.id}`} className="text-sm font-bold text-brand-700 underline underline-offset-4">
          Back to meeting
        </Link>
        <PrintMinutesButton />
      </div>
      <article className="card flex flex-col gap-5 p-5 print:block print:rounded-none print:border-0 print:bg-white print:p-0">
        <header className="print:mb-5">
          <p className="mb-1 text-sm font-semibold">{societyName}</p>
          <h1 className="break-words text-2xl font-extrabold">{meeting.title}</h1>
          <p className="mt-1 text-sm"><SocietyTime value={meeting.startsAt} /></p>
          {meeting.location && <p className="break-words text-sm">{meeting.location}</p>}
          {meeting.actualAttendance !== null && <p className="mt-2 text-sm">Recorded attendance: {meeting.actualAttendance}</p>}
        </header>
        <section className="print:mb-5">
          <h2 className="mb-1 font-bold">Agenda</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{meeting.agenda}</p>
        </section>
        <section className="print:mb-5">
          <h2 className="mb-1 font-bold">Meeting minutes</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{meeting.minutes}</p>
        </section>
        {meeting.minutesPublishedAt && <p className="text-xs">Last published <SocietyTime value={meeting.minutesPublishedAt} /></p>}
      </article>
    </main>
  );
}
