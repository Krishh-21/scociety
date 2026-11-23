import { all, getDb, id, newRevisitCodes, one, run } from "./db";
import {
  commission, currentPrice, effectivePrice, ladderRaisesPrice, nextSlab, rupees, savings, validateSlabs,
} from "./pricing";
import { notify, societyResidentIds } from "./notify";
import { track } from "./analytics";
import { REVISIT_SLOTS, formatRevisitDate, isRevisitDue, isValidRevisitDate, revisitToday } from "./revisits";
import type { Deal, DealMember, DealView, JobStatus, RevisitVisit, Slab, Sku, Society, Vendor } from "./types";

type DealRow = Omit<Deal, "slabs" | "slotWindows"> & { slabs: string; slotWindows: string };
type SkuRow = Omit<Sku, "included" | "excluded"> & { included: string; excluded: string; defaultSlabs: string };
type VendorRow = Omit<Vendor, "badges" | "skuIds"> & { badges: string; skuIds: string };

const now = () => new Date().toISOString();
const DAY = 86_400_000;
const EXTENSION_MS = 2 * DAY;

export function parseSku(r: SkuRow): Sku & { defaultSlabs: Slab[] } {
  return { ...r, included: JSON.parse(r.included), excluded: JSON.parse(r.excluded), defaultSlabs: JSON.parse(r.defaultSlabs) };
}
function parseVendor(r: VendorRow): Vendor {
  return { ...r, badges: JSON.parse(r.badges), skuIds: JSON.parse(r.skuIds ?? "[]") };
}
function parseDeal(r: DealRow): Deal {
  return { ...r, slabs: JSON.parse(r.slabs), slotWindows: JSON.parse(r.slotWindows) };
}

// Catalogue rows (service, vendor, society) don't change while the process runs,
// and a feed of six deals used to re-read all three per deal. Deals, members and
// payments are never cached — those are the rows that move.
const catalogue = {
  sku: new Map<string, Sku & { defaultSlabs: Slab[] }>(),
  vendor: new Map<string, Vendor>(),
  society: new Map<string, Society>(),
};

export function clearCatalogueCache() {
  catalogue.sku.clear();
  catalogue.vendor.clear();
  catalogue.society.clear();
}

function skuById(skuId: string) {
  const hit = catalogue.sku.get(skuId);
  if (hit) return hit;
  const row = parseSku(one<SkuRow>("SELECT * FROM sku WHERE id = ?", skuId)!);
  catalogue.sku.set(skuId, row);
  return row;
}

function vendorById(vendorId: string) {
  const hit = catalogue.vendor.get(vendorId);
  if (hit) return hit;
  const row = parseVendor(one<VendorRow>("SELECT * FROM vendor WHERE id = ?", vendorId)!);
  catalogue.vendor.set(vendorId, row);
  return row;
}

function societyById(societyId: string) {
  const hit = catalogue.society.get(societyId);
  if (hit) return hit;
  const row = one<Society>("SELECT * FROM society WHERE id = ?", societyId)!;
  catalogue.society.set(societyId, row);
  return row;
}

export function listSkus() {
  return all<SkuRow>("SELECT * FROM sku ORDER BY name").map(parseSku);
}
export function listVendors() {
  return all<VendorRow>("SELECT * FROM vendor ORDER BY rating DESC").map(parseVendor);
}

/** Vendors who actually do this service, best-rated first. */
export function vendorsForSku(skuId: string) {
  return listVendors().filter((v) => v.skuIds.includes(skuId));
}
export function getSociety(societyId: string) {
  return one<Society>("SELECT * FROM society WHERE id = ?", societyId);
}

export function logEvent(dealId: string, type: string, payload: Record<string, unknown> = {}) {
  run("INSERT INTO deal_event (dealId,type,payload,createdAt) VALUES (?,?,?,?)", dealId, type, JSON.stringify(payload), now());
}

export class DealError extends Error {}

function dealTransaction<T>(work: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ----------------------------------------------------------------- reading

export function getDealView(dealId: string, viewerId?: string): DealView | null {
  const row = one<DealRow>("SELECT * FROM deal WHERE id = ?", dealId);
  if (!row) return null;
  const deal = parseDeal(row);
  const sku = skuById(deal.skuId);
  const vendor = vendorById(deal.vendorId);
  const society = societyById(deal.societyId);

  const members = all<DealMember & { name: string }>(
    `SELECT m.*, u.name FROM deal_member m JOIN user u ON u.id = m.userId
     WHERE m.dealId = ? AND m.status <> 'left' ORDER BY m.joinedAt`,
    dealId,
  );
  const comments = all<{ id: string; name: string; flat: string; body: string; at: string }>(
    `SELECT c.id, u.name, COALESCE(r.flat,'') AS flat, c.body, c.createdAt AS at
     FROM comment c JOIN user u ON u.id = c.userId
     LEFT JOIN residency r ON r.userId = u.id AND r.societyId = ?
     WHERE c.dealId = ? ORDER BY c.createdAt`,
    deal.societyId, dealId,
  );

  const flatsJoined = members.length;
  const unitsJoined = members.reduce((n, m) => n + m.units, 0);
  const basis = sku.ladderBasis === "units" ? "units" : "flats";
  const basisCount = basis === "units" ? unitsJoined : flatsJoined;
  const basisLabel = basis === "units" ? `${sku.unitLabel}s` : "flats";
  const slabPrice = currentPrice(deal.listPricePaise, deal.slabs, basisCount);
  const price = effectivePrice(slabPrice, deal.floorPricePaise);
  const ns = nextSlab(deal.slabs, basisCount);

  const slotLoad = deal.slotWindows.map((slot) => {
    const used = members.filter((m) => m.slot === slot).reduce((n, m) => n + m.units, 0);
    return { slot, used, capacity: sku.unitsPerSlot, full: used >= sku.unitsPerSlot };
  });

  return {
    ...deal,
    sku,
    vendor,
    society,
    flatsJoined,
    unitsJoined,
    basis,
    basisCount,
    basisLabel,
    slabPricePaise: slabPrice,
    currentPricePaise: price,
    priceHeld: price < slabPrice,
    nextSlab: ns && ns.pricePaise < price ? { away: ns.away, pricePaise: ns.pricePaise } : null,
    savingsPaise: savings(deal.listPricePaise, price),
    slotLoad,
    members,
    comments,
    joinedByMe: viewerId ? members.find((m) => m.userId === viewerId) ?? null : null,
    msToDeadline: new Date(deal.joinDeadline).getTime() - Date.now(),
  };
}

export function feed(societyId: string, viewerId?: string) {
  ensureTicker();
  tick();
  const rows = all<{ id: string }>(
    `SELECT id FROM deal WHERE societyId = ? ORDER BY
       CASE status WHEN 'open' THEN 0 WHEN 'pending' THEN 0 WHEN 'locked' THEN 1 WHEN 'in_progress' THEN 1 ELSE 2 END,
       joinDeadline`,
    societyId,
  );
  const deals = rows.map((r) => getDealView(r.id, viewerId)!).filter(Boolean);
  return {
    live: deals.filter((d) => d.status === "open"),
    pending: deals.filter((d) => d.status === "pending"),
    confirmed: deals.filter((d) => d.status === "locked" || d.status === "in_progress"),
    past: deals.filter((d) => ["completed", "expired", "cancelled"].includes(d.status)),
  };
}

export function societySavings(societyId: string): number {
  const rows = all<{ listPricePaise: number; finalPricePaise: number; units: number }>(
    `SELECT d.listPricePaise, m.finalPricePaise, m.units FROM deal_member m
     JOIN deal d ON d.id = m.dealId
     WHERE d.societyId = ? AND m.finalPricePaise IS NOT NULL`,
    societyId,
  );
  return rows.reduce((sum, r) => sum + Math.max(0, r.listPricePaise - r.finalPricePaise) * r.units, 0);
}

export function myBookings(userId: string) {
  ensureTicker();
  const rows = all<{ dealId: string }>(
    "SELECT dealId FROM deal_member WHERE userId = ? AND status <> 'left' ORDER BY joinedAt DESC",
    userId,
  );
  return rows.map(({ dealId }) => {
    tickDeal(dealId);
    return getDealView(dealId, userId)!;
  }).filter(Boolean);
}

/** "Your society repeats this in March" — demand we create rather than wait for. */
export function repeatSuggestions(societyId: string) {
  const rows = all<{ skuId: string; serviceDate: string }>(
    `SELECT skuId, MAX(serviceDate) AS serviceDate FROM deal
     WHERE societyId = ? AND status = 'completed' GROUP BY skuId`,
    societyId,
  );
  const out: { sku: ReturnType<typeof parseSku>; dueAt: string; overdue: boolean }[] = [];
  for (const r of rows) {
    const sku = skuById(r.skuId);
    if (!sku.repeatMonths) continue;
    const due = new Date(r.serviceDate);
    due.setMonth(due.getMonth() + sku.repeatMonths);
    out.push({ sku, dueAt: due.toISOString(), overdue: due.getTime() <= Date.now() });
  }
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

// ----------------------------------------------------------------- writing

function slotRoom(dealId: string, slot: string, capacity: number): number {
  const used = one<{ n: number }>(
    "SELECT COALESCE(SUM(units),0) AS n FROM deal_member WHERE dealId = ? AND slot = ? AND status <> 'left'",
    dealId, slot,
  )!.n;
  return capacity - used;
}

export function joinDeal(args: {
  dealId: string; userId: string; flat: string; units: number; slot: string;
  paymentMethod: "upi" | "card" | "cash";
  /** The society the joiner is verified in. A deal is private to its society. */
  societyId?: string;
}) {
  const db = getDb();
  let memberId = "";
  let priceBefore = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    const row = one<DealRow>("SELECT * FROM deal WHERE id = ?", args.dealId);
    if (!row) throw new DealError("Deal not found.");
    const deal = parseDeal(row);
    if (args.societyId && args.societyId !== deal.societyId) {
      throw new DealError("This group is private to its own society.");
    }
    if (deal.status !== "open") throw new DealError("This group is closed for joining.");
    if (new Date(deal.joinDeadline).getTime() < Date.now()) throw new DealError("Joining closed for this group.");
    if (args.units < 1 || args.units > 10) throw new DealError("Units must be between 1 and 10.");
    if (!deal.slotWindows.includes(args.slot)) throw new DealError("Pick a valid slot.");

    const sku = one<SkuRow>("SELECT * FROM sku WHERE id = ?", deal.skuId)!;

    const counts0 = one<{ flats: number; units: number }>(
      `SELECT COUNT(*) AS flats, COALESCE(SUM(units),0) AS units
       FROM deal_member WHERE dealId = ? AND status <> 'left'`,
      args.dealId,
    )!;
    const basisBefore = sku.ladderBasis === "units" ? counts0.units : counts0.flats;
    priceBefore = effectivePrice(
      currentPrice(deal.listPricePaise, deal.slabs, basisBefore),
      deal.floorPricePaise,
    );

    const existing = one<DealMember>("SELECT * FROM deal_member WHERE dealId = ? AND userId = ?", args.dealId, args.userId);
    if (existing && existing.status !== "left") throw new DealError("You have already joined this group.");

    // One crew can only do so much in a two-hour window.
    const room = slotRoom(args.dealId, args.slot, sku.unitsPerSlot);
    if (room < args.units) {
      throw new DealError(
        room <= 0
          ? "That slot is full. Pick another one."
          : `Only ${room} ${sku.unitLabel}${room === 1 ? "" : "s"} left in that slot.`,
      );
    }

    if (existing) {
      memberId = existing.id;
      run(
        `UPDATE deal_member SET status='joined', units=?, slot=?, paymentMethod=?, joinedAt=? WHERE id = ?`,
        args.units, args.slot, args.paymentMethod, now(), existing.id,
      );
    } else {
      memberId = id("dm");
      run(
        `INSERT INTO deal_member (id,dealId,userId,flat,units,slot,paymentMethod,status,finalPricePaise,joinedAt)
         VALUES (?,?,?,?,?,?,?,'joined',NULL,?)`,
        memberId, args.dealId, args.userId, args.flat, args.units, args.slot, args.paymentMethod, now(),
      );
    }

    // Ratchet the floor down. The floor is what members are charged, so a later
    // departure can lower the slab count without raising anybody's price.
    const counts = one<{ flats: number; units: number }>(
      `SELECT COUNT(*) AS flats, COALESCE(SUM(units),0) AS units
       FROM deal_member WHERE dealId = ? AND status <> 'left'`,
      args.dealId,
    )!;
    const basisCount = sku.ladderBasis === "units" ? counts.units : counts.flats;
    const slabPrice = currentPrice(deal.listPricePaise, deal.slabs, basisCount);
    run(
      "UPDATE deal SET floorPricePaise = MIN(COALESCE(floorPricePaise, ?), ?) WHERE id = ?",
      slabPrice, slabPrice, args.dealId,
    );

    // Authorise before committing the join, so a lock can't capture it first.
    recordPayment(memberId, args.dealId, "authorisation", args.paymentMethod,
      effectivePrice(slabPrice, deal.floorPricePaise) * args.units,
      args.paymentMethod === "cash" ? "not_applicable" : "held");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const view = getDealViewFresh(args.dealId, args.userId);

  logEvent(args.dealId, "join", { userId: args.userId, flats: view.flatsJoined, price: view.currentPricePaise });
  track(args.userId, "join_success", { dealId: args.dealId, units: args.units, price: view.currentPricePaise });

  if (view.currentPricePaise < priceBefore) {
    const others = view.members.map((m) => m.userId).filter((u) => u !== args.userId);
    notify(others, {
      type: "price_drop",
      dealId: args.dealId,
      title: `Price dropped to ${rupees(view.currentPricePaise)}`,
      body: `${view.basisCount} ${view.basisLabel} in. You now save ${rupees(view.savingsPaise)} per ${view.sku.unitLabel} — because more neighbours joined.`,
    });
    logEvent(args.dealId, "slab_change", { from: priceBefore, to: view.currentPricePaise });
  }
  return view;
}

/** getDealView without React's per-render cache, for use right after a write. */
function getDealViewFresh(dealId: string, viewerId?: string): DealView {
  return getDealView(dealId, viewerId)!;
}

export function leaveDeal(dealId: string, userId: string) {
  return dealTransaction(() => {
    const deal = one<DealRow>("SELECT * FROM deal WHERE id = ?", dealId);
    if (!deal) throw new DealError("Deal not found.");
    if (deal.status !== "open") throw new DealError("You can only leave a group before it locks.");
    const member = one<{ id: string }>("SELECT id FROM deal_member WHERE dealId = ? AND userId = ? AND status='joined'", dealId, userId);
    if (member) {
      run("UPDATE deal_member SET status='left' WHERE id = ?", member.id);
      run("UPDATE payment SET status='released' WHERE memberId = ? AND type='authorisation' AND status='held'", member.id);
      logEvent(dealId, "leave", { userId });
      track(userId, "leave", { dealId });
    }
    return getDealView(dealId, userId)!;
  });
}

export function addComment(dealId: string, userId: string, body: string) {
  const text = body.trim().slice(0, 400);
  if (!text) throw new DealError("Write something first.");
  run("INSERT INTO comment (id,dealId,userId,body,createdAt) VALUES (?,?,?,?,?)", id("cmt"), dealId, userId, text, now());
  const view = getDealView(dealId, userId)!;
  const author = one<{ name: string }>("SELECT name FROM user WHERE id = ?", userId);
  notify(view.members.map((m) => m.userId).filter((u) => u !== userId), {
    type: "comment",
    dealId,
    title: `${author?.name ?? "A neighbour"} commented`,
    body: text.slice(0, 120),
  });
  track(userId, "comment_post", { dealId });
  return view;
}

export function createDeal(args: {
  societyId: string; skuId: string; vendorId: string; createdBy: string;
  serviceDate: string; targetFlats: number; deadlineHours: number; slabs?: Slab[];
}) {
  const sku = one<SkuRow>("SELECT * FROM sku WHERE id = ?", args.skuId);
  if (!sku) throw new DealError("Unknown service.");
  const parsed = parseSku(sku);
  const slabs = args.slabs?.length ? args.slabs : parsed.defaultSlabs;
  const invalid = validateSlabs(parsed.listPricePaise, slabs);
  if (invalid) throw new DealError(invalid);

  const serviceAt = new Date(args.serviceDate);
  if (Number.isNaN(serviceAt.getTime())) throw new DealError("Pick a service date.");
  const deadline = new Date(Math.min(
    serviceAt.getTime() - 6 * 3_600_000,
    Date.now() + args.deadlineHours * 3_600_000,
  ));
  if (deadline.getTime() <= Date.now()) throw new DealError("Pick a date at least a day away.");

  const society = one<Society>("SELECT * FROM society WHERE id = ?", args.societyId);
  if (!society) throw new DealError("Unknown society.");

  const vendor = one<VendorRow>("SELECT * FROM vendor WHERE id = ?", args.vendorId);
  if (!vendor) throw new DealError("Pick a vendor.");
  if (!parseVendor(vendor).skuIds.includes(args.skuId)) {
    throw new DealError(`${vendor.name} doesn't offer ${parsed.name}. Pick one of the vendors listed for it.`);
  }

  const target = Math.max(2, Math.min(100, args.targetFlats));
  const mvs = Math.min(target, parsed.mvsDefault);
  const dealId = id("deal");
  // Societies that asked for it get committee sign-off before anything goes live.
  const status = society.approvalRequired ? "pending" : "open";
  run(
    `INSERT INTO deal (id,societyId,skuId,vendorId,createdBy,serviceDate,slotWindows,status,joinDeadline,targetFlats,mvs,listPricePaise,slabs,createdAt,lockedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
    dealId, args.societyId, args.skuId, args.vendorId, args.createdBy, serviceAt.toISOString(),
    JSON.stringify(["08:00–10:00", "10:00–12:00", "12:00–14:00", "16:00–18:00"]),
    status, deadline.toISOString(), target, mvs, parsed.listPricePaise, JSON.stringify(slabs), now(),
  );
  logEvent(dealId, "created", { by: args.createdBy, target, mvs, status });
  track(args.createdBy, "create_publish", { dealId, skuId: args.skuId, target });

  if (status === "open") announceDeal(dealId, args.createdBy);
  else {
    const committee = all<{ userId: string }>(
      `SELECT r.userId FROM residency r JOIN user u ON u.id = r.userId
       WHERE r.societyId = ? AND u.role = 'secretary'`,
      args.societyId,
    ).map((r) => r.userId);
    notify(committee, {
      type: "approval_needed",
      dealId,
      title: "A group needs your approval",
      body: `${parsed.name} on ${serviceAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
    });
  }
  return dealId;
}

function announceDeal(dealId: string, exceptUserId?: string) {
  const view = getDealView(dealId)!;
  notify(societyResidentIds(view.societyId, exceptUserId), {
    type: "new_deal",
    dealId,
    title: view.sku.name,
    body: `${rupees(view.listPricePaise)} solo · down to ${rupees(view.slabs.at(-1)!.pricePaise)} if ${view.slabs.at(-1)!.minFlats} ${view.basisLabel} join.`,
  });
}

export function approveDeal(dealId: string, approvedBy: string) {
  const row = one<{ status: string }>("SELECT status FROM deal WHERE id = ?", dealId);
  if (!row) throw new DealError("Deal not found.");
  if (row.status !== "pending") throw new DealError("This group is not waiting for approval.");
  run("UPDATE deal SET status='open', approvedBy=? WHERE id = ?", approvedBy, dealId);
  logEvent(dealId, "approved", { by: approvedBy });
  announceDeal(dealId);
  return getDealView(dealId)!;
}

/** Lock a deal: freeze one final price for every member and create one job per flat. */
export function lockDeal(dealId: string) {
  return dealTransaction(() => {
    const view = getDealView(dealId);
    if (!view) throw new DealError("Deal not found.");
    return lockOpenDeal(view);
  });
}

function lockOpenDeal(view: DealView) {
  if (view.status !== "open") throw new DealError("Deal is not open.");
  if (view.basisCount < view.mvs) {
    throw new DealError(`Needs ${view.mvs} ${view.basisLabel}, has ${view.basisCount}.`);
  }

  const { id: dealId, currentPricePaise: price } = view;
  run("UPDATE deal SET status='locked', lockedAt=?, floorPricePaise=? WHERE id = ?", now(), price, dealId);
  run("UPDATE deal_member SET status='locked', finalPricePaise=? WHERE dealId = ? AND status='joined'", price, dealId);

  const technicians = ["Suresh Y.", "Imran S.", "Ravi K.", "Manoj P."];
  view.members.forEach((m, i) => {
    // Idempotent: a second lock (two processes, a retried request) adds no jobs.
    const already = one<{ id: string }>("SELECT id FROM job WHERE memberId = ?", m.id);
    if (already) return;
    run(
      `INSERT INTO job (id,dealId,memberId,flat,technician,slot,status,startOtp,endOtp) VALUES (?,?,?,?,?,?,'scheduled',?,?)`,
      id("job"), dealId, m.id, m.flat, technicians[i % technicians.length], m.slot,
      String(1000 + Math.floor(Math.random() * 8999)), String(1000 + Math.floor(Math.random() * 8999)),
    );
    run(
      "UPDATE payment SET status='captured' WHERE memberId = ? AND type='authorisation' AND status='held'",
      m.id,
    );
    recordPayment(m.id, dealId, "capture", m.paymentMethod, price * m.units, "captured");
  });

  logEvent(dealId, "locked", { flats: view.flatsJoined, finalPrice: price });
  notify(view.members.map((m) => m.userId), {
    type: "locked",
    dealId,
    title: "Group booking confirmed",
    body: `${view.basisCount} ${view.basisLabel}, one vendor, ${new Date(view.serviceDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}. You pay ${rupees(price)} per ${view.sku.unitLabel}.`,
  });
  return getDealView(dealId)!;
}

/** Deadline passed without the minimum: nobody is charged. */
export function expireDeal(dealId: string) {
  return dealTransaction(() => {
    const view = getDealView(dealId);
    if (!view) throw new DealError("Deal not found.");
    return expireOpenDeal(view);
  });
}

function expireOpenDeal(view: DealView) {
  if (view.status !== "open") throw new DealError("Only a group that's still filling can be closed.");
  const dealId = view.id;
  // Members are kept on the record (nobody was charged) so the society can see
  // how close the group got and roll it into next week.
  run("UPDATE deal SET status='expired' WHERE id = ?", dealId);
  for (const m of view.members) {
    run("UPDATE payment SET status='released' WHERE memberId = ? AND type='authorisation' AND status='held'", m.id);
    recordPayment(m.id, dealId, "release", m.paymentMethod, 0, "released");
  }
  logEvent(dealId, "expired", {});
  notify(view.members.map((m) => m.userId), {
    type: "expired",
    dealId,
    title: "Your group was closed",
    body: view.basisCount < view.mvs
      ? `Only ${view.basisCount} of ${view.mvs} ${view.basisLabel} joined. You were not charged.`
      : "The group was closed without a charge.",
  });
  return getDealView(dealId)!;
}

let ticker: ReturnType<typeof setInterval> | null = null;

/**
 * Closing a deal captures money and creates jobs, so it must not depend on
 * somebody loading a page. The first server-side read starts a timer that keeps
 * running on its own; a real deployment points a scheduler at /api/cron/tick
 * instead and sets JODO_DISABLE_TICKER=1.
 */
export function ensureTicker() {
  if (ticker || process.env.JODO_DISABLE_TICKER === "1") return;
  const every = Number(process.env.JODO_TICK_MS ?? 60_000);
  ticker = setInterval(() => {
    try {
      const closed = tick();
      if (closed) console.log(`[jodo] closed ${closed} deal(s) past their deadline`);
    } catch (e) {
      console.error("[jodo] tick failed", e);
    }
  }, every);
  ticker.unref?.();
}

/** The scheduled pass: close every deal whose deadline has gone. */
export function tick() {
  const due = all<{ id: string }>("SELECT id FROM deal WHERE status='open' AND joinDeadline <= ?", now());
  for (const d of due) closeIfDue(d.id);
  return due.length;
}

/** Same rule for a single deal, so a deal page never renders a closed deal as open. */
export function tickDeal(dealId: string) {
  const row = one<{ status: string; joinDeadline: string }>(
    "SELECT status, joinDeadline FROM deal WHERE id = ?", dealId,
  );
  if (!row || row.status !== "open") return;
  if (new Date(row.joinDeadline).getTime() > Date.now()) return;
  closeIfDue(dealId);
}

function closeIfDue(dealId: string) {
  dealTransaction(() => {
    const view = getDealView(dealId);
    if (!view || view.status !== "open" || view.msToDeadline > 0) return;
    if (view.basisCount >= view.mvs) {
      lockOpenDeal(view);
      return;
    }
    // One automatic extension for a group that nearly made it.
    const closeEnough = view.basisCount >= Math.ceil(view.mvs * 0.6);
    if (closeEnough && !view.extendedAt) {
      const deadline = new Date(Date.now() + EXTENSION_MS).toISOString();
      run("UPDATE deal SET joinDeadline=?, extendedAt=? WHERE id = ?", deadline, now(), dealId);
      logEvent(dealId, "extended", { until: deadline });
      notify(societyResidentIds(view.societyId), {
        type: "extended",
        dealId,
        title: `${view.sku.name}: 48 more hours`,
        body: `${view.basisCount} of ${view.mvs} ${view.basisLabel} joined. The vendor held the date — ${view.mvs - view.basisCount} more and it's confirmed.`,
      });
      return;
    }
    expireOpenDeal(view);
  });
}

// ------------------------------------------------------------- service day

/** Opens the service day: only the first slot's crew sets off. */
export function startService(dealId: string) {
  return dealTransaction(() => {
    const view = getDealView(dealId);
    if (!view) throw new DealError("Deal not found.");
    if (view.status !== "locked") throw new DealError("This group isn't confirmed yet.");
    if (!one("SELECT id FROM job WHERE dealId = ? AND status <> 'completed' LIMIT 1", dealId)) {
      throw new DealError("There are no scheduled visits for this group.");
    }
    run("UPDATE deal SET status='in_progress' WHERE id = ?", dealId);
    releaseNextSlot(dealId);
    logEvent(dealId, "service_started", {});
    notify(view.members.map((m) => m.userId), {
      type: "service_day",
      dealId,
      title: `${view.vendor.name} has started in the building`,
      body: "You'll see your place in the queue in the app.",
    });
    return getDealView(dealId)!;
  });
}

/** Sends the earliest slot that still has work to do out as 'en route'. */
function releaseNextSlot(dealId: string) {
  const next = one<{ slot: string }>(
    `SELECT slot FROM job WHERE dealId = ? AND status = 'scheduled' ORDER BY slot LIMIT 1`,
    dealId,
  );
  if (!next) return;
  const busy = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM job WHERE dealId = ? AND status IN ('en_route','in_progress')", dealId,
  )!;
  if (busy.n > 0) return;
  run("UPDATE job SET status='en_route' WHERE dealId = ? AND slot = ? AND status='scheduled'", dealId, next.slot);
}

function getServiceJob(jobId: string) {
  const job = one<{
    dealId: string; memberId: string; startOtp: string; endOtp: string; status: JobStatus; dealStatus: Deal["status"];
  }>(
    "SELECT j.*, d.status AS dealStatus FROM job j JOIN deal d ON d.id = j.dealId WHERE j.id = ?",
    jobId,
  );
  if (!job) throw new DealError("Job not found.");
  if (job.status === "completed") throw new DealError("That job is already done.");
  if (job.dealStatus !== "in_progress") throw new DealError("Start the service day first.");
  return job;
}

export function startJob(jobId: string, otp: string) {
  return dealTransaction(() => {
    const revisit = one<RevisitVisit>(`${REVISIT_VIEW} WHERE r.id = ?`, jobId);
    if (revisit) return startRevisit(revisit, otp);
    const job = getServiceJob(jobId);
    if (job.status === "in_progress") throw new DealError("That job has already started.");
    if (job.status !== "en_route") throw new DealError("Wait for this slot to open before starting the job.");
    if (otp.trim() !== job.startOtp) throw new DealError("That start code doesn't match.");
    run("UPDATE job SET status='in_progress', startedAt=? WHERE id = ?", now(), jobId);
    return job.dealId;
  });
}

export function completeJob(jobId: string, otp: string) {
  return dealTransaction(() => {
    const revisit = one<RevisitVisit>(`${REVISIT_VIEW} WHERE r.id = ?`, jobId);
    if (revisit) return completeRevisit(revisit, otp);
    const job = getServiceJob(jobId);
    if (job.status !== "in_progress") throw new DealError("Start the job before completing it.");
    if (otp.trim() !== job.endOtp) throw new DealError("That OTP doesn't match.");
    run("UPDATE job SET status='completed', finishedAt=? WHERE id = ?", now(), jobId);
    run("UPDATE deal_member SET status='served' WHERE id = ?", job.memberId);

    const member = one<{ userId: string }>("SELECT userId FROM deal_member WHERE id = ?", job.memberId);
    const view = getDealView(job.dealId)!;
    if (member) {
      notify([member.userId], {
        type: "job_done",
        dealId: job.dealId,
        title: "Your service is done",
        body: view.sku.warrantyDays
          ? `Rate ${view.vendor.name} — your ${view.sku.warrantyDays}-day warranty starts today.`
          : `Rate ${view.vendor.name}.`,
      });
    }

    releaseNextSlot(job.dealId);
    const left = one<{ n: number }>("SELECT COUNT(*) AS n FROM job WHERE dealId = ? AND status <> 'completed'", job.dealId)!;
    if (left.n === 0) {
      run("UPDATE deal SET status='completed' WHERE id = ?", job.dealId);
      logEvent(job.dealId, "completed", {});
      if (view.sku.repeatMonths) {
        notify(societyResidentIds(view.societyId), {
          type: "repeat_due",
          dealId: job.dealId,
          title: `${view.sku.name} done for ${view.flatsJoined} flats`,
          body: `Your society usually repeats this every ${view.sku.repeatMonths} months — we'll remind you.`,
        });
      }
    }
    return job.dealId;
  });
}

export function rateJob(jobId: string, score: number, note: string) {
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new DealError("Pick a rating from 1 to 5.");
  const result = run("UPDATE job SET ratingScore=?, ratingNote=? WHERE id = ? AND status='completed'", score, note.slice(0, 300), jobId);
  if (!result.changes) throw new DealError("You can rate the service once your visit is complete.");
}

export function jobsForDeal(dealId: string) {
  return all<{
    id: string; flat: string; technician: string; slot: string; status: string;
    startOtp: string; endOtp: string; ratingScore: number | null; name: string; userId: string;
  }>(
    `SELECT j.*, u.name, m.userId FROM job j
     JOIN deal_member m ON m.id = j.memberId JOIN user u ON u.id = m.userId
     WHERE j.dealId = ? ORDER BY j.slot, j.flat`,
    dealId,
  );
}

export function myJob(dealId: string, userId: string) {
  return one<{
    id: string; technician: string; slot: string; status: JobStatus;
    startOtp: string; endOtp: string; ratingScore: number | null; finishedAt: string | null;
  }>(
    `SELECT j.* FROM job j JOIN deal_member m ON m.id = j.memberId WHERE j.dealId = ? AND m.userId = ?`,
    dealId, userId,
  );
}

/** "3 flats ahead, about 40 minutes" — the queue the resident actually cares about. */
export function queueAhead(dealId: string, jobId: string) {
  const job = one<{ slot: string; flat: string }>(
    "SELECT slot, flat FROM job WHERE id = ? AND dealId = ? AND status IN ('scheduled', 'en_route')",
    jobId, dealId,
  );
  if (!job) return null;
  const ahead = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM job
     WHERE dealId = ? AND status <> 'completed' AND (slot < ? OR (slot = ? AND flat < ?))`,
    dealId, job.slot, job.slot, job.flat,
  )!.n;
  const view = getDealView(dealId)!;
  return { ahead, etaMin: ahead * view.sku.durationMin };
}

// -------------------------------------------------------------- revisits

const REVISIT_VIEW = `
  SELECT r.*, d.dealId, d.userId AS residentId, d.reason, d.detail, trim(substr(d.resolution, 9)) AS instructions,
         j.memberId, j.flat, j.technician, u.name AS residentName, s.name AS serviceName,
         soc.name AS societyName, dl.vendorId, v.name AS vendorName
  FROM revisit r
  JOIN dispute d ON d.id = r.disputeId
  JOIN job j ON j.id = d.jobId
  JOIN deal dl ON dl.id = d.dealId
  JOIN sku s ON s.id = dl.skuId
  JOIN society soc ON soc.id = dl.societyId
  JOIN vendor v ON v.id = dl.vendorId
  JOIN user u ON u.id = d.userId
`;
const REVISIT_ORDER = "ORDER BY r.createdAt DESC, r.id";

export function revisitsForResident(userId: string) {
  return all<RevisitVisit>(`${REVISIT_VIEW} WHERE d.userId = ? ${REVISIT_ORDER}`, userId);
}

export function revisitsForVendor(vendorId: string) {
  return all<RevisitVisit>(`${REVISIT_VIEW} WHERE dl.vendorId = ? ${REVISIT_ORDER}`, vendorId);
}

export function revisitsForOps() {
  return all<RevisitVisit>(`${REVISIT_VIEW} ${REVISIT_ORDER}`);
}

export function scheduleRevisit(jobId: string, serviceDate: string, slot: string) {
  if (!isValidRevisitDate(serviceDate) || serviceDate < revisitToday()) {
    throw new DealError("Pick today or a future date for the revisit.");
  }
  if (!REVISIT_SLOTS.some((window) => window === slot)) throw new DealError("Pick a valid appointment window.");

  return dealTransaction(() => {
    const visit = one<RevisitVisit>(`${REVISIT_VIEW} WHERE r.id = ?`, jobId);
    if (!visit) throw new DealError("Revisit not found.");
    if (visit.status !== "awaiting_schedule" && visit.status !== "scheduled") {
      throw new DealError("This revisit has already started.");
    }
    if (visit.serviceDate === serviceDate && visit.slot === slot) return visit.dealId;

    run("UPDATE revisit SET status = 'scheduled', serviceDate = ?, slot = ? WHERE id = ?", serviceDate, slot, visit.id);
    const rescheduled = visit.status === "scheduled";
    logEvent(visit.dealId, rescheduled ? "revisit_rescheduled" : "revisit_scheduled", { jobId, serviceDate, slot });
    notify([visit.residentId], {
      type: "revisit_scheduled",
      dealId: visit.dealId,
      title: rescheduled ? "Your revisit was rescheduled" : "Your revisit is booked",
      body: `${visit.vendorName} · ${formatRevisitDate(serviceDate)} · ${slot}. Your visit codes are in My bookings.`,
    });
    return visit.dealId;
  });
}

function startRevisit(visit: RevisitVisit, otp: string) {
  if (visit.status !== "scheduled") throw new DealError("Only a scheduled revisit can be started.");
  if (!isRevisitDue(visit.serviceDate)) throw new DealError("This revisit can start on the booked date.");
  if (otp.trim() !== visit.startOtp) throw new DealError("That start code doesn't match.");
  run("UPDATE revisit SET status = 'in_progress', startedAt = ? WHERE id = ?", now(), visit.id);
  logEvent(visit.dealId, "revisit_started", { jobId: visit.id });
  notify([visit.residentId], {
    type: "revisit_started",
    dealId: visit.dealId,
    title: "Your revisit has started",
    body: "Open My bookings for the completion code when the work is finished.",
  });
  return visit.dealId;
}

function completeRevisit(visit: RevisitVisit, otp: string) {
  if (visit.status !== "in_progress") throw new DealError("Only a revisit in progress can be completed.");
  if (otp.trim() !== visit.endOtp) throw new DealError("That completion code doesn't match.");
  run("UPDATE revisit SET status = 'completed', finishedAt = ? WHERE id = ?", now(), visit.id);
  logEvent(visit.dealId, "revisit_completed", { jobId: visit.id });
  notify([visit.residentId], {
    type: "revisit_completed",
    dealId: visit.dealId,
    title: "Your revisit is complete",
    body: "You can find the completed visit in My bookings.",
  });
  return visit.dealId;
}

// -------------------------------------------------------------- payments

function recordPayment(
  memberId: string, dealId: string, type: string, method: string, amountPaise: number, status: string,
) {
  run(
    "INSERT INTO payment (id,memberId,dealId,type,method,amountPaise,status,ref,createdAt) VALUES (?,?,?,?,?,?,?,?,?)",
    id("pay"), memberId, dealId, type, method, amountPaise, status, `sim_${Math.random().toString(36).slice(2, 10)}`, now(),
  );
}

export function paymentsForMember(memberId: string) {
  return all<{ id: string; type: string; method: string; amountPaise: number; status: string; createdAt: string }>(
    "SELECT * FROM payment WHERE memberId = ? ORDER BY createdAt", memberId,
  );
}

// -------------------------------------------------------------- disputes

export function issueWindowOpen(warrantyDays: number, finishedAt: string | null) {
  const warrantyMs = Math.max(2, warrantyDays) * DAY;
  return Date.now() - new Date(finishedAt ?? now()).getTime() <= warrantyMs;
}

export function raiseDispute(args: { jobId: string; userId: string; reason: string; detail: string }) {
  return dealTransaction(() => raiseJobIssue(args));
}

function raiseJobIssue(args: { jobId: string; userId: string; reason: string; detail: string }) {
  const job = one<{ id: string; dealId: string; status: string; finishedAt: string | null; memberId: string }>(
    "SELECT * FROM job WHERE id = ?", args.jobId,
  );
  if (!job) throw new DealError("Job not found.");
  if (job.status !== "completed") throw new DealError("You can raise an issue once the job is done.");
  const existing = one<{ id: string }>("SELECT id FROM dispute WHERE jobId = ? AND status = 'open'", args.jobId);
  if (existing) throw new DealError("You already have an open issue on this job.");

  const view = getDealView(job.dealId)!;
  if (!issueWindowOpen(view.sku.warrantyDays, job.finishedAt)) {
    throw new DealError("The issue reporting and warranty window on this job has closed.");
  }

  const member = view.members.find((m) => m.id === job.memberId);
  const amount = member ? (member.finalPricePaise ?? view.currentPricePaise) * member.units : 0;
  const disputeId = id("dsp");
  run(
    `INSERT INTO dispute (id,jobId,dealId,userId,reason,detail,status,resolution,amountPaise,createdAt,resolvedAt)
     VALUES (?,?,?,?,?,?,'open',NULL,?,?,NULL)`,
    disputeId, args.jobId, job.dealId, args.userId, args.reason, args.detail.slice(0, 500), amount, now(),
  );
  logEvent(job.dealId, "dispute_raised", { jobId: args.jobId, reason: args.reason });
  track(args.userId, "dispute_open", { dealId: job.dealId, reason: args.reason });

  const ops = all<{ id: string }>("SELECT id FROM user WHERE role = 'ops'").map((u) => u.id);
  notify(ops, {
    type: "dispute",
    dealId: job.dealId,
    title: `Issue raised: ${args.reason}`,
    body: `${view.sku.name} · ${view.society.name} · ${member?.flat ?? ""}`,
  });
  return disputeId;
}

export function resolveDispute(disputeId: string, resolution: "refund" | "revisit" | "rejected", note: string) {
  return dealTransaction(() => {
    const d = one<{ jobId: string; dealId: string; userId: string; amountPaise: number; status: string }>(
      "SELECT * FROM dispute WHERE id = ?", disputeId,
    );
    if (!d) throw new DealError("Issue not found.");
    if (d.status !== "open") throw new DealError("That issue is already closed.");

    if (resolution === "revisit") {
      const original = one<{ startOtp: string; endOtp: string }>(
        "SELECT startOtp, endOtp FROM job WHERE id = ? AND status = 'completed'", d.jobId,
      );
      if (!original) throw new DealError("The original visit must be completed before approving a revisit.");
      if (one(
        `SELECT r.id FROM revisit r JOIN dispute d ON d.id = r.disputeId
         WHERE d.jobId = ? AND r.status <> 'completed' LIMIT 1`,
        d.jobId,
      )) {
        throw new DealError("A revisit is already pending or underway for this booking.");
      }
      const revisitId = id("visit");
      run(
        "INSERT INTO revisit (id, disputeId, startOtp, endOtp, createdAt) VALUES (?, ?, ?, ?, ?)",
        revisitId, disputeId, ...newRevisitCodes(original.startOtp, original.endOtp), now(),
      );
      logEvent(d.dealId, "revisit_requested", { disputeId, jobId: revisitId });
    }

    if (resolution === "refund") {
      const member = one<{ id: string; paymentMethod: string }>(
        "SELECT m.id, m.paymentMethod FROM job j JOIN deal_member m ON m.id = j.memberId WHERE j.id = ?", d.jobId,
      );
      if (!member) throw new DealError("Could not find the booking to refund.");
      if (one("SELECT id FROM payment WHERE memberId = ? AND type='refund' AND status='refunded'", member.id)) {
        throw new DealError("This booking was already refunded.");
      }
      recordPayment(member.id, d.dealId, "refund", member.paymentMethod, d.amountPaise, "refunded");
    }

    run(
      "UPDATE dispute SET status='resolved', resolution=?, resolvedAt=? WHERE id = ?",
      `${resolution}: ${note.slice(0, 300)}`, now(), disputeId,
    );
    const titles = {
      refund: "Your refund is on the way",
      revisit: "Ops approved a revisit",
      rejected: "We looked into your issue",
    };
    notify([d.userId], {
      type: resolution === "revisit" ? "revisit_requested" : "dispute_resolved",
      dealId: d.dealId,
      title: titles[resolution],
      body: resolution === "revisit" ? "Your vendor will schedule the visit. Follow updates in My bookings." : note,
    });
    logEvent(d.dealId, "dispute_resolved", { disputeId, resolution });
    return disputeId;
  });
}

export function disputesForUser(userId: string) {
  return all<{
    id: string; jobId: string; dealId: string; reason: string; detail: string;
    status: string; resolution: string | null; amountPaise: number; createdAt: string;
  }>("SELECT * FROM dispute WHERE userId = ? ORDER BY createdAt DESC", userId);
}

export function openDisputes() {
  return all<{
    id: string; jobId: string; dealId: string; userId: string; reason: string; detail: string;
    status: string; resolution: string | null; amountPaise: number; createdAt: string;
    name: string; flat: string; dealName: string; societyName: string;
  }>(
    `SELECT d.*, u.name, j.flat, s.name AS dealName, soc.name AS societyName
     FROM dispute d
     JOIN user u ON u.id = d.userId
     JOIN job j ON j.id = d.jobId
     JOIN deal dl ON dl.id = d.dealId
     JOIN sku s ON s.id = dl.skuId
     JOIN society soc ON soc.id = dl.societyId
     ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.createdAt DESC`,
  );
}

// ------------------------------------------------------------------ vendor

export function vendorDeals(vendorId: string) {
  ensureTicker();
  tick();
  const rows = all<{ id: string }>("SELECT id FROM deal WHERE vendorId = ? ORDER BY serviceDate DESC", vendorId);
  return rows.map((r) => getDealView(r.id)!);
}

export function updateSlabs(dealId: string, slabs: Slab[]) {
  const row = one<DealRow>("SELECT * FROM deal WHERE id = ?", dealId);
  if (!row) throw new DealError("Deal not found.");
  if (row.status !== "open") throw new DealError("The ladder is frozen once a group locks.");
  const invalid = validateSlabs(row.listPricePaise, slabs);
  if (invalid) throw new DealError(invalid);

  // Once anyone has joined, the ladder may only ever get cheaper. A vendor cannot
  // re-price a group people are already standing in.
  const view = getDealView(dealId)!;
  if (view.basisCount > 0) {
    const raise = ladderRaisesPrice(
      view.listPricePaise, view.slabs, slabs, Math.max(view.basisCount, view.targetFlats),
    );
    if (raise) {
      throw new DealError(
        `That ladder charges more at ${raise.atCount} ${view.basisLabel} ` +
        `(${Math.round(raise.from / 100)} → ${Math.round(raise.to / 100)}). ` +
        `Once neighbours have joined the ladder can only get cheaper.`,
      );
    }
  }

  run("UPDATE deal SET slabs = ? WHERE id = ?", JSON.stringify(slabs), dealId);
  logEvent(dealId, "slabs_updated", { slabs });
  return getDealView(dealId)!;
}

// --------------------------------------------------------------------- ops

export function opsBoard() {
  ensureTicker();
  tick();
  const rows = all<{ id: string }>("SELECT id FROM deal ORDER BY createdAt DESC");
  const deals = rows.map((r) => getDealView(r.id)!);
  const gmv = deals
    .filter((d) => ["locked", "in_progress", "completed"].includes(d.status))
    .reduce((sum, d) => sum + d.members.reduce((s, m) => s + (m.finalPricePaise ?? d.currentPricePaise) * m.units, 0), 0);
  const closed = deals.filter((d) => ["locked", "in_progress", "completed", "expired"].includes(d.status));
  const filled = closed.filter((d) => d.status !== "expired");
  const refunds = all<{ n: number }>("SELECT COALESCE(SUM(amountPaise),0) AS n FROM payment WHERE type='refund'")[0].n;
  return {
    deals,
    atRisk: deals.filter((d) => d.status === "open" && d.basisCount < d.mvs && d.msToDeadline < 48 * 3_600_000),
    pending: deals.filter((d) => d.status === "pending"),
    gmvPaise: gmv,
    commissionPaise: commission(gmv),
    refundsPaise: refunds,
    fillRate: closed.length ? Math.round((filled.length / closed.length) * 100) : 0,
  };
}

/** The append-only audit trail, newest first — what settles a dispute. */
export function recentEvents(limit = 20) {
  return all<{ id: number; dealId: string; type: string; payload: string; createdAt: string; dealName: string; societyName: string }>(
    `SELECT e.*, s.name AS dealName, soc.name AS societyName
     FROM deal_event e
     JOIN deal d ON d.id = e.dealId
     JOIN sku s ON s.id = d.skuId
     JOIN society soc ON soc.id = d.societyId
     ORDER BY e.createdAt DESC, e.id DESC LIMIT ?`,
    limit,
  );
}

/** Ops/demo tool: add real neighbour joins so the ladder can be watched moving. */
export function simulateJoins(dealId: string, count: number) {
  const view = getDealView(dealId);
  if (!view) throw new DealError("Deal not found.");
  if (view.status !== "open") throw new DealError("Deal is not open.");
  const joinedIds = new Set(view.members.map((m) => m.userId));
  const candidates = all<{ id: string; flat: string }>(
    `SELECT u.id, r.flat FROM user u JOIN residency r ON r.userId = u.id
     WHERE r.societyId = ? AND u.role = 'resident' ORDER BY r.flat`,
    view.societyId,
  ).filter((c) => !joinedIds.has(c.id));

  let added = 0;
  for (const c of candidates) {
    if (added >= Math.max(0, count)) break;
    const fresh = getDealView(dealId)!;
    const slot = fresh.slotLoad.find((s) => !s.full);
    if (!slot) break;
    joinDeal({
      dealId, userId: c.id, flat: c.flat, units: 1,
      slot: slot.slot, paymentMethod: "upi", societyId: view.societyId,
    });
    added++;
  }
  return { added, view: getDealView(dealId)! };
}
