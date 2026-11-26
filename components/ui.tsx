import Link from "next/link";
import type { ReactNode } from "react";
import { isDemoMode } from "@/lib/auth-mode";
import { discountPct, formatDate, rupees } from "@/lib/pricing";
import type { DealView } from "@/lib/types";
import { BrandMark } from "./Brand";
import Countdown from "./Countdown";
import "./app-shell.css";

export function PriceBlock({ deal, size = "lg" }: { deal: DealView; size?: "lg" | "sm" }) {
  const dropped = deal.currentPricePaise < deal.listPricePaise;
  return (
    <div className="flex items-end gap-x-3 gap-y-1 flex-wrap">
      <span
        className={`tnum font-semibold text-save-700 leading-none ${size === "lg" ? "text-[40px] sm:text-[46px]" : "text-[26px]"}`}
      >
        {rupees(deal.currentPricePaise)}
      </span>
      <span className="text-ink-500 text-sm pb-1">per {deal.sku.unitLabel}</span>
      {dropped && (
        <>
          <span className="tnum text-ink-300 line-through pb-1">
            <span className="sr-only">Usual price </span>
            {rupees(deal.listPricePaise)}
          </span>
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
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
        <div className="tnum text-[22px] font-semibold">
          {deal.basisCount}
          {!hitTarget && <span className="text-ink-300 font-medium"> / {deal.targetFlats}</span>}
          <span className="text-ink-500 text-sm font-medium"> {unit} joined</span>
        </div>
        {deal.status === "open" && (
          <span className={`pill ${hitTarget ? "bg-save-50 text-save-700" : "bg-warn-50 text-warn-600"}`}>
            {hitTarget
              ? "Best price unlocked"
              : `${deal.targetFlats - deal.basisCount} more to unlock`}
          </span>
        )}
      </div>
      <div
        className="h-2.5 rounded-full bg-canvas-alt overflow-hidden"
        role="progressbar"
        aria-label={`${unit} joined towards the best price`}
        aria-valuemin={0}
        aria-valuemax={deal.targetFlats}
        aria-valuenow={Math.min(deal.basisCount, deal.targetFlats)}
      >
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
    <section className="card p-4 sm:p-5">
      <h2 className="jd-section-title mb-3">Price ladder</h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((s, i) => {
          const active = deal.currentPricePaise === s.pricePaise;
          const unlocked = deal.basisCount >= s.minFlats;
          return (
            <li
              key={i}
              aria-current={active ? "true" : undefined}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${
                active ? "bg-save-50 ring-1 ring-save-500/40" : unlocked ? "bg-canvas-alt" : "border border-dashed border-line"
              }`}
            >
              <span className={`tnum ${active ? "font-bold text-save-700" : "text-ink-700"}`}>
                {s.minFlats === 1
                  ? rows[1] && rows[1].minFlats > 2
                    ? `1–${rows[1].minFlats - 1}`
                    : "1"
                  : `${s.minFlats}+`}{" "}
                {deal.basisLabel}
                {active && <span className="ms-2 text-[12px] font-medium">Now</span>}
              </span>
              <span className={`tnum font-bold ${active ? "text-save-700" : unlocked ? "text-ink-700" : "text-ink-500"}`}>
                {rupees(s.pricePaise)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-500 mt-3 leading-relaxed">
        Everyone pays the <strong>final</strong> group price — including whoever joined first. The price can only fall.
      </p>
    </section>
  );
}

export function StatusPill({ deal }: { deal: DealView }) {
  const map: Record<string, [string, string]> = {
    open: ["bg-brand-50 text-brand-700", "Filling"],
    locked: ["bg-save-50 text-save-700", "Confirmed"],
    in_progress: ["bg-warn-50 text-warn-600", "Service in progress"],
    completed: ["bg-canvas-alt text-ink-700", "Completed"],
    expired: ["bg-canvas-alt text-ink-500", deal.basisCount < deal.mvs ? "Didn't fill" : "Closed"],
    cancelled: ["bg-danger-50 text-danger-600", "Cancelled"],
  };
  const [cls, label] = map[deal.status] ?? ["bg-canvas-alt text-ink-500", deal.status];
  return <span className={`pill shrink-0 ${cls}`}>{label}</span>;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

export function NeighbourStack({ deal, compact = false }: { deal: DealView; compact?: boolean }) {
  const shown = deal.members.slice(0, compact ? 3 : 5);
  if (!shown.length) return <p className="text-sm text-ink-500">Be the first flat to join.</p>;
  if (compact) {
    // On a feed card there's a countdown beside this — a name that wraps to
    // three lines next to it reads as clutter, so the card just counts.
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex -space-x-2 shrink-0" aria-hidden="true">
          {shown.map((m) => (
            <span
              key={m.id}
              title={`${m.name} · ${m.flat}`}
              className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold grid place-items-center ring-2 ring-surface"
            >
              {initials(m.name)}
            </span>
          ))}
        </div>
        <p className="text-[13px] text-ink-700 truncate">
          <strong className="tnum">{deal.flatsJoined}</strong> {deal.flatsJoined === 1 ? "flat" : "flats"} in
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2 shrink-0" aria-hidden="true">
        {shown.map((m) => (
          <span
            key={m.id}
            title={`${m.name} · ${m.flat}`}
            className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-[12px] font-bold grid place-items-center ring-2 ring-surface"
          >
            {initials(m.name)}
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
    <Link href={`/deal/${deal.id}`} className={`card jd-lift p-4 sm:p-5 flex flex-col ${ring}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="eyebrow truncate">
          {deal.sku.category} · {formatDate(deal.serviceDate)}
        </p>
        <StatusPill deal={deal} />
      </div>
      <h3 className="text-[17px] font-semibold leading-snug mb-0.5">{deal.sku.name}</h3>
      <p className="text-[13px] text-ink-500 mb-3">
        {deal.vendor.name} · <span aria-label={`rated ${deal.vendor.rating}`}>★ {deal.vendor.rating}</span>
      </p>
      <div className="mb-3">
        <PriceBlock deal={deal} size="sm" />
      </div>
      <FlatCounter deal={deal} />
      <div aria-hidden="true" className="flex-1 min-h-3" />
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
        <NeighbourStack deal={deal} compact />
        {deal.status === "open" ? (
          <Countdown to={deal.joinDeadline} />
        ) : (
          <span className="text-[12px] text-ink-500 shrink-0">{formatDate(deal.serviceDate)}</span>
        )}
      </div>
    </Link>
  );
}

export function ScopeList({ deal }: { deal: DealView }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="jd-section-title mb-3">What you get</h2>
      <ul className="flex flex-col gap-2">
        {deal.sku.included.map((x) => (
          <li key={x} className="flex gap-2 text-sm text-ink-700">
            <span aria-hidden className="text-save-600 font-bold">✓</span>
            {x}
          </li>
        ))}
        {deal.sku.excluded.map((x) => (
          <li key={x} className="flex gap-2 text-sm text-ink-500">
            <span aria-hidden className="font-bold">×</span>
            <span><span className="sr-only">Not included: </span>{x}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-500 mt-3">
        {deal.sku.durationMin} min per {deal.sku.unitLabel}
        {deal.sku.warrantyDays > 0 && ` · ${deal.sku.warrantyDays}-day workmanship warranty`}
      </p>
    </section>
  );
}

export function VendorCard({ deal }: { deal: DealView }) {
  return (
    <section className="card p-4 sm:p-5 flex items-start gap-3" aria-label={`Vendor: ${deal.vendor.name}`}>
      <span aria-hidden="true" className="w-11 h-11 shrink-0 rounded-xl bg-canvas-alt grid place-items-center font-bold text-ink-700">
        {deal.vendor.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
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
    </section>
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

/* ------------------------------------------------------------ journey */

const JOURNEY = ["Join", "Group fills", "Confirmed", "Service day", "Done"] as const;

/**
 * Where a booking is, in the resident's words. Derived only from the deal's
 * status, whether you're in it and whether your own visit is finished — the
 * same facts the rest of the screen already shows.
 */
export function JourneySteps({
  status,
  joined,
  visitDone = false,
  className = "",
}: {
  status: DealView["status"];
  joined: boolean;
  visitDone?: boolean;
  className?: string;
}) {
  // A group you never joined isn't your booking once it stops filling.
  if (!joined && status !== "open") return null;
  let current: number;
  if (status === "completed" || visitDone) current = 5;
  else if (status === "in_progress") current = 3;
  else if (status === "locked") current = 2;
  else if (status === "open") current = joined ? 1 : 0;
  else return null;
  return (
    <ol className={`jd-steps ${className}`} aria-label="Booking progress">
      {JOURNEY.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className="jd-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="jd-step__dot" aria-hidden="true">
              {state === "done" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            <span>
              {label}
              <span className="sr-only">{state === "done" ? " — done" : state === "current" ? " — current step" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------- visitor alert */

/**
 * The one interruption the app is allowed: someone is waiting at the gate.
 * Render it inside a live region that is always mounted so a refresh that
 * brings a new request is announced.
 */
export function VisitorAlert({
  count,
  visitorName,
  detail,
  href,
  linkLabel,
  headingId = "visitor-alert-title",
  children,
}: {
  count: number;
  visitorName?: string;
  detail?: string;
  href: string;
  linkLabel?: string;
  headingId?: string;
  /** Inline decision controls (approve / deny) for a single request. */
  children?: ReactNode;
}) {
  const single = count === 1;
  return (
    <section className="jd-alert" aria-labelledby={headingId}>
      <span className="jd-alert__icon" aria-hidden="true">
        <Icon name="gate" size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="jd-alert__kicker">Needs your answer</p>
        <h2 id={headingId} className="text-[18px] font-semibold leading-snug break-words">
          {single ? "Visitor at the gate" : `${count} visitors at the gate`}
        </h2>
        {single && visitorName && (
          <p className="text-sm text-ink-700 break-words mt-0.5">
            <strong>{visitorName}</strong>
            {detail ? ` · ${detail}` : ""}
          </p>
        )}
        {children}
        <Link href={href} className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-ink-900 underline decoration-warn-500 decoration-2 underline-offset-4">
          {linkLabel ?? (single ? "Open entry ticket" : "Review entry requests")}
          <span aria-hidden="true">›</span>
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------------------------- layout primitives */

export function SectionHeader({
  title,
  id,
  aside,
  as: Heading = "h2",
}: {
  title: string;
  id?: string;
  aside?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Heading id={id} className="jd-section-title">{title}</Heading>
      {aside}
    </div>
  );
}

export function QuickAction({
  href,
  label,
  note,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  note?: string;
  icon: IconName;
  primary?: boolean;
}) {
  return (
    <Link href={href} className="jd-action" data-primary={primary || undefined}>
      <span className="jd-action__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="mt-auto">
        <span className="block text-[15px] font-semibold leading-tight">{label}</span>
        {note && <span className="jd-action__note block text-[12px] mt-0.5 leading-snug">{note}</span>}
      </span>
    </Link>
  );
}

export function StatTile({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  tone?: "save" | "warn";
}) {
  const valueTone = tone === "save" ? "text-save-700" : tone === "warn" ? "text-warn-600" : "";
  const body = (
    <>
      <span className="jd-stat__label">{label}</span>
      <span className={`jd-stat__value ${valueTone}`}>{value}</span>
      {note && <span className="text-[12px] text-ink-500">{note}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="jd-stat">{body}</Link>
  ) : (
    <div className="jd-stat">{body}</div>
  );
}

/** Header band for the vendor and ops consoles. */
export function ConsoleHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="jd-console-head">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="jd-band__kicker">{eyebrow}</p>
          <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight mt-1">{title}</h1>
          {meta && <div className="text-[13px] jd-band__muted mt-0.5">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 items-center">{actions}</div>}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ icons */

export type IconName =
  | "home" | "explore" | "bookings" | "society" | "profile" | "bell" | "gate" | "plus"
  | "help" | "chat" | "megaphone" | "wallet" | "wrench" | "shield" | "arrow"
  | "calendar" | "vote" | "key" | "users" | "receipt" | "check" | "clock" | "grid" | "chevron" | "services";

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    explore: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M17.5 14v7M14 17.5h7" />
      </>
    ),
    bookings: (
      <>
        <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M7.5 17h3M13.5 13.5h3" />
      </>
    ),
    society: (
      <>
        <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
        <path d="M14 9h5a1 1 0 0 1 1 1v11M2 21h20M7.5 8h3M7.5 12h3M7.5 16h3" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c1.7.7 2.9 2.2 3.5 4.7" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    gate: (
      <>
        <path d="M4 21V8l8-5 8 5v13" />
        <path d="M9 21v-7h6v7M2 21h20" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4.5" />
        <path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17.2v.1" />
      </>
    ),
    chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />,
    megaphone: (
      <>
        <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" />
        <path d="M17 8.5a5 5 0 0 1 0 7" />
      </>
    ),
    vote: (
      <>
        <path d="M4 14h16v7H4z" />
        <path d="m8.5 9.5 2.5 2.5 5-5M7 14V4h10v10" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="2.5" />
        <path d="M3 10h18M16 15h1.5M7 6V4.5A1.5 1.5 0 0 1 8.5 3h9" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    wrench: <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5zM14.5 6.5 17 4a4 4 0 0 1 3 3l-2.5 2.5" />,
    services: (
      <>
        <path d="M3 12h3l2-6 4 12 2-6h7" />
      </>
    ),
    shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

/* ------------------------------------------------------- navigation */

/** Every place the resident navigation can mark as "you are here". */
export type NavKey =
  | "home" | "visitors" | "community" | "finance" | "helpdesk" | "society"
  | "explore" | "bookings" | "profile" | "notifications" | "help";

type Translate = (key: string, english: string) => string;

type NavLink = { key: NavKey; href: string; label: string; icon: IconName };

/**
 * One source for both navigations, so a new society module is added once.
 * The sidebar groups the society's modules; the phone bar keeps five
 * destinations and folds each module back onto the tab that owns it.
 */
export function navigationModel(t: Translate = (_k, en) => en, showBookings = isDemoMode()) {
  const groups: { label: string; links: NavLink[] }[] = [
    {
      label: t("nav.group.today", "Today"),
      links: [
        { key: "home", href: "/", label: t("nav.home", "Home"), icon: "home" },
        { key: "notifications", href: "/notifications", label: t("nav.notifications", "Notifications"), icon: "bell" },
      ],
    },
    {
      label: t("nav.society", "Society"),
      links: [
        { key: "visitors", href: "/society/visitors", label: t("nav.visitors", "Visitors"), icon: "gate" },
        { key: "community", href: "/society/community", label: t("nav.community", "Notices & amenities"), icon: "megaphone" },
        { key: "finance", href: "/society/finance", label: t("nav.dues", "Dues & receipts"), icon: "wallet" },
        { key: "helpdesk", href: "/society/complaints", label: t("nav.helpdesk", "Helpdesk"), icon: "wrench" },
        { key: "society", href: "/society", label: t("nav.allModules", "All modules"), icon: "grid" },
      ],
    },
    ...(showBookings ? [{
      label: t("nav.services", "Services"),
      links: [
        { key: "explore", href: "/explore", label: t("nav.groupServices", "Group services"), icon: "services" },
        { key: "bookings", href: "/bookings", label: t("nav.bookings", "Bookings"), icon: "bookings" },
      ],
    } satisfies { label: string; links: NavLink[] }] : []),
    {
      label: t("nav.group.you", "You"),
      links: [
        { key: "profile", href: "/profile", label: t("nav.account", "Account"), icon: "profile" },
        { key: "help", href: "/help", label: t("nav.help", "Help"), icon: "help" },
      ],
    },
  ];
  const tabs: (NavLink & { owns: NavKey[] })[] = [
    { key: "home", href: "/", label: t("nav.home", "Home"), icon: "home", owns: ["home"] },
    { key: "visitors", href: "/society/visitors", label: t("nav.visitors", "Visitors"), icon: "gate", owns: ["visitors"] },
    {
      key: "society", href: "/society", label: t("nav.society", "Society"), icon: "society",
      owns: ["society", "community", "helpdesk", "explore", "bookings"],
    },
    { key: "finance", href: "/society/finance", label: t("home.dues", "Dues"), icon: "wallet", owns: ["finance"] },
    { key: "profile", href: "/profile", label: t("nav.account", "Account"), icon: "profile", owns: ["profile", "help", "notifications"] },
  ];
  return { groups, tabs };
}

/**
 * Bottom tab bar on phones, a navy sidebar from 1024px. Detail screens pass
 * `mobile={false}` so they keep their own bottom actions on a phone but still
 * get the sidebar on a desktop. `context` labels the society and flat in the
 * sidebar footer.
 */
export function TabBar({
  active,
  t = (_k: string, en: string) => en,
  mobile = true,
  context,
}: {
  active?: NavKey;
  t?: Translate;
  mobile?: boolean;
  context?: { society: string; flat?: string };
}) {
  const { groups, tabs } = navigationModel(t);
  return (
    <>
      <nav aria-label="Main" className="jd-side">
        <Link href="/" className="jd-side__brand" aria-label="JODO home">
          <BrandMark size={30} />
          <span aria-hidden="true">jodo</span>
        </Link>
        {groups.map((group) => (
          <div key={group.label} className="jd-side__group">
            <p className="jd-side__label" aria-hidden="true">{group.label}</p>
            <ul role="list">
              {group.links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    aria-current={active === link.key ? "page" : undefined}
                    className="jd-side__item"
                  >
                    <Icon name={link.icon} size={18} />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {context && (
          <p className="jd-side__context">
            <span className="block font-semibold text-[13px]">{context.society}</span>
            {context.flat && <span className="block text-[12px]">Flat {context.flat}</span>}
          </p>
        )}
      </nav>
      {mobile && (
        <nav aria-label="Main" className="jd-tabs">
          <ul role="list" className="jd-tabs__list">
            {tabs.map((tab) => {
              const on = active !== undefined && tab.owns.includes(active);
              return (
                <li key={tab.key}>
                  <Link href={tab.href} aria-current={on ? "page" : undefined} className="jd-tabs__item">
                    <span className="jd-tabs__icon">
                      <Icon name={tab.icon} size={21} />
                    </span>
                    <span className="jd-tabs__label">{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

/* ------------------------------------------------- dashboard primitives */

/**
 * A titled block on a dashboard: heading, an optional "see all" link and the
 * body. Used for the notice board, dues, helpdesk and the like.
 */
export function Panel({
  id,
  title,
  icon,
  action,
  tone,
  children,
  className = "",
}: {
  id: string;
  title: string;
  icon?: IconName;
  action?: { href: string; label: string };
  tone?: "alert";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`jd-panel ${className}`} data-tone={tone}>
      <div className="jd-panel__head">
        {icon && (
          <span className="jd-panel__icon" aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
        )}
        <h2 id={id} className="jd-panel__title">{title}</h2>
        {action && (
          <Link href={action.href} className="jd-panel__link">
            {action.label}
            <span aria-hidden="true" className="rtl:-scale-x-100 inline-block">›</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** A quiet "nothing here" line with the one useful next step. */
export function EmptyNote({ children, action }: { children: ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="jd-empty">
      <p>{children}</p>
      {action && (
        <Link href={action.href} className="jd-empty__action">
          {action.label} <span aria-hidden="true">›</span>
        </Link>
      )}
    </div>
  );
}

/** Square-ish shortcut used for the five daily society destinations. */
export function Shortcut({
  href,
  label,
  icon,
  badge,
  badgeLabel,
}: {
  href: string;
  label: string;
  icon: IconName;
  badge?: string | number;
  /** Screen-reader wording for the badge, e.g. "2 waiting". */
  badgeLabel?: string;
}) {
  return (
    <Link href={href} className="jd-shortcut">
      <span className="jd-shortcut__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
        {badge !== undefined && <span className="jd-shortcut__badge tnum">{badge}</span>}
      </span>
      <span className="jd-shortcut__label">
        {label}
        {badgeLabel && <span className="sr-only">, {badgeLabel}</span>}
      </span>
    </Link>
  );
}

/** A directory entry for one society module. */
export function ModuleLink({
  href,
  label,
  description,
  icon,
  meta,
}: {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  meta?: string;
}) {
  return (
    <Link href={href} className="jd-module">
      <span className="jd-module__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[15px] font-medium leading-snug">{label}</span>
          {meta && <span className="jd-module__meta">{meta}</span>}
        </span>
        <span className="block text-[13px] text-ink-500 leading-snug mt-0.5">{description}</span>
      </span>
      <span aria-hidden="true" className="text-ink-300 shrink-0 rtl:-scale-x-100">
        <Icon name="chevron" size={18} />
      </span>
    </Link>
  );
}

/**
 * The signed-in frame. Historically a 460px phone mock; now a full-width
 * column on phones, a centred reading column on tablets and, with a TabBar,
 * a side-rail layout on desktop. `wide` lifts the column limit for dashboards.
 */
export function Phone({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="jd-app" data-wide={wide || undefined}>
      <div className="jd-column">{children}</div>
    </div>
  );
}

export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      className="jd-icon-btn"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Icon name="bell" size={19} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-danger-600 text-white text-[11px] font-semibold grid place-items-center tnum ring-2 ring-canvas"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function SlotLoad({ deal }: { deal: DealView }) {
  if (deal.status !== "open") return null;
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="jd-section-title mb-3">Slots on {formatDate(deal.serviceDate)}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {deal.slotLoad.map((s) => (
          <li
            key={s.slot}
            className={`rounded-xl px-3 py-2.5 text-sm ${s.full ? "bg-canvas-alt text-ink-500" : "bg-canvas-alt text-ink-700"}`}
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
    </section>
  );
}

export function AppHeader({
  title,
  subtitle,
  kicker,
  right,
  back,
  brand = false,
}: {
  title: string;
  subtitle?: string;
  /** A short line above the title — today's date on the dashboard. */
  kicker?: string;
  right?: ReactNode;
  /** Where the back chevron goes. Detail screens get one; top-level tabs don't. */
  back?: { href: string; label?: string };
  /** Show the mark on phones, where the sidebar (and its mark) is hidden. */
  brand?: boolean;
}) {
  return (
    <header className="jd-header">
      {back ? (
        <Link
          href={back.href}
          aria-label={back.label ?? "Back"}
          className="jd-icon-btn -ms-1"
        >
          <svg className="rtl:-scale-x-100" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : brand ? (
        <Link href="/" aria-label="JODO home" className="jd-header__brand">
          <BrandMark size={32} />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        {kicker && <p className="jd-header__kicker truncate">{kicker}</p>}
        <h1 className={`jd-header__title ${brand ? "break-words" : "truncate"}`}>{title}</h1>
        {subtitle && <p className={`jd-header__subtitle ${brand ? "break-words" : "truncate"}`}>{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </header>
  );
}
