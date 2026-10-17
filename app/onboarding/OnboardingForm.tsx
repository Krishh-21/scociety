"use client";

import { useActionState, useState } from "react";
import { saveResidency, type ActionState } from "@/app/actions";

type Society = { id: string; name: string; locality: string; city: string; flatCount: number; residents: number };

export default function OnboardingForm({ societies, name }: { societies: Society[]; name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveResidency, {});
  const [societyId, setSocietyId] = useState(societies[0]?.id ?? "");

  return (
    <main className="min-h-screen bg-canvas-alt flex justify-center">
      <form action={action} className="w-full max-w-[460px] bg-canvas min-h-screen border-x border-line px-5 py-8 flex flex-col">
        <p className="eyebrow mb-2">Step 1 of 1</p>
        <h1 className="text-[26px] font-extrabold leading-tight mb-1">Find your flat</h1>
        <p className="text-ink-500 text-[15px] mb-6">
          Deals are private to your society. Only verified residents can see who joined and what everyone pays.
        </p>

        <label className="text-sm font-bold mb-2" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name === "New resident" ? "" : name}
          placeholder="Your neighbours will see this"
          className="card px-3 py-3 mb-5"
        />

        <p className="text-sm font-bold mb-2">Your society</p>
        <div className="flex flex-col gap-2 mb-5">
          {societies.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSocietyId(s.id)}
              className={`card p-3 text-left ${societyId === s.id ? "ring-2 ring-brand-600" : ""}`}
            >
              <p className="font-bold text-sm">{s.name}</p>
              <p className="text-[12px] text-ink-500">
                {s.locality}, {s.city} · {s.residents} neighbours already here
              </p>
            </button>
          ))}
        </div>
        <input type="hidden" name="societyId" value={societyId} />

        <label className="text-sm font-bold mb-2" htmlFor="flat">
          Flat number
        </label>
        <input id="flat" name="flat" placeholder="A-402" className="card px-3 py-3 mb-5 uppercase" />

        <p className="text-sm font-bold mb-2">You are</p>
        <div className="flex gap-2 mb-6">
          {["owner", "tenant"].map((t, i) => (
            <label key={t} className="card px-4 py-3 flex-1 flex items-center gap-2 cursor-pointer text-sm font-bold capitalize">
              <input type="radio" name="type" value={t} defaultChecked={i === 0} />
              {t}
            </label>
          ))}
        </div>

        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Verifying…" : "Verify & continue"}
        </button>
        {state.error && <p className="text-[13px] text-danger-600 mt-3">{state.error}</p>}
        <p className="text-[12px] text-ink-500 mt-4 leading-relaxed">
          In production this is verified by a neighbour&apos;s vouch, the secretary&apos;s invite link, or a maintenance
          receipt. In this build you are verified instantly.
        </p>
      </form>
    </main>
  );
}
