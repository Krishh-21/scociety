"use client";

import { useActionState } from "react";
import { reportComplaintAction, updateComplaintAction, type ComplaintFormState } from "./actions";

const field = "card px-3 py-2 w-full text-sm font-normal";

function FormFeedback({ state }: { state: ComplaintFormState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-save-700">{state.ok}</p>}
    </>
  );
}

export function ReportComplaintForm({ categories }: { categories: readonly string[] }) {
  const [state, action, pending] = useActionState(reportComplaintAction, {});
  return (
    <form action={action} aria-busy={pending} className="grid gap-3 mt-3">
      <label className="grid gap-1 text-sm font-bold">
        Category
        <select className={field} name="category" defaultValue="" required>
          <option value="" disabled>Choose a category</option>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold">
        Title
        <input className={field} name="title" placeholder="Lift stuck in Tower A" required minLength={3} maxLength={100} />
      </label>
      <label className="grid gap-1 text-sm font-bold">
        What happened?
        <textarea className={field} name="detail" required minLength={5} maxLength={800} rows={3} />
      </label>
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send complaint"}</button>
      <FormFeedback state={state} />
    </form>
  );
}

export function UpdateComplaintForm({ id, current }: { id: string; current: "open" | "assigned" | "in_progress" }) {
  const [state, action, pending] = useActionState(updateComplaintAction, {});
  const next = { open: ["assigned", "Assign complaint"], assigned: ["in_progress", "Start work"], in_progress: ["resolved", "Resolve complaint"] }[current];
  return (
    <form action={action} aria-busy={pending} className="grid gap-2 mt-3 pt-3 border-t border-line">
      <input type="hidden" name="complaintId" value={id} />
      <input type="hidden" name="status" value={next[0]} />
      {current === "open" && (
        <label className="grid gap-1 text-sm font-bold">
          Staff member or team
          <input className={field} name="assignee" required maxLength={80} />
        </label>
      )}
      <label className="grid gap-1 text-sm font-bold">
        Update for the resident <span className="font-normal text-ink-500">(optional)</span>
        <textarea className={field} name="note" maxLength={400} rows={2} />
      </label>
      <button className="btn btn-quiet" disabled={pending}>{pending ? "Saving…" : next[1]}</button>
      <FormFeedback state={state} />
    </form>
  );
}
