import Link from "next/link";
import { discountPct, formatDate, rupees } from "@/lib/pricing";
import type { DealView } from "@/lib/types";
import Countdown from "./Countdown";

export function PriceBlock({ deal, size = "lg" }: { deal: DealView; size?: "lg" | "sm" }) {
  const dropped = deal.currentPricePaise < deal.listPricePaise;
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <span
        className={`tnum font-extrabold text-save-700 leading-none ${size === "lg" ? "text-[40px]" : "text-[26px]"}`}
      >
        {rupees(deal.currentPricePaise)}
      </span>
      <span className="text-ink-500 text-sm pb-1">per {deal.sku.unitLabel}</span>
      {dropped && (
        <>
          <span className="tnum text-ink-300 line-through pb-1">{rupees(deal.listPricePaise)}</span>
          <span className="pill bg-save-50 text-save-700 mb-1">
            Save {rupees(deal.savingsPaise)} · {discountPct(deal.listPricePaise, deal.currentPricePaise)}%
          </span>
        </>
      )}
    </div>
  );
}

export function FlatCounter({ deal }: { deal: DealView }) {
  // One number for the resident: progress towards the target that unlocks the
  // best price. `mvs` is the internal confirm threshold and shows up only in the
  // fail-safe line, so the bar and the pill can never disagree.
  const pct = Math.min(100, Math.round((deal.basisCount / deal.targetFlats) * 100));
  const hitTarget = deal.basisCount >= deal.targetFlats;
  const unit = deal.basisLabel;
  const unitSingular = unit.endsWith("s") ? unit.slice(0, -1) : unit;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="tnum text-[22px] font-extrabold">
          {deal.basisCount}
          {!hitTarget && <span className="text-ink-300 font-bold"> / {deal.targetFlats}</span>}
          <span className="text-ink-500 text-sm font-semibold"> {unit} joined</span>
        </div>
        {deal.status === "open" && (
          <span className={`pill ${hitTarget ? "bg-save-50 text-save-700" : "bg-warn-50 text-warn-600"}`}>
            {hitTarget
              ? "Best price unlocked"
              : `${deal.targetFlats - deal.basisCount} more to unlock`}
          </span>
        )}
      </div>
      <div className="h-2.5 rounded-full bg-canvas-alt overflow-hidden">
        <div
          className={`h-full rounded-full ${hitTarget ? "bg-save-600" : "bg-brand-600"}`}
          style={{ width: `${Math.max(4, pct)}%`, transition: "width 400ms ease" }}
        />
      </div>
      {deal.nextSlab && deal.status === "open" && (
        <p className="text-[13px] text-ink-700 mt-2">
          <strong>
            {deal.nextSlab.away} more {deal.nextSlab.away === 1 ? unitSingular : unit}
          </strong>{" "}
          and everyone pays <strong className="text-save-700">{rupees(deal.nextSlab.pricePaise)}</strong>
        </p>
      )}
      {deal.priceHeld && deal.status === "open" && (
        <p className="text-[12px] text-save-700 mt-2">
          Price held at {rupees(deal.currentPricePaise)} — a neighbour left, but nobody pays more than the group has
          already reached.
        </p>
      )}
    </div>
  );
}

export function LadderMeter({ deal }: { deal: DealView }) {
  const rows = [{ minFlats: 1, pricePaise: deal.listPricePaise }, ...deal.slabs].sort(
    (a, b) => a.minFlats - b.minFlats,
  );
  return (
    <div className="card p-4">
      <p className="eyebrow mb-3">Price ladder</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((s, i) => {
          const active = deal.currentPricePaise === s.pricePaise;
          const unlocked = deal.flatsJoined >= s.minFlats;
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                active ? "bg-save-50 ring-1 ring-save-500/40" : unlocked ? "bg-canvas-alt" : ""
              }`}
            >
              <span className={`tnum ${active ? "font-bold text-save-700" : "text-ink-700"}`}>
                {s.minFlats === 1 ? "1–" + (rows[1] ? rows[1].minFlats - 1 : "∞") : `${s.minFlats}+`}{" "}
                {deal.basisLabel}
              </span>
              <span className={`tnum font-bold ${active ? "text-save-700" : unlocked ? "text-ink-700" : "text-ink-300"}`}>
                {rupees(s.pricePaise)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-500 mt-3 leading-relaxed">
        Everyone pays the <strong>final</strong> group price — including whoever joined first. The price can only fall.
      </p>
    </div>
  );
}

export function StatusPill({ deal }: { deal: DealView }) {
  const map: Record<string, [string, string]> = {
    open: ["bg-brand-50 text-brand-700", "Filling"],
    locked: ["bg-save-50 text-save-700", "Confirmed"],
    in_progress: ["bg-warn-50 text-warn-600", "Service in progress"],
    completed: ["bg-canvas-alt text-ink-700", "Completed"],
    expired: ["bg-canvas-alt text-ink-500", "Didn't fill"],
    cancelled: ["bg-danger-50 text-danger-600", "Cancelled"],
  };
  const [cls, label] = map[deal.status] ?? ["bg-canvas-alt text-ink-500", deal.status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function NeighbourStack({ deal }: { deal: DealView }) {
  const shown = deal.members.slice(0, 5);
  if (!shown.length) return <p className="text-sm text-ink-500">Be the first flat to join.</p>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <span
            key={m.id}
            title={`${m.name} · ${m.flat}`}
            className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-[12px] font-bold grid place-items-center ring-2 ring-white"
          >
            {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
        ))}
      </div>
      <p className="text-sm text-ink-700">
        <strong>{deal.members[0].name}</strong>
        {deal.flatsJoined > 1 && ` and ${deal.flatsJoined - 1} neighbour${deal.flatsJoined - 1 === 1 ? "" : "s"}`} joined
      </p>
    </div>
  );
}

export function DealCard({ deal }: { deal: DealView }) {
  const hitMvs = deal.basisCount >= deal.mvs;
  const ring =
    deal.status === "locked" || deal.status === "in_progress"
      ? "ring-1 ring-save-500/40"
      : deal.status === "open" && !hitMvs && deal.msToDeadline < 24 * 3_600_000
        ? "ring-1 ring-warn-500/50"
        : "";
  return (
    <Link href={`/deal/${deal.id}`} className={`card p-4 block ${ring} hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="eyebrow">
          {deal.sku.category} · {formatDate(deal.serviceDate)}
        </p>
        <StatusPill deal={deal} />
      </div>
      <h3 className="text-[17px] font-bold leading-snug mb-0.5">{deal.sku.name}</h3>
      <p className="text-[13px] text-ink-500 mb-3">
        {deal.vendor.name} · ★ {deal.vendor.rating}
      </p>
      <div className="mb-3">
        <PriceBlock deal={deal} size="sm" />
      </div>
      <FlatCounter deal={deal} />
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
        <NeighbourStack deal={deal} />
        {deal.status === "open" ? (
          <Countdown to={deal.joinDeadline} />
        ) : (
          <span className="text-[12px] text-ink-500">{formatDate(deal.serviceDate)}</span>
        )}
      </div>
    </Link>
  );
}

export function ScopeList({ deal }: { deal: DealView }) {
  return (
    <div className="card p-4">
      <p className="eyebrow mb-3">What you get</p>
      <ul className="flex flex-col gap-2">
        {deal.sku.included.map((x) => (
          <li key={x} className="flex gap-2 text-sm text-ink-700">
            <span aria-hidden className="text-save-600 font-bold">✓</span>
            {x}
          </li>
        ))}
        {deal.sku.excluded.map((x) => (
          <li key={x} className="flex gap-2 text-sm text-ink-300">
            <span aria-hidden className="font-bold">×</span>
            {x}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-500 mt-3">
        {deal.sku.durationMin} min per {deal.sku.unitLabel}
        {deal.sku.warrantyDays > 0 && ` · ${deal.sku.warrantyDays}-day workmanship warranty`}
      </p>
    </div>
  );
}

export function VendorCard({ deal }: { deal: DealView }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="w-11 h-11 rounded-xl bg-canvas-alt grid place-items-center font-bold text-ink-700">
        {deal.vendor.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="flex-1">
        <p className="font-bold">{deal.vendor.name}</p>
        <p className="text-[13px] text-ink-500">
          ★ {deal.vendor.rating} · {deal.vendor.jobsDone.toLocaleString("en-IN")} jobs done
        </p>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {deal.vendor.badges.map((b) => (
            <span key={b} className="pill bg-brand-50 text-brand-700">
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FailSafeNote({ deal }: { deal: DealView }) {
  return (
    <p className="text-[12px] text-ink-500 leading-relaxed">
      ₹0 charged now. If {deal.mvs} {deal.basisLabel} don&apos;t join by the deadline, the group is cancelled and{" "}
      <strong className="text-ink-700">nobody is charged</strong>.
    </p>
  );
}

export function TabBar({
  active,
  t = (_k: string, en: string) => en,
}: {
  active: "home" | "explore" | "bookings" | "society" | "profile";
  t?: (key: string, english: string) => string;
}) {
  const items = [
    { key: "home", href: "/", label: t("nav.home", "Home") },
    { key: "explore", href: "/explore", label: t("nav.explore", "Explore") },
    { key: "bookings", href: "/bookings", label: t("nav.bookings", "Bookings") },
    { key: "society", href: "/society", label: t("nav.society", "Society") },
    { key: "profile", href: "/profile", label: t("nav.profile", "Profile") },
  ] as const;
  return (
    <nav className="sticky bottom-0 bg-surface border-t border-line grid grid-cols-5 z-20">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`py-3 text-center text-[12px] font-bold ${
            active === i.key ? "text-brand-700" : "text-ink-500"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex justify-center bg-canvas-alt">
      <div className="w-full max-w-[460px] bg-canvas min-h-screen flex flex-col border-x border-line">
        {children}
      </div>
    </div>
  );
}

export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      className="relative w-10 h-10 rounded-full bg-canvas-alt grid place-items-center"
      aria-label={unread ? `${unread} unread notifications` : "Notifications"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-danger-600 text-white text-[11px] font-bold grid place-items-center tnum">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function SlotLoad({ deal }: { deal: DealView }) {
  if (deal.status !== "open") return null;
  return (
    <div className="card p-4">
      <p className="eyebrow mb-3">Slots on {formatDate(deal.serviceDate)}</p>
      <ul className="grid grid-cols-2 gap-2">
        {deal.slotLoad.map((s) => (
          <li
            key={s.slot}
            className={`rounded-xl px-3 py-2 text-sm ${s.full ? "bg-canvas-alt text-ink-300" : "bg-canvas-alt text-ink-700"}`}
          >
            <span className="tnum font-bold">{s.slot}</span>
            <br />
            <span className="text-[12px]">
              {s.full ? "Full" : `${s.capacity - s.used} of ${s.capacity} left`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-500 mt-3">
        One crew can take {deal.sku.unitsPerSlot} {deal.basisLabel} in a two-hour window — that is what keeps the
        group price honest.
      </p>
    </div>
  );
}

export function AppHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="bg-surface border-b border-line px-4 py-3 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-[19px] font-extrabold leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
