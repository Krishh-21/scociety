"use client";

import { useActionState } from "react";
import { reviewFlatRequest } from "./actions";

export default function ReviewForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(reviewFlatRequest, {});
  return (
    <form action={action} aria-busy={pending} className="mt-3 grid gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="approve" className="btn btn-primary" disabled={pending}>Approve</button>
        <button type="submit" name="decision" value="reject" className="btn btn-quiet" disabled={pending}>Decline</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </form>
  );
}
