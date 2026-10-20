"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitSocietyLead, submitVendorLead, type ActionState } from "@/app/actions";
import { currentPrice, nextSlab, rupees } from "@/lib/pricing";
import type { Slab } from "@/lib/types";

// ------------------------------------------------------------- mobile menu

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full grid place-items-center text-ink-700 hover:bg-canvas-alt"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Site"
          className="absolute left-0 right-0 top-16 bg-surface border-b border-line shadow-lg px-4 py-3 flex flex-col"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] font-semibold text-ink-700 border-b border-line last:border-0"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="btn btn-quiet mt-3">
            Sign in
          </Link>
        </nav>
      )}
    </div>
  );
}

// ------------------------------------------------------------ ladder demo

/**
 * The whole product in one control: drag the flat count and watch everyone's
 * price fall. Uses the real ladder from the catalogue, not made-up numbers.
 */
export function LadderDemo({
  serviceName,
  unitLabel,
  basisLabel,
  listPricePaise,
  slabs,
}: {
  serviceName: string;
  unitLabel: string;
  /** What the ladder counts — "AC units", "flats". */
  basisLabel: string;
  listPricePaise: number;
  slabs: Slab[];
}) {
  const max = Math.max(40, (slabs.at(-1)?.minFlats ?? 20) + 5);
  const [count, setCount] = useState(4);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const price = currentPrice(listPricePaise, slabs, count);
  const next = nextSlab(slabs, count);
  const saving = listPricePaise - price;
  const rows = [{ minFlats: 1, pricePaise: listPricePaise }, ...slabs].sort((a, b) => a.minFlats - b.minFlats);
  const target = slabs.at(-2)?.minFlats ?? slabs.at(-1)?.minFlats ?? 20;

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCount(target);
      setPlaying(false);
      return;
    }
    timer.current = setInterval(() => {
      setCount((c) => {
        if (c >= target) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 260);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, target]);

  return (
    <div className="card p-5 sm:p-6 shadow-xl shadow-ink-900/5">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow text-brand-700">Society announcement</p>
        <span className="pill bg-brand-50 text-brand-700">Filling</span>
      </div>
      <p className="text-[19px] font-extrabold leading-snug">{serviceName} — this Sunday</p>
      <p className="text-[13px] text-ink-500 mb-4">Green Valley Society · one vendor for the whole building</p>

      <div className="flex items-end gap-3 flex-wrap" aria-live="polite">
        <span className="tnum text-[46px] leading-none font-extrabold text-save-700 transition-all">{rupees(price)}</span>
        <span className="text-ink-500 text-sm pb-1.5">per {unitLabel}</span>
        {saving > 0 && <span className="tnum text-ink-300 line-through pb-1.5">{rupees(listPricePaise)}</span>}
      </div>
      <p className="text-[13px] font-bold text-save-700 h-5 mt-1">
        {saving > 0
          ? `Everyone saves ${rupees(saving)} — including the first flat that joined`
          : next
            ? `Solo price until ${next.minFlats} join — ${next.away} to go`
            : "Solo price"}
      </p>

      <label htmlFor="demo-count" className="flex items-baseline justify-between mt-5 mb-2">
        <span className="tnum text-[22px] font-extrabold">
          {count} <span className="text-sm font-semibold text-ink-500">{basisLabel} joined</span>
        </span>
        <span className="text-[12px] text-ink-500">
          {next ? `${next.away} more → ${rupees(next.pricePaise)}` : "Best price unlocked"}
        </span>
      </label>
      <input
        id="demo-count"
        type="range"
        min={1}
        max={max}
        value={count}
        onChange={(e) => {
          setPlaying(false);
          setCount(Number(e.target.value));
        }}
        className="w-full accent-[var(--color-save-600)]"
      />

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-4">
        {rows.map((s) => {
          const active = s.pricePaise === price;
          const unlocked = count >= s.minFlats;
          return (
            <li
              key={s.minFlats}
              className={`rounded-xl px-3 py-2 text-[13px] ${
                active ? "bg-save-50 ring-1 ring-save-500/40 text-save-700 font-bold" : unlocked ? "bg-canvas-alt text-ink-700" : "bg-canvas-alt text-ink-300"
              }`}
            >
              <span className="block tnum">{s.minFlats === 1 ? "Solo" : `${s.minFlats}+ ${basisLabel}`}</span>
              <span className="block tnum font-bold">{rupees(s.pricePaise)}</span>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={() => {
            if (count >= target) setCount(4);
            setPlaying(true);
          }}
          className="btn btn-save flex-1"
          disabled={playing}
        >
          {playing ? "Neighbours joining…" : "Watch neighbours join"}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setCount(4); }} className="btn btn-quiet">
          Reset
        </button>
      </div>
      <p className="text-[11px] text-ink-500 text-center mt-3">
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
      <span className="text-[13px] font-bold">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        className="card px-3 py-2.5 w-full min-w-0"
      />
    </label>
  );
}

function Result({ state }: { state: ActionState }) {
  if (state.ok) {
    return (
      <p role="status" className="card p-3 bg-save-50 border-save-500/30 text-sm font-bold text-save-700">
        {state.ok}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger-600">
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
          <select name="role" defaultValue="resident" className="card px-3 py-2.5 w-full min-w-0">
            <option value="resident">A resident</option>
            <option value="secretary">Secretary / committee member</option>
            <option value="facility">Facility manager</option>
          </select>
        </label>
      </div>
      <button className="btn btn-primary w-full sm:w-auto sm:self-start" disabled={pending}>
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
            <label key={s} className="pill bg-canvas-alt text-ink-700 cursor-pointer has-[:checked]:bg-brand-600 has-[:checked]:text-white">
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
