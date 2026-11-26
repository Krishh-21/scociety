/**
 * Where a notification takes you. Shared by the notifications screen and the
 * dashboard's "Updates" list so the two can never disagree, and kept free of
 * server-only imports so it can be unit-tested.
 */

type Linkable = { type: string; dealId: string | null; gateVisitId: string | null };

const SOCIETY_UPDATES: Record<string, string> = {
  society_complaint: "/society/complaints",
  society_notice: "/society/community#notices",
  society_meeting: "/society/community#meetings",
  society_poll: "/society/community#polls",
  society_dues_reminder: "/society/finance",
  gate_request: "/society/visitors#gate-entry-requests",
};

const BOOKING_UPDATES = new Set([
  "locked", "service_day", "job_done", "dispute_resolved",
  "revisit_requested", "revisit_scheduled", "revisit_started", "revisit_completed",
]);

/** Updates that carry good news get the calm success tint. */
export const SUCCESS_UPDATES = new Set(["price_drop", "locked", "job_done", "revisit_completed"]);

export function notificationHref(n: Linkable): string | undefined {
  // A gate ticket opens the exact entry card, not just the visitors page.
  if (n.gateVisitId) return `/society/visitors#visit-${n.gateVisitId}`;
  if (n.dealId) return BOOKING_UPDATES.has(n.type) ? `/bookings#booking-${n.dealId}` : `/deal/${n.dealId}`;
  return SOCIETY_UPDATES[n.type];
}

/** Which family an update belongs to — drives its icon on the dashboard. */
export function notificationArea(type: string): "gate" | "notice" | "dues" | "helpdesk" | "meeting" | "booking" {
  if (type.startsWith("gate")) return "gate";
  if (type === "society_notice") return "notice";
  if (type === "society_dues_reminder") return "dues";
  if (type === "society_complaint") return "helpdesk";
  if (type === "society_meeting" || type === "society_poll") return "meeting";
  return "booking";
}
