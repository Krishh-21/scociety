"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveDealAction, commentAction, completeJobAction, expireAction, lockAction, markLeadAction,
  raiseDisputeAction, rateAction, resetDemoAction, resolveDisputeAction, setLanguage, simulateAction,
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

// One question per service that neighbours actually ask, instead of an AC
// question showing up on a pest-control group.
const SERVICE_QUESTION: Record<string, string> = {
  sku_ac_service: "Does this cover the outdoor unit?",
  sku_deep_clean: "Do they bring their own supplies?",
  sku_car_wash: "Do they need water from our tap?",
  sku_pest: "Is it safe with kids and pets at home?",
};

export function QuickReplies({ dealId, skuId, joined }: { dealId: string; skuId: string; joined: boolean }) {
  const [state, action, pending] = useActionState(commentAction, empty);
  useRefreshOnOk(state);
  // "I'm in" only means something once you actually are.
  const replies = [
    joined ? "I'm in — who else?" : "Thinking about it — which slot are most people picking?",
    "Can we do a different day?",
    SERVICE_QUESTION[skuId] ?? "What's not included?",
  ];
  return (
    <div className="flex gap-2 flex-wrap" aria-busy={pending}>
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
            <button className="btn btn-save h-9 min-h-9 text-[13px]" disabled={locking || deal.basisCount < deal.mvs}>
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

/** `hint` is the resident's code, shown only in development so the demo can be driven alone. */
export function CompleteJobForm({ jobId, hint }: { jobId: string; hint?: string }) {
  const [state, action, pending] = useActionState(completeJobAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} className="flex gap-2 items-center" aria-busy={pending}>
      <input type="hidden" name="jobId" value={jobId} />
      <input
        name="otp"
        placeholder={hint ? `Code (${hint})` : "Resident's code"}
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

export function StartJobForm({ jobId, hint }: { jobId: string; hint?: string }) {
  const [state, action, pending] = useActionState(startJobAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} className="flex gap-2 items-center" aria-busy={pending}>
      <input type="hidden" name="jobId" value={jobId} />
      <input
        name="otp"
        placeholder={hint ? `Start code (${hint})` : "Start code"}
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

/**
 * Groups spread in the society WhatsApp group, so WhatsApp is the primary
 * button (a wa.me link opens the app with the text ready) and copying is the
 * fallback for every other group chat.
 */
export function ShareButton({ text, label = "Share to WhatsApp" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-whatsapp flex-1"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" />
        </svg>
        {label}
      </a>
      <button type="button" className="btn btn-quiet" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
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

export function ResetDemoButton() {
  const [state, action, pending] = useActionState(resetDemoAction, empty);
  const [armed, setArmed] = useState(false);
  useRefreshOnOk(state);
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-1.5">
      {armed ? (
        <div className="flex gap-2">
          <button className="btn btn-primary h-9 min-h-9 text-[13px]" disabled={pending}>
            {pending ? "Resetting…" : "Yes, reset everything"}
          </button>
          <button type="button" className="btn btn-quiet h-9 min-h-9 text-[13px]" onClick={() => setArmed(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-quiet h-9 min-h-9 text-[13px]" onClick={() => setArmed(true)}>
          Reset demo data
        </button>
      )}
      {state.ok && <p className="text-[12px] text-save-700">{state.ok}</p>}
      {state.error && <p className="text-[12px] text-danger-600">{state.error}</p>}
    </form>
  );
}

export function LeadStatusForm({ leadId, status }: { leadId: string; status: string }) {
  const [state, action, pending] = useActionState(markLeadAction, empty);
  useRefreshOnOk(state);
  return (
    <form action={action} aria-busy={pending} className="flex gap-1.5 flex-wrap">
      <input type="hidden" name="leadId" value={leadId} />
      {(["contacted", "won", "lost"] as const).map((s) => (
        <button
          key={s}
          name="status"
          value={s}
          disabled={pending || status === s}
          aria-pressed={status === s}
          className={`pill capitalize ${status === s ? "bg-brand-600 text-white" : "bg-canvas-alt text-ink-700"}`}
        >
          {s}
        </button>
      ))}
    </form>
  );
}
