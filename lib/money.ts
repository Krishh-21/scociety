import { commission } from "./pricing";
import type { DealView } from "./types";

/**
 * One place where a deal turns into money. Everything else (vendor payouts, the
 * ops board, society savings) reads these, so the three used to disagree.
 */
export function memberPricePaise(deal: DealView, member: { finalPricePaise: number | null }): number {
  return member.finalPricePaise ?? deal.currentPricePaise;
}

export function memberTotalPaise(
  deal: DealView,
  member: { finalPricePaise: number | null; units: number },
): number {
  return memberPricePaise(deal, member) * member.units;
}

/** What the group is worth to the vendor, at today's price. */
export function dealGrossPaise(deal: DealView): number {
  return deal.members.reduce((sum, m) => sum + memberTotalPaise(deal, m), 0);
}

export function dealCommissionPaise(deal: DealView): number {
  return commission(dealGrossPaise(deal));
}

export function dealNetPaise(deal: DealView): number {
  const gross = dealGrossPaise(deal);
  return gross - commission(gross);
}

/** What the building saved against booking flat by flat. */
export function dealSavingsPaise(deal: DealView): number {
  return deal.members.reduce(
    (sum, m) => sum + Math.max(0, deal.listPricePaise - memberPricePaise(deal, m)) * m.units,
    0,
  );
}

export function isBookedState(status: string): boolean {
  return status === "locked" || status === "in_progress" || status === "completed";
}
