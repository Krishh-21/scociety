"use client";

import { useActionState } from "react";
import { revokeFlatMembership } from "./actions";

export default function RevokeForm({ residencyId }: { residencyId: string }) {
  const [state, action, pending] = useActionState(revokeFlatMembership, {});
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-bold text-danger-600">Revoke access</summary>
      <form action={action} aria-busy={pending} className="mt-2 grid gap-2">
        <input type="hidden" name="residencyId" value={residencyId} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" value="yes" required className="mt-1" />
          Revoke this resident’s access and sign them out of JODO.
        </label>
        <button className="btn btn-quiet w-fit" type="submit" disabled={pending}>Confirm revocation</button>
        {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      </form>
    </details>
  );
}
