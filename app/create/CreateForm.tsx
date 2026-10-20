"use client";

import { useActionState, useMemo, useState } from "react";
import { createDealAction, type ActionState } from "@/app/actions";
import { rupees } from "@/lib/pricing";
import type { Sku, Slab, Vendor } from "@/lib/types";

type SkuFull = Sku & { defaultSlabs: Slab[] };

/** YYYY-MM-DD in the viewer's own timezone — toISOString() is UTC and slips a day after 6:30 pm IST. */
function localDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return localDate(d);
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
}

const basisLabel = (sku: SkuFull) => (sku.ladderBasis === "units" ? `${sku.unitLabel}s` : "flats");

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
  const unit = basisLabel(sku);
  const best = sku.defaultSlabs.at(-1)!;
  const reachable = [...sku.defaultSlabs].reverse().find((s) => s.minFlats <= target) ?? null;

  // Only vendors who do this service — a car-wash group used to default to the AC vendor.
  const offered = useMemo(() => vendors.filter((v) => v.skuIds.includes(skuId)), [vendors, skuId]);
  const [vendorId, setVendorId] = useState(offered[0]?.id ?? "");
  const chosenVendor = offered.find((v) => v.id === vendorId) ?? offered[0];

  function pickSku(id: string) {
    setSkuId(id);
    const first = vendors.find((v) => v.skuIds.includes(id));
    setVendorId(first?.id ?? "");
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <section>
        <p className="eyebrow mb-2">1 · Which service</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Service">
          {skus.map((s) => (
            <button
              type="button"
              role="radio"
              aria-checked={skuId === s.id}
              key={s.id}
              onClick={() => pickSku(s.id)}
              className={`card p-3 text-left ${skuId === s.id ? "ring-2 ring-brand-600" : ""}`}
            >
              <p className="font-bold text-sm">{s.name}</p>
              <p className="text-[12px] text-ink-500">
                {rupees(s.listPricePaise)} solo → {rupees(s.defaultSlabs.at(-1)!.pricePaise)} at{" "}
                {s.defaultSlabs.at(-1)!.minFlats}+ {basisLabel(s)} · {s.season}
              </p>
            </button>
          ))}
        </div>
        <input type="hidden" name="skuId" value={skuId} />
      </section>

      <section>
        <label className="eyebrow mb-2 block" htmlFor="serviceDate">
          2 · Service date
        </label>
        <input
          id="serviceDate"
          type="date"
          name="serviceDate"
          defaultValue={nextSunday()}
          min={tomorrow()}
          required
          className="card px-3 py-3 w-full"
        />
        <p className="text-[12px] text-ink-500 mt-1">Most societies pick a Sunday — more neighbours are home.</p>
      </section>

      <section>
        <label className="eyebrow mb-2 block" htmlFor="targetFlats">
          3 · How many {unit} are you aiming for
        </label>
        <input
          id="targetFlats"
          type="range"
          name="targetFlats"
          min={5}
          max={50}
          step={5}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full accent-[var(--color-brand-600)]"
        />
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="tnum font-extrabold text-[18px]">
            {target} {unit}
          </span>
          <span className="text-save-700 font-bold tnum">
            → {rupees(reachable ? reachable.pricePaise : sku.listPricePaise)} per {sku.unitLabel}
          </span>
        </div>
        <p className="text-[12px] text-ink-500 mt-1">
          Confirms at {Math.min(target, sku.mvsDefault)} {unit}. Best price {rupees(best.pricePaise)} at {best.minFlats}+.
          Nobody is charged if it doesn&apos;t fill.
        </p>
      </section>

      <section>
        <label className="eyebrow mb-2 block" htmlFor="deadlineHours">
          4 · Joining closes in
        </label>
        <select id="deadlineHours" name="deadlineHours" defaultValue="72" className="card px-3 py-3 w-full">
          <option value="24">24 hours</option>
          <option value="48">2 days</option>
          <option value="72">3 days</option>
          <option value="120">5 days</option>
        </select>
        <p className="text-[12px] text-ink-500 mt-1">Always closes at least 6 hours before the service day.</p>
      </section>

      <section>
        <p className="eyebrow mb-2">5 · Vendor</p>
        {offered.length === 0 ? (
          <p className="card p-3 text-sm text-ink-500">No vendor offers this service in your area yet.</p>
        ) : (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Vendor">
            {offered.map((v) => (
              <button
                type="button"
                role="radio"
                aria-checked={chosenVendor?.id === v.id}
                key={v.id}
                onClick={() => setVendorId(v.id)}
                className={`card p-3 text-left flex items-center gap-3 ${
                  chosenVendor?.id === v.id ? "ring-2 ring-brand-600" : ""
                }`}
              >
                <span className="w-10 h-10 rounded-xl bg-canvas-alt grid place-items-center font-bold text-ink-700 shrink-0">
                  {v.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm">{v.name}</span>
                  <span className="block text-[12px] text-ink-500">
                    ★ {v.rating} · {v.jobsDone.toLocaleString("en-IN")} jobs · {v.badges.join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <input type="hidden" name="vendorId" value={chosenVendor?.id ?? ""} />
        <p className="text-[12px] text-ink-500 mt-1">
          The ladder this vendor published is frozen for the group — it can only get cheaper.
        </p>
      </section>

      <button className="btn btn-primary w-full" disabled={pending || !chosenVendor}>
        {pending ? "Publishing…" : "Publish to my society"}
      </button>
      {state.error && (
        <p role="alert" className="text-[13px] text-danger-600">
          {state.error}
        </p>
      )}
      <p className="text-[12px] text-ink-500 pb-6">
        Everyone in your society gets a notification, and you get a WhatsApp card to share in the group.
      </p>
    </form>
  );
}
