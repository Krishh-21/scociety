"use client";

import { useActionState } from "react";
import { changeGuardAccess, type GuardFormState } from "./actions";

function Feedback({ state }: { state: GuardFormState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-save-700">{state.ok}</p>}
    </>
  );
}

export function AddGuardForm() {
  const [state, action, pending] = useActionState(changeGuardAccess, {});
  return (
    <form action={action} aria-busy={pending} className="grid gap-2 mt-3">
      <input type="hidden" name="mode" value="add" />
      <label className="grid gap-1 text-sm font-bold">
        Name
        <input name="name" required minLength={2} maxLength={60} className="card px-3 py-2 text-sm font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-bold">
        Mobile number
        <input name="phone" type="tel" inputMode="numeric" required pattern="[6-9][0-9]{9}" className="card px-3 py-2 text-sm font-normal" />
      </label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Add guard"}</button>
      <Feedback state={state} />
    </form>
  );
}

export function GuardToggleForm({ guardId, active }: { guardId: string; active: boolean }) {
  const [state, action, pending] = useActionState(changeGuardAccess, {});
  return (
    <form action={action} aria-busy={pending} className="grid gap-2 mt-2">
      <input type="hidden" name="mode" value={active ? "disable" : "enable"} />
      <input type="hidden" name="guardId" value={guardId} />
      <button className="btn btn-quiet w-fit" disabled={pending}>{pending ? "Saving…" : active ? "Pause access" : "Restore access"}</button>
      <Feedback state={state} />
    </form>
  );
}
