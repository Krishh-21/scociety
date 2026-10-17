import type { Slab } from "./types";

/**
 * The price ladder. Rules (enforced here and in lib/deals.ts):
 *  1. Everyone pays the FINAL slab price, including the first joiner.
 *  2. While a deal is open the price may only ever fall.
 *  3. The price can never go below the vendor's floor (the lowest slab published).
 */
export function currentPrice(listPricePaise: number, slabs: Slab[], flatsJoined: number): number {
  const sorted = [...slabs].sort((a, b) => a.minFlats - b.minFlats);
  let price = listPricePaise;
  for (const s of sorted) if (flatsJoined >= s.minFlats) price = s.pricePaise;
  return price;
}

/**
 * The price a member is actually charged: the slab price, but never above the lowest
 * price this deal has already offered. Someone leaving must not raise what the rest pay.
 */
export function effectivePrice(slabPricePaise: number, floorPricePaise: number | null): number {
  if (floorPricePaise == null) return slabPricePaise;
  return Math.min(slabPricePaise, floorPricePaise);
}

export function nextSlab(
  slabs: Slab[],
  joined: number,
): { away: number; pricePaise: number; minFlats: number } | null {
  const sorted = [...slabs].sort((a, b) => a.minFlats - b.minFlats);
  const next = sorted.find((s) => s.minFlats > joined);
  if (!next) return null;
  return { away: next.minFlats - joined, pricePaise: next.pricePaise, minFlats: next.minFlats };
}

export function savings(listPricePaise: number, currentPaise: number) {
  return Math.max(0, listPricePaise - currentPaise);
}

export function discountPct(listPricePaise: number, currentPaise: number) {
  if (!listPricePaise) return 0;
  return Math.round(((listPricePaise - currentPaise) / listPricePaise) * 100);
}

export function rupees(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export function validateSlabs(listPricePaise: number, slabs: Slab[]): string | null {
  if (!slabs.length) return "A deal needs at least one slab.";
  const sorted = [...slabs].sort((a, b) => a.minFlats - b.minFlats);
  let prevPrice = listPricePaise;
  let prevFlats = 1;
  for (const s of sorted) {
    if (s.minFlats <= prevFlats) return "Each slab must need more flats than the one before it.";
    if (s.pricePaise >= prevPrice) return "Each slab must be cheaper than the one before it.";
    if (s.pricePaise <= 0) return "Slab prices must be positive.";
    prevPrice = s.pricePaise;
    prevFlats = s.minFlats;
  }
  return null;
}

/**
 * A ladder edit may never cost a member more than the ladder they joined under.
 * Compares the two ladders at every count that matters; returns the first count
 * where the new ladder is dearer, or null when the edit is safe.
 */
export function ladderRaisesPrice(
  listPricePaise: number,
  oldSlabs: Slab[],
  newSlabs: Slab[],
  upTo: number,
): { atCount: number; from: number; to: number } | null {
  const counts = new Set<number>([1, upTo]);
  for (const s of [...oldSlabs, ...newSlabs]) {
    counts.add(s.minFlats);
    counts.add(Math.max(1, s.minFlats - 1));
  }
  for (const n of [...counts].sort((a, b) => a - b)) {
    const from = currentPrice(listPricePaise, oldSlabs, n);
    const to = currentPrice(listPricePaise, newSlabs, n);
    if (to > from) return { atCount: n, from, to };
  }
  return null;
}

export const COMMISSION_BPS = 1500; // 15% of GMV, charged to the vendor

export function commission(grossPaise: number): number {
  return Math.round((grossPaise * COMMISSION_BPS) / 10_000);
}

export function countdown(ms: number): string {
  if (ms <= 0) return "Closed";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
