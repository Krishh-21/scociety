import { all, id, one, run } from "./db";
import { isValidPhone } from "./session";

/**
 * Interest from outside the app: a secretary asking for JODO in their society, or
 * a vendor asking to be listed. Ops works these by hand at first — this is the
 * GTM funnel from docs/01-product-plan.md §9, secretary-first.
 */
export type LeadKind = "society" | "vendor";

export type Lead = {
  id: string;
  kind: LeadKind;
  name: string;
  phone: string;
  org: string;
  city: string;
  detail: Record<string, unknown>;
  status: string;
  createdAt: string;
};

export class LeadError extends Error {}

const clean = (v: unknown, max = 80) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export function createLead(input: {
  kind: LeadKind;
  name: unknown;
  phone: unknown;
  org: unknown;
  city: unknown;
  detail?: Record<string, unknown>;
}) {
  const name = clean(input.name);
  const phone = clean(input.phone, 20).replace(/\D/g, "");
  const org = clean(input.org, 100);
  const city = clean(input.city, 40);

  if (name.length < 2) throw new LeadError("Tell us your name.");
  if (!isValidPhone(phone)) throw new LeadError("Enter a 10-digit mobile number.");
  if (org.length < 2) {
    throw new LeadError(input.kind === "society" ? "Which society is it?" : "What's the business called?");
  }
  if (city.length < 2) throw new LeadError("Which city?");

  // One request per phone per day is plenty; a second submit just says thanks again.
  const recent = one<{ id: string }>(
    "SELECT id FROM lead WHERE kind = ? AND phone = ? AND createdAt > ?",
    input.kind, phone, new Date(Date.now() - 86_400_000).toISOString(),
  );
  if (recent) return { id: recent.id, duplicate: true };

  const leadId = id("lead");
  run(
    "INSERT INTO lead (id,kind,name,phone,org,city,detail,status,createdAt) VALUES (?,?,?,?,?,?,?,'new',?)",
    leadId, input.kind, name, phone, org, city, JSON.stringify(input.detail ?? {}), new Date().toISOString(),
  );
  return { id: leadId, duplicate: false };
}

export function listLeads(limit = 50): Lead[] {
  return all<Omit<Lead, "detail"> & { detail: string }>(
    "SELECT * FROM lead ORDER BY createdAt DESC LIMIT ?",
    limit,
  ).map((l) => ({ ...l, detail: JSON.parse(l.detail || "{}") }));
}

export function markLead(leadId: string, status: "contacted" | "won" | "lost") {
  run("UPDATE lead SET status = ? WHERE id = ?", status, leadId);
}

/** Public numbers for the landing page — real ones from the database, never invented. */
export function publicStats() {
  const saved = one<{ n: number }>(
    `SELECT COALESCE(SUM(MAX(d.listPricePaise - m.finalPricePaise, 0) * m.units), 0) AS n
     FROM deal_member m JOIN deal d ON d.id = m.dealId WHERE m.finalPricePaise IS NOT NULL`,
  )!.n;
  const confirmed = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM deal WHERE status IN ('locked','in_progress','completed')",
  )!.n;
  const societies = one<{ n: number }>("SELECT COUNT(*) AS n FROM society")!.n;
  const neighbours = one<{ n: number }>("SELECT COUNT(*) AS n FROM residency WHERE status = 'verified'")!.n;
  return { savedPaise: saved, confirmed, societies, neighbours };
}
