"use client";

import { useActionState, useState } from "react";
import { createDealAction, type ActionState } from "@/app/actions";
import { rupees } from "@/lib/pricing";
import type { Sku, Slab, Vendor } from "@/lib/types";

type SkuFull = Sku & { defaultSlabs: Slab[] };

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default function CreateForm({
  skus,
  vendors,
  preselect,
}: {
  skus: SkuFull[];
  vendors: Vendor[];
  preselect?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createDealAction, {});
  const [skuId, setSkuId] = useState(preselect && skus.some((s) => s.id === preselect) ? preselect : skus[0].id);
  const [target, setTarget] = useState(20);
  const sku = skus.find((s) => s.id === skuId)!;
  const best = sku.defaultSlabs.at(-1)!;
  const reachable = [...sku.defaultSlabs].reverse().find((s) => s.minFlats <= target) ?? null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <section>
        <p className="eyebrow mb-2">1 · Which service</p>
        <div className="flex flex-col gap-2">
          {skus.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSkuId(s.id)}
              className={`card p-3 text-left ${skuId === s.id ? "ring-2 ring-brand-600" : ""}`}
            >
              <p className="font-bold text-sm">{s.name}</p>
              <p className="text-[12px] text-ink-500">
                {rupees(s.listPricePaise)} solo → {rupees(s.defaultSlabs.at(-1)!.pricePaise)} at{" "}
                {s.defaultSlabs.at(-1)!.minFlats}+ flats · {s.season}
              </p>
            </button>
          ))}
        </div>
        <input type="hidden" name="skuId" value={skuId} />
      </section>

      <section>
        <p className="eyebrow mb-2">2 · Service date</p>
        <input type="date" name="serviceDate" defaultValue={nextSunday()} className="card px-3 py-3 w-full" />
        <p className="text-[12px] text-ink-500 mt-1">Most societies pick a Sunday — more neighbours are home.</p>
      </section>

      <section>
        <p className="eyebrow mb-2">3 · How many flats are you aiming for</p>
        <input
          type="range"
          name="targetFlats"
          min={5}
          max={50}
          step={5}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="tnum font-extrabold text-[18px]">{target} flats</span>
          <span className="text-save-700 font-bold tnum">
            → {rupees(reachable ? reachable.pricePaise : sku.listPricePaise)} per {sku.unitLabel}
          </span>
        </div>
        <p className="text-[12px] text-ink-500 mt-1">
          Minimum to confirm: {Math.min(target, sku.mvsDefault)} flats. Best price {rupees(best.pricePaise)} at{" "}
          {best.minFlats}+.
        </p>
      </section>

      <section>
        <p className="eyebrow mb-2">4 · Joining closes in</p>
        <select name="deadlineHours" defaultValue="72" className="card px-3 py-3 w-full">
          <option value="24">24 hours</option>
          <option value="48">2 days</option>
          <option value="72">3 days</option>
          <option value="120">5 days</option>
        </select>
      </section>

      <section>
        <p className="eyebrow mb-2">5 · Vendor</p>
        <select name="vendorId" defaultValue={vendors[0]?.id} className="card px-3 py-3 w-full">
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · ★ {v.rating}
            </option>
          ))}
        </select>
        <p className="text-[12px] text-ink-500 mt-1">
          JODO suggests the top-rated vendor your society has used before. The ladder they published is frozen for this
          group.
        </p>
      </section>

      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Publishing…" : "Publish to my society"}
      </button>
      {state.error && <p className="text-[13px] text-danger-600">{state.error}</p>}
      <p className="text-[12px] text-ink-500 pb-6">
        Everyone in {`your society`} gets a notification, and you get a WhatsApp card to share in the group.
      </p>
    </form>
  );
}
