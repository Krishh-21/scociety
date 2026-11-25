import Image from "next/image";
import Link from "next/link";
import { listSkus } from "@/lib/deals";
import { publicStats } from "@/lib/leads";
import { currentPrice, rupees } from "@/lib/pricing";
import { FAQ } from "@/lib/faq";
import type { Sku } from "@/lib/types";
import { FaqList, MarketingShell, WRAP } from "./marketing";
import { LadderDemo, SocietyLeadForm, type LadderService } from "./marketing-client";

/** Short labels for the ladder switcher; falls back to the catalogue name. */
const SHORT: Record<string, string> = {
  sku_ac_service: "AC service",
  sku_deep_clean: "Deep cleaning",
  sku_car_wash: "Car wash",
  sku_pest: "Pest control",
};

const basisOf = (s: Sku) => (s.ladderBasis === "units" ? `${s.unitLabel}s` : "flats");

export default async function Landing() {
  const [skus, stats] = await Promise.all([listSkus(), publicStats()]);
  const ac = skus.find((s) => s.id === "sku_ac_service");
  const acBest = ac ? (ac.defaultSlabs.find((s) => s.minFlats === 20) ?? ac.defaultSlabs.at(-1)) : undefined;
  const exampleGroupSize = 12;

  // AC first in the demo — it's the example the whole page is written around.
  const ladder: LadderService[] = [...skus]
    .sort((a, b) => (a.id === ac?.id ? -1 : b.id === ac?.id ? 1 : 0))
    .filter((s) => s.defaultSlabs.length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      shortName: SHORT[s.id] ?? s.category,
      unitLabel: s.unitLabel,
      basisLabel: basisOf(s),
      listPricePaise: s.listPricePaise,
      slabs: s.defaultSlabs,
    }));

  return (
    <MarketingShell>
      {/* ------------------------------------------------------------ hero */}
      <section aria-labelledby="hero-title" className="mk-grain">
        <div className={`${WRAP} pt-10 sm:pt-16 lg:pt-20 pb-16 sm:pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center [&>*]:min-w-0`}>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-surface border border-line px-3 py-1.5 text-[13px] font-bold text-ink-700">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-600" />
              Pay only once the group confirms
            </p>
            <h1 id="hero-title" className="mk-display text-[42px] min-[400px]:text-[48px] sm:text-[64px] xl:text-[70px] mt-6">
              Your building books together. <span className="mk-mark">Everyone pays less.</span>
            </h1>
            {ac && acBest && (
              <p className="mk-lede text-[18px] sm:text-[19px] text-ink-700 leading-relaxed mt-6 max-w-xl">
                One service, one day, one vendor for the whole society. Neighbours join the same job and the price falls
                in public as each flat joins — AC service goes from {rupees(ac.listPricePaise)} to{" "}
                <strong className="text-ink-900">{rupees(acBest.pricePaise)}</strong> when {acBest.minFlats}{" "}
                {basisOf(ac)} book together.
              </p>
            )}
            <div className="flex flex-col min-[420px]:flex-row flex-wrap gap-3 mt-8">
              <Link href="/login" className="btn btn-primary h-12 px-6 text-[16px]">
                Find your society
              </Link>
              <Link href="#societies" className="btn mk-btn-outline h-12 px-6 text-[16px]">
                Bring JODO to your society
              </Link>
            </div>
            <dl className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-x-4 gap-y-5 mt-12 pt-6 border-t border-line max-w-lg">
              {[
                [rupees(stats.savedPaise), "saved by neighbours so far"],
                [String(stats.confirmed), "group bookings confirmed"],
                [String(stats.neighbours), "verified neighbours"],
              ].map(([v, l], i) => (
                <div key={l} className={`flex flex-col-reverse justify-end min-w-0 ${i === 0 ? "col-span-2 min-[420px]:col-span-1" : ""}`}>
                  <dt className="text-[12px] sm:text-[13px] text-ink-500 leading-snug mt-1">{l}</dt>
                  <dd className="tnum text-[22px] sm:text-[28px] font-extrabold tracking-tight whitespace-nowrap">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div id="ladder" className="scroll-mt-24">
            <LadderDemo services={ladder} initialId={ac?.id} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- story + how it works */}
      <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-surface border-y border-line">
        <div className={`${WRAP} py-16 sm:py-24`}>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-end [&>*]:min-w-0">
            <SectionHead
              id="how-title"
              eyebrow="How it works"
              title="Every tower books the same jobs. Just one flat at a time."
            />
            <p className="mk-lede text-[17px] text-ink-700 leading-relaxed lg:pb-2">
              Two hundred flats, forty ACs due before summer, and each one booked separately — forty visits, forty
              quotes, forty technicians stuck in the same traffic. JODO turns that into one group, one day and one price
              that gets better for everybody each time a neighbour says yes.
            </p>
          </div>

          <figure className="relative mt-10 sm:mt-14 rounded-[28px] overflow-hidden bg-[#132c24]">
            <Image
              src="/marketing/society-towers-night.webp"
              alt="Apartment towers of a gated society in Bengaluru at night, dozens of windows lit"
              width={1600}
              height={1013}
              sizes="(min-width: 1200px) 1136px, 100vw"
              className="w-full h-[300px] sm:h-[420px] lg:h-[520px] object-cover object-[center_40%]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#132c24]/90 via-[#132c24]/25 to-transparent"
            />
            <figcaption className="absolute left-0 right-0 bottom-0 p-5 sm:p-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 text-white">
              <p className="text-[20px] sm:text-[28px] font-extrabold tracking-tight leading-tight max-w-md">
                Twelve flats, one tower, one Sunday.
              </p>
              <ul aria-label="Example group activity" className="flex flex-wrap gap-2 text-[12px] sm:text-[13px] font-bold">
                {["B-1204 joined", "A-402 joined", "C-801 joined"].map((x) => (
                  <li key={x} className="rounded-full bg-white/12 backdrop-blur px-3 py-1.5">
                    <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-[#dce99e] mr-1.5 align-middle" />
                    {x}
                  </li>
                ))}
                <li className="rounded-full bg-[#dce99e] text-[#132c24] px-3 py-1.5">Price dropped</li>
              </ul>
            </figcaption>
          </figure>

          <ol className="grid md:grid-cols-3 gap-px bg-line mt-10 sm:mt-14 rounded-[20px] overflow-hidden border border-line">
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
              <li key={title} className="bg-surface p-6 sm:p-8">
                <span className="tnum text-[13px] font-extrabold text-brand-700">0{i + 1}</span>
                <h3 className="text-[20px] font-extrabold tracking-tight mt-3 mb-2">{title}</h3>
                <p className="text-[15px] text-ink-700 leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------ economics */}
      {ac && acBest && (
        <section aria-labelledby="why-title" className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center [&>*]:min-w-0`}>
          <div>
            <SectionHead
              id="why-title"
              eyebrow="Why it's cheaper"
              title="Fewer trips bring down the price."
            />
            <p className="mk-lede text-[17px] text-ink-700 leading-relaxed mt-5">
              Travel and scheduling take time. When neighbours book twelve AC services in the same building,
              a technician can spend more of the day on the jobs and offer each flat a lower price.
            </p>
          </div>
          <div>
            <div className="grid sm:grid-cols-2 gap-4">
              <EconCard
                tone="quiet"
                label="Booking flat by flat"
                jobs={3}
                rows={[
                  ["Jobs in a day", "3"],
                  ["Time on the road", "~3 hours"],
                  ["Price per AC", rupees(ac.listPricePaise)],
                ]}
              />
              <EconCard
                tone="save"
                label="Your building, together"
                jobs={exampleGroupSize}
                rows={[
                  ["Jobs in a day", String(exampleGroupSize)],
                  ["Time on the road", "one trip"],
                  ["Price per AC", rupees(currentPrice(ac.listPricePaise, ac.defaultSlabs, exampleGroupSize))],
                ]}
              />
            </div>
            <p className="text-[12px] text-ink-500 mt-3">
              Illustrative, from our launch model for AC service. Every group shows its own ladder before you join.
            </p>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- services */}
      <section id="services" aria-labelledby="services-title" className="scroll-mt-20 bg-surface border-y border-line">
        <div className={`${WRAP} py-16 sm:py-24`}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <SectionHead
              id="services-title"
              eyebrow="Services"
              title="Jobs that can wait a few days — and get much cheaper for it."
            />
            <a href="#ladder" className="text-[15px] font-bold text-brand-700 hover:underline underline-offset-4 shrink-0">
              Try any ladder above <span aria-hidden="true">↑</span>
            </a>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {skus.map((s) => {
              const sorted = [...s.defaultSlabs].sort((a, b) => a.minFlats - b.minFlats);
              const best = sorted.at(-1);
              if (!best) return null;
              const pct = Math.round(((s.listPricePaise - best.pricePaise) / s.listPricePaise) * 100);
              const steps = [s.listPricePaise, ...sorted.map((x) => x.pricePaise)];
              return (
                <article key={s.id} className="card p-6 flex flex-col bg-canvas">
                  <div className="flex items-center justify-between gap-2">
                    <p className="eyebrow">{s.category}</p>
                    <span className="rounded-full bg-[#dce99e] text-[#132c24] text-[12px] font-extrabold px-2.5 py-1 tnum">
                      −{pct}%
                    </span>
                  </div>
                  <h3 className="text-[18px] font-extrabold tracking-tight mt-3 leading-snug">{s.name}</h3>
                  <div className="flex items-end gap-2 mt-5">
                    <span className="tnum text-[32px] font-extrabold tracking-tight text-brand-700 leading-none">
                      {rupees(best.pricePaise)}
                    </span>
                    <span className="tnum text-ink-500 line-through text-sm pb-0.5">{rupees(s.listPricePaise)}</span>
                  </div>
                  <p className="text-[13px] text-ink-500 mt-1.5">
                    per {s.unitLabel} at {best.minFlats}+ {basisOf(s)}
                  </p>
                  {/* The ladder as a falling staircase, solo price first. */}
                  <div aria-hidden="true" className="flex items-end gap-1 h-12 mt-5">
                    {steps.map((p, i) => (
                      <span
                        key={i}
                        className={`flex-1 rounded-t-[4px] ${i === steps.length - 1 ? "bg-brand-600" : "bg-line"}`}
                        style={{ height: `${Math.max(18, (p / s.listPricePaise) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <ul className="text-[13px] text-ink-700 mt-5 flex flex-col gap-1.5">
                    {s.included.slice(0, 3).map((x) => (
                      <li key={x} className="flex gap-2">
                        <span aria-hidden="true" className="text-brand-600 font-bold">✓</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-ink-500 mt-auto pt-5">Best season: {s.season}</p>
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
      <section id="promises" aria-labelledby="promises-title" className={`scroll-mt-20 ${WRAP} py-16 sm:py-24`}>
        <SectionHead id="promises-title" eyebrow="Our promises" title="Written into the code, not the small print." />
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 mt-12">
          {[
            ["One price for everyone", "The first flat to join pays exactly what the last one pays — the final group price."],
            ["The price only falls", "A vendor can't raise a ladder once anyone has joined. If a neighbour leaves, your price is held."],
            ["Pay once your group confirms", "We authorise your payment when you join and release the hold if the group misses its minimum."],
            ["You close the job", "Technicians start with your code and finish with another — given only when you're happy. Then a warranty."],
          ].map(([t, b]) => (
            <div key={t} className="border-t-2 border-ink-900 pt-5">
              <dt className="text-[18px] font-extrabold tracking-tight">{t}</dt>
              <dd className="text-[15px] text-ink-700 leading-relaxed mt-2">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------- for societies */}
      <section id="societies" aria-labelledby="societies-title" className="scroll-mt-20 mk-forest">
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 [&>*]:min-w-0`}>
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#dce99e] mb-4">
              For secretaries &amp; committees
            </p>
            <h2 id="societies-title" className="mk-h2">
              Stop running service drives on WhatsApp and a spreadsheet.
            </h2>
            <ul className="mt-8 flex flex-col gap-4 text-[16px] text-white/80">
              {[
                "No cash to collect, no vendor to chase — residents pay JODO, the vendor is paid after the work.",
                "Approve every group before it goes live, if your committee prefers.",
                "A record of every job, every rating and every rupee your building saved.",
                "Bring the vendors you already trust — we verify them and put them on the platform.",
              ].map((x) => (
                <li key={x} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1 w-5 h-5 shrink-0 rounded-full bg-[#dce99e] text-[#132c24] grid place-items-center text-[11px] font-extrabold">
                    ✓
                  </span>
                  <span className="leading-relaxed">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-surface text-ink-900 border border-line rounded-[24px] p-5 sm:p-8 shadow-2xl shadow-black/20">
            <h3 className="text-[24px] font-extrabold tracking-tight mb-1">Bring JODO to your society</h3>
            <p className="text-[14px] text-ink-500 mb-6">
              We set up your society, sign the vendors and seed the first group with you. Free for societies.
            </p>
            <SocietyLeadForm />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- for vendors */}
      <section aria-labelledby="vendors-title" className={`${WRAP} py-16 sm:py-24`}>
        <div className="rounded-[28px] border border-line bg-surface p-6 sm:p-10 lg:p-12 grid md:grid-cols-[1.5fr_1fr] gap-8 md:gap-12 items-center [&>*]:min-w-0">
          <div>
            <p className="eyebrow mb-4 !text-brand-700">For vendors</p>
            <h2 id="vendors-title" className="mk-h2 !text-[28px] sm:!text-[38px]">
              A full day of work in one building, paid the next day.
            </h2>
            <p className="mk-lede text-[16px] text-ink-700 leading-relaxed mt-4">
              You publish your price ladder once. We fill the building, you send one crew. Commission is 12–18% — less
              than lead-gen apps, because we hand you a day, not a lead.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/partners" className="btn btn-primary h-12">
              Become a partner
            </Link>
            <Link href="/partners#apply" className="btn mk-btn-outline h-12">
              Go straight to the application
            </Link>
            <p className="text-[13px] text-ink-500 text-center">KYC, police verification and insurance required.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- faq */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-surface border-t border-line">
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16 [&>*]:min-w-0`}>
          <div>
            <SectionHead id="faq-title" eyebrow="Questions" title="What neighbours ask before they join." />
            <p className="text-[15px] text-ink-500 mt-5">
              More in{" "}
              <Link href="/help" className="text-brand-700 font-bold underline underline-offset-2">
                Help
              </Link>
              .
            </p>
          </div>
          <FaqList items={FAQ} />
        </div>
      </section>

      {/* --------------------------------------------------------- closing */}
      <section aria-labelledby="closing-title" className="mk-grain">
        <div className={`${WRAP} py-20 sm:py-28 text-center`}>
          <h2 id="closing-title" className="mk-display text-[36px] sm:text-[56px] max-w-3xl mx-auto">
            Your neighbours are booking the same thing anyway.
          </h2>
          <p className="text-[18px] text-ink-700 mt-5">
            <span className="mk-mark font-bold text-ink-900">Book it together.</span>
          </p>
          <div className="flex flex-col min-[420px]:flex-row justify-center gap-3 mt-9">
            <Link href="/login" className="btn btn-primary h-12 px-6 text-[16px]">
              Find your society
            </Link>
            <Link href="#societies" className="btn mk-btn-outline h-12 px-6 text-[16px]">
              Not listed? Request it
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function SectionHead({ id, eyebrow, title }: { id?: string; eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-4 !text-brand-700">{eyebrow}</p>
      <h2 id={id} className="mk-h2">
        {title}
      </h2>
    </div>
  );
}

function EconCard({
  tone,
  label,
  jobs,
  rows,
}: {
  tone: "quiet" | "save";
  label: string;
  /** Jobs in a day, drawn as a strip of slots. */
  jobs: number;
  rows: [string, string][];
}) {
  const save = tone === "save";
  return (
    <div className={`rounded-[20px] p-6 ${save ? "mk-forest" : "card"}`}>
      <p className={`text-[11px] font-extrabold tracking-[0.1em] uppercase mb-4 ${save ? "text-[#dce99e]" : "text-ink-500"}`}>
        {label}
      </p>
      <div aria-hidden="true" className="grid grid-cols-12 gap-1 mb-5">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={`h-6 rounded-[3px] ${
              i < jobs ? (save ? "bg-[#dce99e]" : "bg-ink-500") : save ? "bg-white/10" : "bg-canvas-alt"
            }`}
          />
        ))}
      </div>
      <dl className="flex flex-col gap-2.5">
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between items-baseline gap-3 text-[14px]">
            <dt className={save ? "text-white/65" : "text-ink-500"}>{k}</dt>
            <dd className={`tnum font-bold ${i === rows.length - 1 ? "text-[24px] font-extrabold tracking-tight" : ""} ${save && i === rows.length - 1 ? "text-[#dce99e]" : ""}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
