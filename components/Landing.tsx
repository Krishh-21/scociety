import Link from "next/link";
import { listSkus } from "@/lib/deals";
import { publicStats } from "@/lib/leads";
import { rupees } from "@/lib/pricing";
import { MarketingFooter, MarketingNav } from "./marketing";
import { LadderDemo, SocietyLeadForm } from "./marketing-client";
import { FAQ } from "@/lib/faq";



export default function Landing() {
  const skus = listSkus();
  const stats = publicStats();
  const ac = skus.find((s) => s.id === "sku_ac_service") ?? skus[0];
  const acBest = ac.defaultSlabs.find((s) => s.minFlats === 20) ?? ac.defaultSlabs.at(-1)!;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <MarketingNav />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_70%_0%,var(--color-brand-50),transparent)]"
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center [&>*]:min-w-0">
            <div>
              <p className="pill bg-save-50 text-save-700 mb-5">
                ₹0 charged unless the group fills
              </p>
              <h1 className="text-[40px] sm:text-[56px] font-extrabold leading-[1.02] tracking-tight">
                Your building books together.{" "}
                <span className="text-brand-700">Everyone pays less.</span>
              </h1>
              <p className="text-[18px] text-ink-700 leading-relaxed mt-5 max-w-xl">
                One service, one day, one vendor for the whole society. Neighbours join the same job, the price falls
                in public as each flat joins — AC service goes from {rupees(ac.listPricePaise)} to{" "}
                <strong className="text-save-700">{rupees(acBest.pricePaise)}</strong> when{" "}
                {acBest.minFlats} {ac.unitLabel}s book together.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link href="/login" className="btn btn-primary h-12 px-6 text-[16px]">
                  Find your society
                </Link>
                <Link href="#societies" className="btn btn-quiet h-12 px-6 text-[16px]">
                  Bring JODO to your society
                </Link>
              </div>
              <dl className="grid grid-cols-3 gap-4 mt-10 max-w-lg">
                {[
                  [rupees(stats.savedPaise), "saved by neighbours so far"],
                  [String(stats.confirmed), "group bookings confirmed"],
                  [String(stats.neighbours), "verified neighbours"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="tnum text-[24px] font-extrabold">{v}</dd>
                    <dd className="text-[12px] text-ink-500 leading-snug">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <LadderDemo
              serviceName={ac.name}
              unitLabel={ac.unitLabel}
              basisLabel={ac.ladderBasis === "units" ? `${ac.unitLabel}s` : "flats"}
              listPricePaise={ac.listPricePaise}
              slabs={ac.defaultSlabs}
            />
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" className="scroll-mt-20 bg-surface border-y border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <SectionHead eyebrow="How it works" title="Three steps, and the building does the haggling." />
            <ol className="grid md:grid-cols-3 gap-5 mt-10">
              {[
                [
                  "Someone starts a group",
                  "A resident or the secretary picks a service and a day — “AC service, this Sunday”. Everyone in the society gets it, and it goes to the WhatsApp group in one tap.",
                ],
                [
                  "Neighbours join, the price falls",
                  "Each flat that joins moves the whole building down a published ladder. Nothing is charged yet, and the first flat pays the same final price as the last.",
                ],
                [
                  "One vendor, one day",
                  "At the deadline the group locks. One verified crew works through the tower slot by slot, and you close your job with a code only when you're happy.",
                ],
              ].map(([title, body], i) => (
                <li key={title} className="card p-6">
                  <span className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center font-extrabold tnum">
                    {i + 1}
                  </span>
                  <h3 className="text-[19px] font-extrabold mt-4 mb-2">{title}</h3>
                  <p className="text-[15px] text-ink-700 leading-relaxed">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ economics */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center [&>*]:min-w-0">
          <div>
            <SectionHead
              eyebrow="Why it's cheaper"
              title="The discount isn't a coupon. It's traffic that never happens."
            />
            <p className="text-[16px] text-ink-700 leading-relaxed mt-4">
              A technician's real cost is the road: three jobs a day, half of it in traffic, plus whatever it took to
              find you. Give them twelve flats in one tower on one Sunday and that cost all but disappears — so they
              can charge each flat a third less and still earn far more for the day.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <EconCard
              tone="quiet"
              label="Booking flat by flat"
              rows={[
                ["Jobs in a day", "3"],
                ["Time on the road", "~3 hours"],
                ["Price per AC", rupees(ac.listPricePaise)],
              ]}
            />
            <EconCard
              tone="save"
              label="Your building, together"
              rows={[
                ["Jobs in a day", "12"],
                ["Time on the road", "one trip"],
                ["Price per AC", rupees(acBest.pricePaise)],
              ]}
            />
            <p className="sm:col-span-2 text-[12px] text-ink-500">
              Illustrative, from our launch model for AC service. Every group shows its own ladder before you join.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- services */}
        <section id="services" className="scroll-mt-20 bg-surface border-y border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <SectionHead
              eyebrow="Services"
              title="Jobs that can wait a few days — and get much cheaper for it."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
              {skus.map((s) => {
                const best = s.defaultSlabs.at(-1)!;
                const pct = Math.round(((s.listPricePaise - best.pricePaise) / s.listPricePaise) * 100);
                return (
                  <article key={s.id} className="card p-5 flex flex-col">
                    <p className="eyebrow">{s.category}</p>
                    <h3 className="text-[17px] font-extrabold mt-1 leading-snug">{s.name}</h3>
                    <div className="flex items-end gap-2 mt-4">
                      <span className="tnum text-[28px] font-extrabold text-save-700 leading-none">
                        {rupees(best.pricePaise)}
                      </span>
                      <span className="tnum text-ink-300 line-through text-sm pb-0.5">{rupees(s.listPricePaise)}</span>
                    </div>
                    <p className="text-[13px] text-ink-500 mt-1">
                      per {s.unitLabel} at {best.minFlats}+ {s.ladderBasis === "units" ? `${s.unitLabel}s` : "flats"} ·{" "}
                      up to {pct}% off
                    </p>
                    <ul className="text-[13px] text-ink-700 mt-4 flex flex-col gap-1">
                      {s.included.slice(0, 3).map((x) => (
                        <li key={x} className="flex gap-2">
                          <span aria-hidden="true" className="text-save-600 font-bold">✓</span>
                          {x}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[12px] text-ink-500 mt-auto pt-4">Best season: {s.season}</p>
                  </article>
                );
              })}
            </div>
            <p className="text-[14px] text-ink-500 mt-6">
              Coming next: water-tank cleaning, painting, appliance AMCs and RO service.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- promises */}
        <section id="promises" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <SectionHead eyebrow="Our promises" title="Written into the code, not the small print." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {[
              ["One price for everyone", "The first flat to join pays exactly what the last one pays — the final group price."],
              ["The price only falls", "A vendor can't raise a ladder once anyone has joined. If a neighbour leaves, your price is held."],
              ["Nothing charged unless it fills", "Money is authorised, not taken. If the group misses its minimum, every hold is released."],
              ["You close the job", "Technicians start with your code and finish with another — given only when you're happy. Then a warranty."],
            ].map(([t, b]) => (
              <div key={t} className="card p-5">
                <span aria-hidden="true" className="w-9 h-9 rounded-xl bg-save-50 text-save-700 grid place-items-center font-extrabold">
                  ✓
                </span>
                <h3 className="text-[16px] font-extrabold mt-3 mb-1.5">{t}</h3>
                <p className="text-[14px] text-ink-700 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------- for societies */}
        <section id="societies" className="scroll-mt-20 band-dark">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-12 [&>*]:min-w-0">
            <div>
              <p className="eyebrow !text-white/60 mb-3">For secretaries &amp; committees</p>
              <h2 className="text-[32px] sm:text-[40px] font-extrabold leading-[1.08] tracking-tight">
                Stop running service drives on WhatsApp and a spreadsheet.
              </h2>
              <ul className="mt-6 flex flex-col gap-3 text-[15px] text-white/80">
                {[
                  "No cash to collect, no vendor to chase — residents pay JODO, the vendor is paid after the work.",
                  "Approve every group before it goes live, if your committee prefers.",
                  "A record of every job, every rating and every rupee your building saved.",
                  "Bring the vendors you already trust — we verify them and put them on the platform.",
                ].map((x) => (
                  <li key={x} className="flex gap-3">
                    <span aria-hidden="true" className="text-save-500 font-bold">✓</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface text-ink-900 rounded-[20px] p-5 sm:p-8">
              <h3 className="text-[22px] font-extrabold mb-1">Bring JODO to your society</h3>
              <p className="text-[14px] text-ink-500 mb-5">
                We set up your society, sign the vendors and seed the first group with you. Free for societies.
              </p>
              <SocietyLeadForm />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- for vendors */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="card p-6 sm:p-10 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center [&>*]:min-w-0">
            <div>
              <p className="eyebrow mb-3 text-brand-700">For vendors</p>
              <h2 className="text-[28px] sm:text-[34px] font-extrabold leading-tight tracking-tight">
                A full day of work in one building, paid the next day.
              </h2>
              <p className="text-[16px] text-ink-700 leading-relaxed mt-3">
                You publish your price ladder once. We fill the building, you send one crew. Commission is 12–18% — less
                than lead-gen apps, because we hand you a day, not a lead.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/partners" className="btn btn-primary h-12">
                Become a partner
              </Link>
              <p className="text-[13px] text-ink-500 text-center">KYC, police verification and insurance required.</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="scroll-mt-20 bg-surface border-t border-line">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <SectionHead eyebrow="Questions" title="What neighbours ask before they join." />
            <div className="mt-8 flex flex-col gap-3">
              {FAQ.map(([q, a]) => (
                <details key={q} className="card p-5 group">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-[16px]">
                    {q}
                    <span aria-hidden="true" className="text-ink-500 transition-transform group-open:rotate-45 text-[22px] leading-none">
                      +
                    </span>
                  </summary>
                  <p className="text-[15px] text-ink-700 leading-relaxed mt-3">{a}</p>
                </details>
              ))}
            </div>
            <p className="text-[14px] text-ink-500 mt-6">
              More in <Link href="/help" className="text-brand-700 font-bold">Help</Link>.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- closing */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="text-[32px] sm:text-[44px] font-extrabold leading-tight tracking-tight">
            Your neighbours are booking the same thing anyway.
          </h2>
          <p className="text-[17px] text-ink-700 mt-3">Book it together.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/login" className="btn btn-primary h-12 px-6 text-[16px]">
              Find your society
            </Link>
            <Link href="#societies" className="btn btn-quiet h-12 px-6 text-[16px]">
              Not listed? Request it
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3 text-brand-700">{eyebrow}</p>
      <h2 className="text-[30px] sm:text-[38px] font-extrabold leading-[1.1] tracking-tight">{title}</h2>
    </div>
  );
}

function EconCard({ tone, label, rows }: { tone: "quiet" | "save"; label: string; rows: [string, string][] }) {
  return (
    <div className={`card p-5 ${tone === "save" ? "ring-2 ring-save-500/40" : ""}`}>
      <p className={`eyebrow mb-3 ${tone === "save" ? "!text-save-700" : ""}`}>{label}</p>
      <dl className="flex flex-col gap-2">
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between gap-3 text-[14px]">
            <dt className="text-ink-500">{k}</dt>
            <dd
              className={`tnum font-bold ${
                i === rows.length - 1 ? (tone === "save" ? "text-save-700 text-[20px]" : "text-ink-900 text-[20px]") : ""
              }`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
