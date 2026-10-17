"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveDealAction, commentAction, completeJobAction, expireAction, lockAction,
  raiseDisputeAction, rateAction, resolveDisputeAction, setLanguage, simulateAction,
  startJobAction, startServiceAction, updateSlabsAction, type ActionState,
} from "@/app/actions";
import type { DealView } from "@/lib/types";

const empty: ActionState = {};

function useRefreshOnOk(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    // Deferred out of the action's transition — inside it, the form would stay
    // pending until the server components refetch.
    const id = setTimeout(() => router.refresh(), 0);
    return () => clearTimeout(id);
  }, [state, router]);
}

export function CommentForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState(commentAction, empty);
  const [body, setBody] = useState("");
  useRefreshOnOk(state);
  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  return (
    <form action={action} className="flex gap-2 items-center" aria-busy={pending}>
      <input type="hidden" name="dealId" value={dealId} />
      <input
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ask your neighbours something…"
        className="card flex-1 px-3 py-2.5 text-sm"
        aria-label="Add a comment"
      />
      <button className="btn btn-quiet" disabled={pending || !body.trim()}>
        {pending ? "…" : "Post"}
      </button>
      {state.error && <span className="text-[12px] text-danger-600">{state.error}</span>}
    </form>
  );
}

export function QuickReplies({ dealId }: { dealId: string }) {
  const [, action, pending] = useActionState(commentAction, empty);
  const replies = ["I am in.", "Can we do Sunday instead?", "Does this cover the outdoor unit?"];
  return (
    <div className="flex gap-2 flex-wrap">
      {replies.map((r) => (
        <form action={action} key={r}>
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="body" value={r} />
          <button className="pill bg-canvas-alt text-ink-700 hover:bg-line" disabled={pending}>
            {r}
          </button>
        </form>
      ))}
    </div>
  );
}

export function SimulateJoins({ dealId, label = "Simulate 3 neighbours joining" }: { dealId: string; label?: string }) {
  const [state, action, pending] = useActionState(simulateAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="count" value={3} />
      <button className="btn btn-quiet w-full text-[13px]" disabled={pending}>
        {pending ? "Adding…" : label}
      </button>
      {state.error && <p className="text-[12px] text-danger-600 mt-1">{state.error}</p>}
    </form>
  );
}

export function OpsDealActions({ deal }: { deal: DealView }) {
  const [lockState, lock, locking] = useActionState(lockAction, empty);
  const [expState, expire, expiring] = useActionState(expireAction, empty);
  const [startState, start, starting] = useActionState(startServiceAction, empty);
  useRefreshOnOk(lockState);
  useRefreshOnOk(expState);
  useRefreshOnOk(startState);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {deal.status === "open" && (
        <>
          <form action={lock}>
            <input type="hidden" name="dealId" value={deal.id} />
            <button className="btn btn-save h-9 min-h-9 text-[13px]" disabled={locking || deal.flatsJoined < deal.mvs}>
              Lock now
            </button>
          </form>
          <form action={expire}>
            <input type="hidden" name="dealId" value={deal.id} />
            <button className="btn btn-quiet h-9 min-h-9 text-[13px]" disabled={expiring}>
              Close without charge
            </button>
          </form>
        </>
      )}
      {deal.status === "locked" && (
        <form action={start}>
          <input type="hidden" name="dealId" value={deal.id} />
          <button className="btn btn-primary h-9 min-h-9 text-[13px]" disabled={starting}>
            Start service day
          </button>
        </form>
      )}
      {[lockState.error, expState.error, startState.error].filter(Boolean).map((e) => (
        <span key={e} className="text-[12px] text-danger-600">
          {e}
        </span>
      ))}
    </div>
  );
}

export function CompleteJobForm({ jobId, endOtp }: { jobId: string; endOtp: string }) {
  const [state, action, pending] = useActionState(completeJobAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} className="flex gap-2 items-center" aria-busy={pending}>
      <input type="hidden" name="jobId" value={jobId} />
      <input
        name="otp"
        placeholder={`OTP (${endOtp})`}
        className="card px-3 py-2 text-sm w-32 tnum"
        aria-label="Completion OTP from the resident"
      />
      <button className="btn btn-save h-9 min-h-9 text-[13px]" disabled={pending}>
        {pending ? "…" : "Complete"}
      </button>
      {state.error && <span className="text-[12px] text-danger-600">{state.error}</span>}
    </form>
  );
}

export function RateForm({ jobId, current }: { jobId: string; current: number | null }) {
  const [state, action, pending] = useActionState(rateAction, empty);
  const [score, setScore] = useState(current ?? 0);
  useRefreshOnOk(state);
  if (current) return <p className="text-sm text-ink-500">You rated this {current}/5. Thanks.</p>;
  return (
    <form action={action} className="flex items-center gap-2 flex-wrap" aria-busy={pending}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="score" value={score} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => setScore(n)}
          aria-label={`${n} out of 5`}
          className={`w-9 h-9 rounded-full font-bold text-sm ${
            n <= score ? "bg-save-600 text-white" : "bg-canvas-alt text-ink-500"
          }`}
        >
          {n}
        </button>
      ))}
      <input name="note" placeholder="Anything to add?" className="card px-3 py-2 text-sm flex-1 min-w-[140px]" />
      <button className="btn btn-quiet h-9 min-h-9 text-[13px]" disabled={pending || !score}>
        Submit
      </button>
    </form>
  );
}

export function SlabEditor({ deal }: { deal: DealView }) {
  const [state, action, pending] = useActionState(updateSlabsAction, empty);
  useRefreshOnOk(state);
  const rows = [0, 1, 2, 3].map((i) => deal.slabs[i]);
  return (
    <form action={action} className="card p-4" aria-busy={pending}>
      <input type="hidden" name="dealId" value={deal.id} />
      <p className="eyebrow mb-3">Your price ladder · list {Math.round(deal.listPricePaise / 100)}</p>
      <div className="flex flex-col gap-2">
        {rows.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <input
              name={`flats${i}`}
              defaultValue={s?.minFlats ?? ""}
              placeholder={deal.basisLabel}
              inputMode="numeric"
              className="card px-2 py-1.5 w-20 tnum"
              aria-label={`Slab ${i + 1} minimum flats`}
            />
            <span className="text-ink-500">{deal.basisLabel} →</span>
            <input
              name={`price${i}`}
              defaultValue={s ? Math.round(s.pricePaise / 100) : ""}
              placeholder="₹ per unit"
              inputMode="numeric"
              className="card px-2 py-1.5 w-28 tnum"
              aria-label={`Slab ${i + 1} price in rupees`}
            />
          </div>
        ))}
      </div>
      <button className="btn btn-primary mt-3 h-10 min-h-10 text-[14px]" disabled={pending || deal.status !== "open"}>
        {pending ? "Saving…" : "Save ladder"}
      </button>
      {state.error && <p className="text-[12px] text-danger-600 mt-2">{state.error}</p>}
      {state.ok && <p className="text-[12px] text-save-700 mt-2">{state.ok}</p>}
    </form>
  );
}

export function ApproveDealForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState(approveDealAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="dealId" value={dealId} />
      <button className="btn btn-save h-10 min-h-10 text-[14px] w-full" disabled={pending}>
        {pending ? "Approving…" : "Approve & announce to the society"}
      </button>
      {state.error && <p className="text-[12px] text-danger-600 mt-1">{state.error}</p>}
    </form>
  );
}

export function StartJobForm({ jobId, startOtp }: { jobId: string; startOtp: string }) {
  const [state, action, pending] = useActionState(startJobAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} className="flex gap-2 items-center" aria-busy={pending}>
      <input type="hidden" name="jobId" value={jobId} />
      <input
        name="otp"
        placeholder={`Start code (${startOtp})`}
        className="card px-3 py-2 text-sm w-40 tnum"
        aria-label="Start code from the resident"
      />
      <button className="btn btn-primary h-9 min-h-9 text-[13px]" disabled={pending}>
        {pending ? "…" : "Start"}
      </button>
      {state.error && <span className="text-[12px] text-danger-600">{state.error}</span>}
    </form>
  );
}

const DISPUTE_REASONS = [
  "Work not done properly",
  "Technician was late or did not come",
  "Something was damaged",
  "Charged more than the group price",
];

export function DisputeForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(raiseDisputeAction, empty);
  const [open, setOpen] = useState(false);
  useRefreshOnOk(state);

  if (!open) {
    return (
      <button className="btn btn-quiet h-9 min-h-9 text-[13px]" onClick={() => setOpen(true)}>
        Report an issue
      </button>
    );
  }
  return (
    <form action={action} className="card p-3 flex flex-col gap-2" aria-busy={pending}>
      <input type="hidden" name="jobId" value={jobId} />
      <label className="text-[12px] font-bold" htmlFor={`reason-${jobId}`}>
        What went wrong?
      </label>
      <select id={`reason-${jobId}`} name="reason" className="card px-2 py-2 text-sm">
        {DISPUTE_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <textarea
        name="detail"
        rows={2}
        placeholder="Anything that helps ops sort it out"
        className="card px-2 py-2 text-sm"
        aria-label="Details"
      />
      <div className="flex gap-2">
        <button type="button" className="btn btn-quiet h-9 min-h-9 text-[13px] flex-1" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn btn-primary h-9 min-h-9 text-[13px] flex-1" disabled={pending}>
          {pending ? "Sending…" : "Raise issue"}
        </button>
      </div>
      {state.error && <p className="text-[12px] text-danger-600">{state.error}</p>}
      {state.ok && <p className="text-[12px] text-save-700">{state.ok}</p>}
    </form>
  );
}

export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const [state, action, pending] = useActionState(resolveDisputeAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} className="flex flex-wrap gap-2 items-center" aria-busy={pending}>
      <input type="hidden" name="disputeId" value={disputeId} />
      <select name="resolution" className="card px-2 py-1.5 text-sm" aria-label="Outcome">
        <option value="refund">Refund in full</option>
        <option value="revisit">Vendor revisits</option>
        <option value="rejected">No action</option>
      </select>
      <input name="note" placeholder="What you told them" className="card px-2 py-1.5 text-sm flex-1 min-w-[160px]" />
      <button className="btn btn-primary h-9 min-h-9 text-[13px]" disabled={pending}>
        {pending ? "…" : "Close issue"}
      </button>
      {state.error && <span className="text-[12px] text-danger-600">{state.error}</span>}
    </form>
  );
}

export function ShareButton({ text, label = "Share to WhatsApp" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const data = { title: "JODO", text };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button className="btn btn-quiet w-full" onClick={share}>
      {copied ? "Copied — paste it in your society group" : label}
    </button>
  );
}

export function LanguageToggle({ current }: { current: "en" | "hi" }) {
  const [state, action, pending] = useActionState(setLanguage, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} className="flex gap-1.5" aria-busy={pending}>
      {([["en", "English"], ["hi", "हिंदी"]] as const).map(([code, label]) => (
        <button
          key={code}
          name="lang"
          value={code}
          disabled={pending}
          aria-pressed={current === code}
          className={`pill ${current === code ? "bg-brand-600 text-white" : "bg-canvas-alt text-ink-700"}`}
        >
          {label}
        </button>
      ))}
    </form>
  );
}
