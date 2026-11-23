export const REVISIT_SLOTS = ["08:00–10:00", "10:00–12:00", "12:00–14:00", "16:00–18:00"] as const;

const indiaDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" });
const visitDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});

export function revisitToday() {
  return indiaDate.format(new Date());
}

export function isRevisitDue(serviceDate: string | null) {
  return serviceDate !== null && serviceDate <= revisitToday();
}

export function formatRevisitDate(serviceDate: string) {
  return visitDate.format(new Date(`${serviceDate}T00:00:00Z`));
}

/** Service dates are calendar dates in India, stored without a time or offset. */
export function isValidRevisitDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
