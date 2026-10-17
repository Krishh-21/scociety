"use client";

import { useActionState, useState } from "react";
import { verifyOtp, type ActionState } from "@/app/actions";

const DEMO = [
  ["9000000001", "Rahul Mehta", "Resident · A-402, Green Valley"],
  ["9000000002", "Amit Kulkarni", "Society secretary · A-404"],
  ["9000000010", "Suresh (CoolCare)", "Vendor console"],
  ["9000000099", "JODO Ops", "Ops console"],
];

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(verifyOtp, {});
  const [phone, setPhone] = useState("9000000001");

  return (
    <main className="min-h-screen bg-canvas-alt flex justify-center">
      <div className="w-full max-w-[460px] bg-canvas min-h-screen border-x border-line px-5 py-10 flex flex-col">
        <div className="mb-8">
          <p className="eyebrow mb-2">JODO</p>
          <h1 className="text-[30px] font-extrabold leading-tight mb-2">
            Your building books together. Everyone pays less.
          </h1>
          <p className="text-ink-500 text-[15px]">
            One service, one day, one vendor for the whole society — and the price falls as flats join.
          </p>
        </div>

        <form action={action} className="card p-5 flex flex-col gap-3">
          <label className="text-sm font-bold" htmlFor="phone">
            Mobile number
          </label>
          <div className="flex items-center gap-2">
            <span className="card px-3 py-3 text-ink-500 text-sm">+91</span>
            <input
              id="phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              maxLength={10}
              className="card px-3 py-3 flex-1 tnum"
            />
          </div>
          <label className="text-sm font-bold mt-2" htmlFor="otp">
            OTP
          </label>
          <input id="otp" name="otp" defaultValue="1234" inputMode="numeric" maxLength={4} className="card px-3 py-3 tnum" />
          <p className="text-[12px] text-ink-500">This build doesn&apos;t send SMS — the code is always 1234.</p>
          <button className="btn btn-primary mt-2" disabled={pending}>
            {pending ? "Signing in…" : "Continue"}
          </button>
          {state.error && <p className="text-[13px] text-danger-600">{state.error}</p>}
        </form>

        <p className="eyebrow mt-8 mb-2">Try an account</p>
        <div className="flex flex-col gap-2">
          {DEMO.map(([num, name, role]) => (
            <button
              key={num}
              onClick={() => setPhone(num)}
              className={`card p-3 text-left ${phone === num ? "ring-2 ring-brand-600" : ""}`}
            >
              <p className="font-bold text-sm">{name}</p>
              <p className="text-[12px] text-ink-500">
                {role} · <span className="tnum">{num}</span>
              </p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
