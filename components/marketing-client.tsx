"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitSocietyLead, submitVendorLead, type ActionState } from "@/app/actions";

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
          <Link href="/#request" onClick={() => setOpen(false)} className="btn btn-primary px-3 text-[14px]">
            Set up society
          </Link>
        </div>
      </nav>
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
      <span className="text-[13px] font-semibold">
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
      <p role="status" className="card p-4 bg-save-50 border-save-500/30 text-sm font-semibold text-save-700 flex gap-2">
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
          <span className="text-[13px] font-semibold">You are</span>
          <select name="role" defaultValue="resident" className="card mk-input px-3 py-2.5 w-full min-w-0">
            <option value="resident">A resident</option>
            <option value="secretary">Secretary / committee member</option>
            <option value="facility">Facility manager</option>
          </select>
        </label>
      </div>
      <button className="btn btn-primary w-full sm:w-auto sm:self-start mt-1" disabled={pending}>
        {pending ? "Sending…" : "Request a setup call"}
      </button>
      <Result state={state} />
      <p className="text-[12px] text-ink-500">We use this number only to call you about setting up your society.</p>
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
        <legend className="text-[13px] font-semibold mb-2">Services you offer</legend>
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
