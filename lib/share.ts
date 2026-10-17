import { formatDate, rupees } from "./pricing";
import type { DealView } from "./types";

/**
 * The WhatsApp card is the actual distribution moment — a group spreads in the
 * society group, not in the app. One line of numbers, then the link.
 */
export function shareText(deal: DealView, origin = ""): string {
  const link = `${origin}/deal/${deal.id}`;
  if (deal.status === "locked" || deal.status === "in_progress") {
    return [
      `✅ ${deal.society.name}: ${deal.sku.name} is confirmed for ${formatDate(deal.serviceDate)}.`,
      `${deal.basisCount} ${deal.basisLabel}, one vendor, ${rupees(deal.currentPricePaise)} per ${deal.sku.unitLabel}.`,
      link,
    ].join("\n");
  }
  const target = deal.slabs.at(-1)!;
  const next = deal.nextSlab
    ? `${deal.nextSlab.away} more and it drops to ${rupees(deal.nextSlab.pricePaise)}.`
    : `Best price ${rupees(target.pricePaise)} unlocked.`;
  return [
    `${deal.society.name} — ${deal.sku.name}, ${formatDate(deal.serviceDate)}.`,
    `${deal.basisCount}/${deal.targetFlats} ${deal.basisLabel} joined · ${rupees(deal.currentPricePaise)} per ${deal.sku.unitLabel} (was ${rupees(deal.listPricePaise)}).`,
    next,
    `Nothing is charged unless ${deal.mvs} ${deal.basisLabel} join.`,
    link,
  ].join("\n");
}
