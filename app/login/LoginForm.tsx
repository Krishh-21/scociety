"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Logo } from "@/components/marketing";
import { verifyOtp, type ActionState } from "@/app/actions";
import "@/components/app-shell.css";

const DEMO = [
  ["9000000001", "Rahul Mehta", "Resident · A-402, Green Valley"],
  ["9000000101", "Sneha Pillai", "Resident · A-101, with bookings"],
  ["9000000002", "Amit Kulkarni", "Society secretary · A-404"],
  ["9000000010", "Suresh (CoolCare)", "Vendor console"],
  ["9000000098", "Green Valley Gate", "Guard console"],
  ["9000000099", "JODO Ops", "Ops console"],
];

const POINTS = [
  ["One day, one vendor", "The whole building is served together, so travel cost collapses."],
  ["The price only falls", "Everyone pays the final group price — including whoever joined first."],
  ["₹0 until it locks", "If the group doesn't fill, nobody is charged."],
];

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(verifyOtp, {});
  const [phone, setPhone] = useState("9000000001");

  return (
    <main className="jd-auth">
      <aside className="jd-auth__aside" aria-label="About JODO">
        <Link href="/" aria-label="JODO home" className="inline-flex items-center gap-2.5 self-start text-[22px] font-extrabold tracking-tight">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#dce99e" />
            <rect x="9" y="19" width="14" height="5" rx="1.5" fill="#132c24" />
            <rect x="9" y="12.5" width="14" height="5" rx="1.5" fill="#132c24" opacity=".7" />
            <rect x="9" y="6" width="14" height="5" rx="1.5" fill="#156348" />
          </svg>
          jodo
        </Link>
        <div className="max-w-[30rem]">
          <p className="jd-band__kicker">Group booking for your society</p>
          <p className="text-[40px] xl:text-[48px] font-extrabold leading-[1.05] tracking-tight mt-3">
            Your building books together. Everyone pays less.
          </p>
          <ul className="mt-10 flex flex-col gap-5">
            {POINTS.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden="true" className="mt-1 w-5 h-5 shrink-0 rounded-full bg-[#dce99e] text-[#132c24] grid place-items-center text-[11px] font-extrabold">✓</span>
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-[14px] jd-band__muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] jd-band__muted">
          <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link>
        </p>
      </aside>

      <div className="w-full max-w-[480px] mx-auto px-5 py-10 sm:py-14 flex flex-col">
        <div className="mb-8">
          <Link href="/" aria-label="JODO home" className="inline-block mb-6 lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold leading-tight tracking-tight mb-2">
            <span className="lg:hidden">Your building books together. Everyone pays less.</span>
            <span className="hidden lg:inline">Sign in to your society</span>
          </h1>
          <p className="text-ink-500 text-[15px]">
            One service, one day, one vendor for the whole society — and the price falls as flats join.
          </p>
        </div>

        <form action={action} className="card p-5 sm:p-6 flex flex-col gap-3" aria-busy={pending}>
          {next && <input type="hidden" name="next" value={next} />}
          <label className="text-sm font-bold" htmlFor="phone">
            Mobile number
          </label>
          <div className="flex items-stretch gap-2">
            <span className="card px-3 grid place-items-center text-ink-500 text-sm" aria-hidden="true">+91</span>
            <input
              id="phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              aria-describedby="phone-hint"
              className="card px-3 min-h-12 flex-1 min-w-0 tnum"
            />
          </div>
          <span id="phone-hint" className="sr-only">Indian mobile number, 10 digits, country code +91</span>
          <label className="text-sm font-bold mt-2" htmlFor="otp">
            OTP
          </label>
          <input
            id="otp"
            name="otp"
            defaultValue="1234"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            aria-describedby="otp-hint"
            className="card px-3 min-h-12 tnum"
          />
          <p id="otp-hint" className="text-[12px] text-ink-500">This build doesn&apos;t send SMS — the code is always 1234.</p>
          <button className="btn btn-primary mt-2" disabled={pending}>
            {pending ? "Signing in…" : "Continue"}
          </button>
          {state.error && (
            <p role="alert" className="text-[13px] text-danger-600">
              {state.error}
            </p>
          )}
        </form>

        <h2 className="eyebrow mt-8 mb-2" id="demo-accounts">Try an account</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="demo-accounts">
          {DEMO.map(([num, name, role]) => (
            <button
              key={num}
              type="button"
              onClick={() => setPhone(num)}
              aria-pressed={phone === num}
              className={`card p-3 text-left transition-shadow ${phone === num ? "ring-2 ring-brand-600" : "hover:border-ink-300"}`}
            >
              <p className="font-bold text-sm">{name}</p>
              <p className="text-[12px] text-ink-500">
                {role} · <span className="tnum">{num}</span>
              </p>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink-500 mt-8 text-center">
          New here? <Link href="/" className="font-bold text-brand-700">See how JODO works</Link>
        </p>
        <p className="text-[12px] text-ink-500 mt-3 text-center">
          By continuing you agree to the <Link href="/terms" className="underline">terms</Link> and{" "}
          <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
      </div>
    </main>
  );
}
