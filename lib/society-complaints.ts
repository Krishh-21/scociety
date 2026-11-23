import { all, id, inTransaction, one, run } from "./db";
import { notify } from "./notify";
import type { Me } from "./session";
import { requireSocietyCommittee, requireSocietyMember } from "./society-access";

export const COMPLAINT_CATEGORIES = ["Lift", "Water", "Electricity", "Parking", "Waste", "Security", "Other"] as const;
export const COMPLAINT_STATUS = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
} as const;

type Status = keyof typeof COMPLAINT_STATUS;
type ComplaintRow = {
  id: string;
  flat: string;
  resident: string;
  category: string;
  title: string;
  detail: string;
  status: Status;
  assignee: string | null;
  createdAt: string;
};
type ComplaintEvent = { id: number; complaintId: string; status: Status; note: string; createdAt: string };

export class ComplaintError extends Error {}

export function listComplaints(me: Me | null) {
  const { societyId, userId } = requireSocietyMember(me);
  const owner = me?.user.role === "secretary" ? null : userId;
  const where = "c.societyId = ? AND (? IS NULL OR c.userId = ?)";
  const complaints = all<ComplaintRow>(
    `SELECT c.*, u.name AS resident FROM society_complaint c JOIN user u ON u.id = c.userId
     WHERE ${where} ORDER BY c.status = 'resolved', c.updatedAt DESC, c.id`,
    societyId, owner, owner,
  );
  const events = all<ComplaintEvent>(
    `SELECT e.* FROM society_complaint_event e JOIN society_complaint c ON c.id = e.complaintId
     WHERE ${where} ORDER BY e.id`,
    societyId, owner, owner,
  );
  const history = new Map<string, ComplaintEvent[]>();
  for (const event of events) {
    const existing = history.get(event.complaintId);
    if (existing) existing.push(event);
    else history.set(event.complaintId, [event]);
  }
  return complaints.map((complaint) => ({ ...complaint, history: history.get(complaint.id) ?? [] }));
}

export function complaintSummary(societyId: string) {
  return one<{ openComplaints: number }>(
    "SELECT COUNT(*) AS openComplaints FROM society_complaint WHERE societyId = ? AND status <> 'resolved'",
    societyId,
  )!;
}

export function createComplaint(me: Me | null, category: string, title: string, detail: string) {
  const { societyId, userId, flat } = requireSocietyMember(me);
  const subject = title.trim();
  const description = detail.trim();
  if (!COMPLAINT_CATEGORIES.some((value) => value === category)) throw new ComplaintError("Choose a category.");
  if (subject.length < 3 || subject.length > 100) throw new ComplaintError("Enter a title of 3 to 100 characters.");
  if (description.length < 5 || description.length > 800) throw new ComplaintError("Add 5 to 800 characters of detail.");

  return inTransaction(() => {
    const complaintId = id("complaint");
    const now = new Date().toISOString();
    run(
      `INSERT INTO society_complaint (id, societyId, userId, flat, category, title, detail, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      complaintId, societyId, userId, flat, category, subject, description, now, now,
    );
    run(
      "INSERT INTO society_complaint_event (complaintId, actorId, status, note, createdAt) VALUES (?, ?, 'open', '', ?)",
      complaintId, userId, now,
    );
    const committee = all<{ userId: string }>(
      `SELECT r.userId FROM residency r JOIN user u ON u.id = r.userId
       WHERE r.societyId = ? AND r.status = 'verified' AND u.role = 'secretary' AND r.userId <> ?`,
      societyId, userId,
    );
    notify(committee.map((resident) => resident.userId), {
      type: "society_complaint", title: "A new society complaint", body: "Open the complaint queue to assign it.",
    });
    return complaintId;
  });
}

const NEXT_STATUS = { open: "assigned", assigned: "in_progress", in_progress: "resolved" } as const;

export function updateComplaint(me: Me | null, complaintId: string, status: string, assignee: string, note: string) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const staffName = assignee.trim();
  const update = note.trim();
  if (staffName.length > 80 || update.length > 400) throw new ComplaintError("Keep the name under 80 characters and the update under 400.");

  return inTransaction(() => {
    const complaint = one<{ status: Status; assignee: string | null; userId: string }>(
      "SELECT status, assignee, userId FROM society_complaint WHERE id = ? AND societyId = ?", complaintId, societyId,
    );
    if (!complaint) throw new ComplaintError("Complaint not found.");
    if (complaint.status === "resolved") throw new ComplaintError("This complaint is already resolved.");
    if (NEXT_STATUS[complaint.status] !== status) {
      throw new ComplaintError("Assign the complaint before starting work, then resolve it when the work is done.");
    }
    if (status === "assigned" && !staffName) throw new ComplaintError("Enter the staff member or team handling the complaint.");
    const now = new Date().toISOString();
    run(
      "UPDATE society_complaint SET status = ?, assignee = ?, updatedAt = ? WHERE id = ?",
      status, staffName || complaint.assignee, now, complaintId,
    );
    run(
      "INSERT INTO society_complaint_event (complaintId, actorId, status, note, createdAt) VALUES (?, ?, ?, ?, ?)",
      complaintId, userId, status, update, now,
    );
    notify([complaint.userId], {
      type: "society_complaint", title: "Your society complaint was updated", body: "Open Complaints to see the latest status.",
    });
  });
}
