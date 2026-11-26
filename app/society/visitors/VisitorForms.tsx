"use client";

import { useActionState } from "react";
import {
  cancelVisitAction, createGuestPassAction, decideVisitAction, logVisitAction,
  recordVisitMovementAction, redeemGuestPassAction, revokeGuestPassAction, type VisitorActionState,
} from "./actions";

const empty: VisitorActionState = {};
const inputClass = "card min-h-11 w-full min-w-0 px-3 text-sm font-normal text-ink-900";
const passExpiry = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function FormMessage({ state }: { state: VisitorActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-save-700">{state.ok}</p>}
    </>
  );
}

export function LogVisitForm({ flats }: { flats: { id: string; flat: string; name: string }[] }) {
  const [state, action, pending] = useActionState(logVisitAction, empty);
  if (!flats.length) return <p className="text-sm text-ink-500">There are no verified flats in this society yet.</p>;

  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13px] font-bold">
        Visitor name or delivery service
        <input name="name" className={inputClass} maxLength={60} required />
      </label>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-[13px] font-bold">
          Visitor type
          <select name="kind" className={inputClass} defaultValue="guest">
            <option value="guest">Guest</option>
            <option value="delivery">Delivery</option>
            <option value="help">Home help</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] font-bold">
          Flat to visit
          <select name="residencyId" className={inputClass} defaultValue="" required>
            <option value="" disabled>Choose a flat</option>
            {flats.map(({ id, flat, name }) => <option key={id} value={id}>{flat} · {name}</option>)}
          </select>
        </label>
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Request entry"}</button>
      <FormMessage state={state} />
      {state.visitId && (
        <a href={`#visit-${state.visitId}`} className="self-start text-sm font-bold text-brand-700 underline">
          View entry ticket
        </a>
      )}
    </form>
  );
}

export function VisitDecisionForm({ visitId }: { visitId: string }) {
  const [state, action, pending] = useActionState(decideVisitAction, empty);
  return (
    <form action={action} aria-busy={pending} className="mt-3 space-y-2">
      <input type="hidden" name="visitId" value={visitId} />
      <div className="flex gap-2">
        <button className="btn btn-save flex-1 min-h-10 px-3 text-sm" name="decision" value="approved" disabled={pending}>
          Approve entry
        </button>
        <button className="btn flex-1 min-h-10 px-3 text-sm bg-danger-50 text-danger-600" name="decision" value="denied" disabled={pending}>
          Deny entry
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function VisitMovementForm({ visitId, direction }: { visitId: string; direction: "in" | "out" }) {
  const [state, action, pending] = useActionState(recordVisitMovementAction, empty);
  return (
    <form action={action} aria-busy={pending} className="mt-3 space-y-2">
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="direction" value={direction} />
      <button className="btn btn-primary min-h-10 px-4 text-sm" disabled={pending}>
        {pending ? "Saving…" : direction === "in" ? "Check in" : "Check out"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function CancelVisitForm({ visitId }: { visitId: string }) {
  const [state, action, pending] = useActionState(cancelVisitAction, empty);
  return (
    <form action={action} aria-busy={pending} className="mt-3 space-y-2">
      <input type="hidden" name="visitId" value={visitId} />
      <button className="btn btn-quiet min-h-10 px-4 text-sm" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel ticket"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function CreateGuestPassForm({ activePassIds }: { activePassIds: string[] }) {
  const [state, action, pending] = useActionState(createGuestPassAction, empty);
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13px] font-bold">
        Guest name
        <input name="name" className={inputClass} maxLength={60} required />
      </label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create guest pass"}</button>
      <FormMessage state={state} />
      {state.code && state.expiresAt && state.passId && activePassIds.includes(state.passId) && (
        <div role="status" className="rounded-xl bg-brand-50 p-3">
          <p className="text-[13px] font-bold text-brand-700">Guest pass ready</p>
          <code className="mt-1 block text-lg font-bold tracking-wider text-brand-700 select-all">{state.code}</code>
          <p className="mt-1 text-[13px] text-ink-700">
            Copy this code to share with your guest. It only appears here and expires on {passExpiry.format(new Date(state.expiresAt))} IST.
          </p>
        </div>
      )}
    </form>
  );
}

export function RevokeGuestPassForm({ passId }: { passId: string }) {
  const [state, action, pending] = useActionState(revokeGuestPassAction, empty);
  return (
    <form action={action} aria-busy={pending} className="mt-2 space-y-2">
      <input type="hidden" name="passId" value={passId} />
      <button className="btn btn-quiet min-h-10 px-3 text-sm" disabled={pending}>
        {pending ? "Revoking…" : "Revoke pass"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function RedeemGuestPassForm() {
  const [state, action, pending] = useActionState(redeemGuestPassAction, empty);
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13px] font-bold">
        Pass code
        <input name="code" className={`${inputClass} font-mono uppercase`} maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} required />
      </label>
      <button className="btn btn-quiet" disabled={pending}>{pending ? "Checking…" : "Use guest pass"}</button>
      <FormMessage state={state} />
    </form>
  );
}
