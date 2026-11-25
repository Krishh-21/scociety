import { all, id, inTransaction, one, run } from "./db";
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

export async function createLead(input: {
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

  return inTransaction(async () => {
    // One request per phone per day is plenty; a second submit just says thanks again.
    const recent = await one<{ id: string }>(
      "SELECT id FROM lead WHERE kind = ? AND phone = ? AND createdAt > ?",
      input.kind, phone, new Date(Date.now() - 86_400_000).toISOString(),
    );
    if (recent) return { id: recent.id, duplicate: true };

    const leadId = id("lead");
    await run(
      "INSERT INTO lead (id,kind,name,phone,org,city,detail,status,createdAt) VALUES (?,?,?,?,?,?,?,'new',?)",
      leadId, input.kind, name, phone, org, city, JSON.stringify(input.detail ?? {}), new Date().toISOString(),
    );
    return { id: leadId, duplicate: false };
  });
}

export async function listLeads(limit = 50): Promise<Lead[]> {
  return (await all<Omit<Lead, "detail"> & { detail: string }>(
    "SELECT * FROM lead ORDER BY createdAt DESC LIMIT ?",
    limit,
  )).map((l) => ({ ...l, detail: JSON.parse(l.detail || "{}") }));
}

export async function markLead(leadId: string, status: "contacted" | "won" | "lost") {
  await run("UPDATE lead SET status = ? WHERE id = ?", status, leadId);
}

/** Public numbers for the landing page — real ones from the database, never invented. */
export async function publicStats() {
  const stats = await one<{ savedPaise: number; confirmed: number; societies: number; neighbours: number }>(
    `SELECT (
        SELECT CAST(COALESCE(SUM(CAST(CASE WHEN d.listPricePaise > m.finalPricePaise
          THEN d.listPricePaise - m.finalPricePaise ELSE 0 END AS BIGINT) * m.units), 0) AS BIGINT)
        FROM deal_member m JOIN deal d ON d.id = m.dealId
        WHERE m.finalPricePaise IS NOT NULL
      ) AS savedPaise,
      (SELECT COUNT(*) FROM deal WHERE status IN ('locked','in_progress','completed')) AS confirmed,
      (SELECT COUNT(*) FROM society) AS societies,
      (SELECT COUNT(*) FROM residency WHERE status = 'verified') AS neighbours`,
  );
  return stats!;
}
