"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { submitSocietyLead, submitVendorLead, type ActionState } from "@/app/actions";
import { currentPrice, nextSlab, rupees } from "@/lib/pricing";
import type { Slab } from "@/lib/types";

// ------------------------------------------------------------- mobile menu

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus into the menu, close on Escape (returning focus) or an outside click.
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const onResize = () => window.matchMedia("(min-width: 768px)").matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full grid place-items-center text-ink-900 hover:bg-canvas-alt"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav
        ref={panel}
        id="mobile-menu"
        aria-label="Site menu"
        hidden={!open}
        className="absolute left-0 right-0 top-16 bg-surface border-b border-line shadow-xl shadow-black/10 px-4 pt-2 pb-4"
      >
        <ul className="flex flex-col">
          {links.map((l) => (
            <li key={l.href} className="border-b border-line last:border-0">
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between py-3.5 text-[16px] font-semibold text-ink-900 rounded"
              >
                {l.label}
                <span aria-hidden="true" className="text-ink-300">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Link href="/login" onClick={() => setOpen(false)} className="btn mk-btn-outline">
            Sign in
          </Link>
          <Link href="/#societies" onClick={() => setOpen(false)} className="btn btn-primary px-3 text-[14px]">
            Request JODO
          </Link>
        </div>
      </nav>
    </div>
  );
}

// ------------------------------------------------------------ ladder demo

export type LadderService = {
  id: string;
  name: string;
  /** Short name for the service switcher — "AC service". */
  shortName: string;
  unitLabel: string;
  /** What the ladder counts — "AC units", "flats". */
  basisLabel: string;
  listPricePaise: number;
  slabs: Slab[];
};

const START = 4;

/**
 * The whole product in one control: drag the count and watch everyone's price fall.
 * Every service, list price and slab comes from the live catalogue — nothing made up.
 */
export function LadderDemo({ services, initialId }: { services: LadderService[]; initialId?: string }) {
  const [serviceId, setServiceId] = useState(initialId ?? services[0]?.id);
  const svc = services.find((s) => s.id === serviceId) ?? services[0];
  const [count, setCount] = useState(START);
  const [playing, setPlaying] = useState(false);
  const sliderId = useId();
  const hintId = useId();

  const slabs = svc ? [...svc.slabs].sort((a, b) => a.minFlats - b.minFlats) : [];
  const max = Math.max(40, (slabs.at(-1)?.minFlats ?? 20) + 5);
  const target = slabs.at(-2)?.minFlats ?? slabs.at(-1)?.minFlats ?? 20;

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(target);
      setPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setCount((c) => {
        if (c >= target) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 240);
    return () => clearInterval(timer);
  }, [playing, target]);

  if (!svc) return null;

  const price = currentPrice(svc.listPricePaise, slabs, count);
  const next = nextSlab(slabs, count);
  const saving = svc.listPricePaise - price;
  const rows = [{ minFlats: 1, pricePaise: svc.listPricePaise }, ...slabs];
  const pct = ((count - 1) / (max - 1)) * 100;
  const marks = new Set(slabs.map((s) => s.minFlats));

  const pick = (id: string) => {
    setPlaying(false);
    setServiceId(id);
    setCount(START);
  };

  return (
    <div className="mk-forest rounded-[28px] p-5 sm:p-7 shadow-2xl shadow-[#132c24]/25 relative overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-white/55">Live price ladder</p>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#dce99e]">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#dce99e] motion-safe:animate-pulse" />
          Filling
        </span>
      </div>

      {services.length > 1 && (
        <div role="group" aria-label="Choose a service" className="flex flex-wrap gap-1.5 mt-4">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === svc.id}
              onClick={() => pick(s.id)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors ${
                s.id === svc.id ? "bg-[#dce99e] text-[#132c24]" : "bg-white/8 text-white/80 hover:bg-white/15"
              }`}
            >
              {s.shortName}
            </button>
          ))}
        </div>
      )}

      <p className="text-[18px] sm:text-[20px] font-extrabold leading-snug mt-5">{svc.name}</p>
      <p className="text-[13px] text-white/60">Green Valley Society · one vendor, one Sunday</p>

      <div className="flex items-end gap-x-3 gap-y-1 flex-wrap mt-5">
        <span className="tnum text-[48px] sm:text-[60px] leading-none font-extrabold tracking-tight text-[#dce99e]">
          {rupees(price)}
        </span>
        <span className="text-white/60 text-[14px] pb-2">per {svc.unitLabel}</span>
        {saving > 0 && <span className="tnum text-white/65 line-through pb-2 text-[14px]">{rupees(svc.listPricePaise)}</span>}
      </div>
      <p className="text-[13px] font-semibold text-white/80 min-h-10 sm:min-h-5 mt-2">
        {saving > 0
          ? `Everyone saves ${rupees(saving)} — including the first flat that joined.`
          : next
            ? `Solo price until ${next.minFlats} ${svc.basisLabel} join.`
            : "Solo price."}
      </p>
      {/* Announce only when the price changes, not on every step of the slider. */}
      <p className="sr-only" aria-live="polite">
        {`${svc.name}: ${rupees(price)} per ${svc.unitLabel}.`}
      </p>

      {/* The tower: one window per joiner. */}
      <div aria-hidden="true" className="grid grid-cols-10 gap-1 sm:gap-1.5 mt-5">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="mk-window" data-lit={i < count} data-mark={marks.has(i + 1) && i >= count} />
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-5 mb-1">
        <label htmlFor={sliderId} className="tnum text-[22px] font-extrabold">
          {count} <span className="text-[14px] font-semibold text-white/60">{svc.basisLabel} joined</span>
        </label>
        <span id={hintId} className="text-[12px] text-white/60 text-right">
          {next ? `${next.away} more → ${rupees(next.pricePaise)}` : "Best price unlocked"}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={1}
        max={max}
        value={count}
        aria-describedby={hintId}
        aria-valuetext={`${count} ${svc.basisLabel} joined, ${rupees(price)} each`}
        style={{ ["--pct" as string]: `${pct}%` }}
        onChange={(e) => {
          setPlaying(false);
          setCount(Number(e.target.value));
        }}
        className="mk-range"
      />

      <ol className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-4" aria-label={`${svc.shortName} price ladder`}>
        {rows.map((s) => {
          const active = s.pricePaise === price;
          const unlocked = count >= s.minFlats;
          return (
            <li
              key={s.minFlats}
              aria-current={active ? "step" : undefined}
              className={`rounded-xl px-3 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-[#dce99e] text-[#132c24]"
                  : unlocked
                    ? "bg-white/10 text-white/80"
                    : "bg-white/[0.04] text-white/65"
              }`}
            >
              <span className="block tnum">{s.minFlats === 1 ? "Solo" : `${s.minFlats}+ ${svc.basisLabel}`}</span>
              <span className="block tnum font-extrabold text-[15px]">{rupees(s.pricePaise)}</span>
            </li>
          );
        })}
      </ol>

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={() => {
            if (count >= target) setCount(START);
            setPlaying(true);
          }}
          className="btn mk-btn-lime flex-1 px-3 text-[14px] sm:text-[15px] whitespace-nowrap"
          disabled={playing}
        >
          {playing ? "Neighbours joining…" : "Watch neighbours join"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setCount(START);
          }}
          className="btn mk-btn-ghost-light px-4"
        >
          Reset
        </button>
      </div>
      <p className="text-[12px] text-white/50 text-center mt-3">
        Real ladder from our catalogue. ₹0 is charged until the group locks.
      </p>
    </div>
  );
}

// ------------------------------------------------------------ lead forms

const empty: ActionState = {};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel";
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[13px] font-bold">
        {label}
        {!required && <span className="font-semibold text-ink-500"> (optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        className="card mk-input px-3 py-2.5 w-full min-w-0"
      />
    </label>
  );
}

function Result({ state }: { state: ActionState }) {
  if (state.ok) {
    return (
      <p role="status" className="card p-4 bg-save-50 border-save-500/30 text-sm font-bold text-save-700 flex gap-2">
        <span aria-hidden="true">✓</span>
        {state.ok}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-danger-600">
        {state.error}
      </p>
    );
  }
  return null;
}

export function SocietyLeadForm() {
  const [state, action, pending] = useActionState(submitSocietyLead, empty);
  if (state.ok) return <Result state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3" aria-busy={pending}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Your name" name="name" autoComplete="name" />
        <Field label="Mobile number" name="phone" inputMode="tel" placeholder="10 digits" autoComplete="tel-national" />
        <Field label="Society" name="society" placeholder="e.g. Palm Grove Residency" />
        <Field label="City" name="city" placeholder="e.g. Pune" autoComplete="address-level2" />
        <Field label="Number of flats" name="flats" inputMode="numeric" placeholder="approx." required={false} />
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[13px] font-bold">You are</span>
          <select name="role" defaultValue="resident" className="card mk-input px-3 py-2.5 w-full min-w-0">
            <option value="resident">A resident</option>
            <option value="secretary">Secretary / committee member</option>
            <option value="facility">Facility manager</option>
          </select>
        </label>
      </div>
      <button className="btn btn-primary w-full sm:w-auto sm:self-start mt-1" disabled={pending}>
        {pending ? "Sending…" : "Request JODO for my society"}
      </button>
      <Result state={state} />
      <p className="text-[12px] text-ink-500">We only use this number to call you about setting up your society.</p>
    </form>
  );
}

const SERVICES = ["AC service", "Deep cleaning", "Car wash", "Pest control", "Water-tank cleaning", "Painting", "Appliance repair"];

export function VendorLeadForm() {
  const [state, action, pending] = useActionState(submitVendorLead, empty);
  if (state.ok) return <Result state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" aria-busy={pending}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Your name" name="name" autoComplete="name" />
        <Field label="Mobile number" name="phone" inputMode="tel" placeholder="10 digits" autoComplete="tel-national" />
        <Field label="Business name" name="business" autoComplete="organization" />
        <Field label="City" name="city" autoComplete="address-level2" />
        <Field label="Technicians in your crew" name="crew" inputMode="numeric" required={false} />
      </div>
      <fieldset>
        <legend className="text-[13px] font-bold mb-2">Services you offer</legend>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <label
              key={s}
              className="pill cursor-pointer select-none bg-canvas-alt text-ink-700 border border-line py-2 px-3 text-[13px] hover:border-ink-300 has-[:checked]:bg-brand-600 has-[:checked]:border-brand-600 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600"
            >
              <input type="checkbox" name="services" value={s} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn btn-primary w-full sm:w-auto sm:self-start" disabled={pending}>
        {pending ? "Sending…" : "Apply to be a partner"}
      </button>
      <Result state={state} />
    </form>
  );
}
