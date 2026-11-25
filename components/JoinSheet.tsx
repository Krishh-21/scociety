"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinAction, leaveAction, type ActionState } from "@/app/actions";
import { currentPrice, effectivePrice, rupees } from "@/lib/pricing";
import type { DealView } from "@/lib/types";
import { ShareButton } from "./forms";

const empty: ActionState = {};
const focusableSelector = 'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type JoinLabels = {
  join: string; youreIn: string; leave: string; howMany: string; pickSlot: string;
  howPay: string; confirm: string; continue: string; back: string; cancel: string;
  nothingNow: string; share: string;
};

const EN: JoinLabels = {
  join: "Join group", youreIn: "You're in", leave: "Leave", howMany: "How many",
  pickSlot: "Pick your slot", howPay: "How will you pay?", confirm: "Confirm & join",
  continue: "Continue", back: "Back", cancel: "Cancel",
  nothingNow: "₹0 charged now · you pay the final group price, whatever it falls to.",
  share: "Share to WhatsApp",
};

export default function JoinSheet({
  deal,
  canJoin,
  labels,
  share,
}: {
  deal: DealView;
  canJoin: boolean;
  labels?: Partial<JoinLabels>;
  share: string;
}) {
  const t = { ...EN, ...labels };
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState(1);
  const [slot, setSlot] = useState<string>();
  const [pay, setPay] = useState<"upi" | "card" | "cash">("upi");
  const [justJoined, setJustJoined] = useState(false);
  const [state, action, pending] = useActionState(joinAction, empty);
  const [leaveState, leave, leaving] = useActionState(leaveAction, empty);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const slabIfIJoin = currentPrice(
    deal.listPricePaise,
    deal.slabs,
    deal.basisCount + (deal.basis === "units" ? units : 1),
  );
  const priceIfIJoin = effectivePrice(slabIfIJoin, deal.floorPricePaise);
  const joined = !!deal.joinedByMe;
  const maxUnits = Math.min(10, Math.max(0, ...deal.slotLoad.map((s) => s.capacity - s.used)));
  const roomInSlot = (s: string) => {
    const load = deal.slotLoad.find((l) => l.slot === s);
    return load ? load.capacity - load.used : 0;
  };
  const selectedSlot = slot ?? deal.slotLoad.find((s) => s.capacity - s.used >= units)?.slot;
  const slotAvailable = selectedSlot !== undefined && roomInSlot(selectedSlot) >= units;
  let availabilityMessage: string | undefined;
  if (maxUnits === 0) {
    availabilityMessage = "All service slots are full.";
  } else if (units > maxUnits) {
    availabilityMessage = step === 1
      ? "Choose fewer units to fit an available slot."
      : "Go back and choose fewer units to fit an available slot.";
  } else if (step > 1 && !slotAvailable) {
    availabilityMessage = step === 2
      ? "This slot no longer has enough room. Pick another slot."
      : "This slot no longer has enough room. Go back and pick another slot.";
  }

  function changeUnits(next: number) {
    setUnits(next);
    if (slot !== undefined && roomInSlot(slot) < next) setSlot(undefined);
  }

  function continueJoin() {
    // Confirm the exact slot shown in step two so a refresh cannot swap it later.
    if (step === 2) setSlot(selectedSlot);
    setStep(step + 1);
  }

  const close = useCallback(() => {
    setOpen(false);
    setStep(1);
    setJustJoined(false);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.ok === "joined") {
      setJustJoined(true);
      setStep(4);
    } else if (!state.error) {
      return;
    }
    // Outside the action's transition: calling router.refresh() inside it keeps
    // useActionState pending until the whole tree refetches.
    const id = setTimeout(() => router.refresh(), 0);
    return () => clearTimeout(id);
  }, [state, router]);

  useEffect(() => {
    if (leaveState.ok !== "left") return;
    const id = setTimeout(() => router.refresh(), 0);
    return () => clearTimeout(id);
  }, [leaveState, router]);

  // Dialog manners: Escape closes it, focus starts inside, and focus goes back
  // to the button that opened it.
  useEffect(() => {
    if (!open || deal.status !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    sheetRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [close, deal.status, open, step]);

  if (deal.status !== "open") return null;

  return (
    <>
      <div className="jd-joinbar" aria-busy={pending || leaving}>
        {joined ? (
          <div className="flex gap-3 items-center">
            <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-save-50 text-save-700 grid place-items-center font-extrabold">✓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-save-700">
                {t.youreIn} · {deal.joinedByMe!.slot}
              </p>
              <p className="text-[12px] text-ink-500">
                {deal.joinedByMe!.units} {deal.sku.unitLabel}
                {deal.joinedByMe!.units > 1 ? "s" : ""} · pay{" "}
                {rupees(deal.currentPricePaise * deal.joinedByMe!.units)} when the group locks
              </p>
            </div>
            <form action={leave}>
              <input type="hidden" name="dealId" value={deal.id} />
              <button className="btn btn-quiet" disabled={leaving}>
                {leaving ? "…" : t.leave}
              </button>
            </form>
          </div>
        ) : (
          <>
            <button
              ref={openerRef}
              className="btn btn-save w-full"
              onClick={() => setOpen(true)}
              disabled={!canJoin || maxUnits === 0}
              title={canJoin ? "" : "Verify your flat to join"}
            >
              {maxUnits === 0 ? "All slots full" : `${t.join} · ${rupees(priceIfIJoin)}`}
            </button>
            {maxUnits > 0 && (
              <p className="text-[11px] text-ink-500 text-center mt-1.5">
                ₹0 now · the final price may fall further
              </p>
            )}
          </>
        )}
        {leaveState.error && (
          <p role="alert" className="text-[12px] text-danger-600 mt-2">{leaveState.error}</p>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#0b1a15]/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-6"
          onClick={close}
          aria-busy={pending}
        >
          <div
            ref={sheetRef}
            className="jd-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${t.join} — ${deal.sku.name}`}
            aria-describedby={justJoined ? undefined : "join-sheet-total"}
          >
            {justJoined ? (
              <>
                <h2 className="text-[19px] font-extrabold mb-1">{t.youreIn}</h2>
                <p className="text-sm text-ink-500 mb-4">
                  {units} {deal.sku.unitLabel}
                  {units > 1 ? "s" : ""} · {selectedSlot}. Nothing is charged until the group locks. Now bring a neighbour —
                  every one of them lowers what you pay.
                </p>
                <div className="flex flex-col gap-2">
                  <ShareButton text={share} label={t.share} />
                  <button className="btn btn-primary w-full" onClick={close}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="eyebrow">{deal.sku.name}</p>
                  <p className="text-[12px] font-bold text-ink-500 tnum">Step {step} of 3</p>
                </div>
                <div className="flex gap-1.5 mb-5" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-brand-600" : "bg-canvas-alt"}`} />
                  ))}
                </div>

                {step === 1 && (
                  <>
                    <h2 className="text-[19px] font-extrabold mb-1">
                      {t.howMany} {deal.sku.unitLabel}s?
                    </h2>
                    <p className="text-sm text-ink-500 mb-4">You pay the group price for each one.</p>
                    <div className="flex items-center gap-4 mb-6">
                      <button
                        className="btn btn-quiet w-12"
                        onClick={() => changeUnits(units - 1)}
                        aria-label="Fewer"
                        disabled={units <= 1}
                      >
                        −
                      </button>
                      <span className="tnum text-[32px] font-extrabold w-10 text-center">{units}</span>
                      <button
                        className="btn btn-quiet w-12"
                        onClick={() => changeUnits(units + 1)}
                        aria-label="More"
                        disabled={units >= maxUnits}
                      >
                        +
                      </button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 className="text-[19px] font-extrabold mb-1">{t.pickSlot}</h2>
                    <p className="text-sm text-ink-500 mb-4">
                      {new Date(deal.serviceDate).toLocaleDateString("en-IN", {
                        weekday: "long", day: "numeric", month: "long",
                      })}{" "}
                      · one crew, {deal.sku.unitsPerSlot} {deal.basisLabel} per slot
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {deal.slotLoad.map((s) => {
                        const left = s.capacity - s.used;
                        const tooFull = left < units;
                        const selected = !tooFull && selectedSlot === s.slot;
                        return (
                          <button
                            key={s.slot}
                            onClick={() => setSlot(s.slot)}
                            disabled={tooFull}
                            aria-pressed={selected}
                            className={`card p-3 text-sm font-bold text-left ${
                              selected ? "ring-2 ring-brand-600 text-brand-700" : "text-ink-700"
                            } ${tooFull ? "opacity-40" : ""}`}
                          >
                            {s.slot}
                            <span className="block text-[11px] font-medium text-ink-500">
                              {left <= 0 ? "Full" : `${left} left`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h2 className="text-[19px] font-extrabold mb-1">{t.howPay}</h2>
                    <p className="text-sm text-ink-500 mb-4">Nothing is charged until the group locks.</p>
                    <div className="flex flex-col gap-2 mb-4">
                      {([
                        ["upi", "UPI AutoPay mandate", "Charged only when the group locks. Released instantly if it doesn't."],
                        ["card", "Card pre-authorisation", "We hold, not charge, until lock."],
                        ["cash", "Cash to the technician", "No escrow, no warranty cover. Not recommended."],
                      ] as const).map(([k, label, note]) => (
                        <button
                          key={k}
                          onClick={() => setPay(k)}
                          className={`card p-3 text-left ${pay === k ? "ring-2 ring-brand-600" : ""}`}
                          aria-pressed={pay === k}
                        >
                          <p className="font-bold text-sm">{label}</p>
                          <p className={`text-[12px] ${k === "cash" ? "text-warn-600" : "text-ink-500"}`}>{note}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div id="join-sheet-total" className="rounded-2xl bg-canvas-alt p-3.5 mb-4 flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-700">
                    {units} × {deal.sku.unitLabel}
                  </span>
                  <span className="tnum text-[18px] font-extrabold text-save-700">{rupees(priceIfIJoin * units)}</span>
                </div>

                <div className="flex gap-2">
                  <button className="btn btn-quiet flex-1" onClick={() => (step === 1 ? close() : setStep(step - 1))}>
                    {step === 1 ? t.cancel : t.back}
                  </button>
                  {step < 3 ? (
                    <button
                      className="btn btn-primary flex-[2]"
                      onClick={continueJoin}
                      disabled={step === 1 ? units > maxUnits : !slotAvailable}
                    >
                      {t.continue}
                    </button>
                  ) : (
                    <form action={action} className="flex-[2]">
                      <input type="hidden" name="dealId" value={deal.id} />
                      <input type="hidden" name="units" value={units} />
                      <input type="hidden" name="slot" value={selectedSlot ?? ""} />
                      <input type="hidden" name="paymentMethod" value={pay} />
                      <button className="btn btn-save w-full" disabled={pending || !slotAvailable}>
                        {pending ? "Joining…" : t.confirm}
                      </button>
                    </form>
                  )}
                </div>
                <p className="text-[11px] text-ink-500 text-center mt-3">{t.nothingNow}</p>
                {availabilityMessage && (
                  <p role="status" className="text-[12px] text-warn-600 text-center mt-2">{availabilityMessage}</p>
                )}
                {step === 3 && state.error && (
                  <p role="alert" className="text-[12px] text-danger-600 text-center mt-2">{state.error}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
