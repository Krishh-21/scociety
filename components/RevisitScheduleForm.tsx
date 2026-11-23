"use client";

import { useActionState, useState } from "react";
import { scheduleRevisitAction, type ActionState } from "@/app/actions";
import { REVISIT_SLOTS } from "@/lib/revisits";

const empty: ActionState = {};

export default function RevisitScheduleForm({
  jobId,
  earliestDate,
  currentDate = "",
  currentSlot = "",
}: {
  jobId: string;
  earliestDate: string;
  currentDate?: string;
  currentSlot?: string;
}) {
  const [state, action, pending] = useActionState(scheduleRevisitAction, empty);
  const [date, setDate] = useState(currentDate);
  const [slot, setSlot] = useState(currentSlot);
  const rescheduling = Boolean(currentDate);
  const confirmationId = `revisit-confirm-time-${jobId}`;

  return (
    <form action={action} aria-busy={pending} aria-describedby={confirmationId}>
      <input type="hidden" name="jobId" value={jobId} />
      <p id={confirmationId} className="mb-2 text-[13px] text-ink-500">
        Confirm the date and time with the resident before saving.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          Revisit date
          <input
            name="serviceDate"
            type="date"
            value={date}
            min={earliestDate}
            onChange={(event) => setDate(event.target.value)}
            className="card h-9 px-2 text-sm font-normal tnum"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          Time slot
          <select
            name="slot"
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            className="card h-9 px-2 text-sm font-normal"
            required
          >
            <option value="" disabled>Select a slot</option>
            {REVISIT_SLOTS.map((timeSlot) => <option key={timeSlot} value={timeSlot}>{timeSlot}</option>)}
          </select>
        </label>
        <button
          type="submit"
          className="btn btn-primary h-9 min-h-9 text-[13px]"
          disabled={pending || (rescheduling && date === currentDate && slot === currentSlot)}
        >
          {pending ? "Saving…" : rescheduling ? "Save new schedule" : "Schedule revisit"}
        </button>
      </div>
      {state.error && <p role="alert" className="mt-2 text-[12px] text-danger-600">{state.error}</p>}
    </form>
  );
}
