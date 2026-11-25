import { all, id, one, run } from "./db";

export type Notification = {
  id: string;
  userId: string;
  dealId: string | null;
  gateVisitId: string | null;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/**
 * In this build a notification is a row and a bell. In production the same call
 * site fans out to FCM, WhatsApp and SMS — see docs/02-ux-flows.md §5 for which
 * of these are transactional (price drops change what you owe) and which are not.
 */
export async function notify(
  userIds: string[],
  n: { type: string; title: string; body: string; dealId?: string; gateVisitId?: string },
) {
  const at = new Date().toISOString();
  const recipients = [...new Set(userIds)];
  const batchSize = 100;
  for (let offset = 0; offset < recipients.length; offset += batchSize) {
    const batch = recipients.slice(offset, offset + batchSize);
    await run(
      `INSERT INTO notification (id,userId,dealId,gateVisitId,type,title,body,createdAt)
       VALUES ${batch.map(() => "(?,?,?,?,?,?,?,?)").join(",")}`,
      ...batch.flatMap((userId) => [id("ntf"), userId, n.dealId ?? null, n.gateVisitId ?? null, n.type, n.title, n.body, at]),
    );
  }
}

export async function listNotifications(userId: string, limit = 40): Promise<Notification[]> {
  return all<Notification>(
    "SELECT * FROM notification WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
    userId, limit,
  );
}

export async function unreadCount(userId: string): Promise<number> {
  const count = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notification WHERE userId = ? AND readAt IS NULL",
    userId,
  );
  return count!.n;
}

export async function markAllRead(userId: string) {
  await run("UPDATE notification SET readAt = ? WHERE userId = ? AND readAt IS NULL", new Date().toISOString(), userId);
}

/** Everyone verified in a society — the audience for a new group. */
export async function societyResidentIds(societyId: string, except?: string): Promise<string[]> {
  const residents = await all<{ userId: string }>(
    "SELECT userId FROM residency WHERE societyId = ? AND status = 'verified'",
    societyId,
  );
  return residents.map((r) => r.userId).filter((uid) => uid !== except);
}
