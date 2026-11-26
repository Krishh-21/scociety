import { all, id, one, run } from "./db";
import { isDemoMode } from "./auth-mode";

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

const VISIBLE_TO_RECIPIENT = `notification.userId = ? AND (
  (? = 1 AND notification.residencyId IS NULL)
  OR notification.residencyId = (
    SELECT r.id FROM residency r
    WHERE r.userId = notification.userId AND r.status = 'verified'
    ORDER BY r.createdAt DESC, r.id LIMIT 1
  )
)`;

/** Society alerts belong to the verified residency held when they were sent. */
export async function notify(
  userIds: string[],
  n: { type: string; title: string; body: string; societyId?: string; dealId?: string; gateVisitId?: string },
) {
  if (!n.societyId && !isDemoMode()) return;
  const at = new Date().toISOString();
  const recipients = [...new Set(userIds)];
  const batchSize = 100;
  for (let offset = 0; offset < recipients.length; offset += batchSize) {
    const batch = recipients.slice(offset, offset + batchSize);
    const scope = n.societyId ? await all<{ userId: string; id: string }>(
      `SELECT userId, id FROM residency
       WHERE societyId = ? AND status = 'verified' AND userId IN (${batch.map(() => "?").join(",")})
       ORDER BY createdAt, id`,
      n.societyId, ...batch,
    ) : null;
    const residencyByUser = new Map(scope?.map(({ userId, id: residencyId }) => [userId, residencyId]));
    const deliverable = scope ? batch.filter((userId) => residencyByUser.has(userId)) : batch;
    if (!deliverable.length) continue;
    await run(
      `INSERT INTO notification (id,userId,dealId,gateVisitId,residencyId,type,title,body,createdAt)
       VALUES ${deliverable.map(() => "(?,?,?,?,?,?,?,?,?)").join(",")}`,
      ...deliverable.flatMap((userId) => [
        id("ntf"), userId, n.dealId ?? null, n.gateVisitId ?? null, residencyByUser.get(userId) ?? null, n.type, n.title, n.body, at,
      ]),
    );
  }
}

export async function listNotifications(userId: string, limit = 40): Promise<Notification[]> {
  return all<Notification>(
    `SELECT * FROM notification WHERE ${VISIBLE_TO_RECIPIENT} ORDER BY createdAt DESC, id DESC LIMIT ?`,
    userId, Number(isDemoMode()), limit,
  );
}

export async function unreadCount(userId: string): Promise<number> {
  const count = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notification WHERE ${VISIBLE_TO_RECIPIENT} AND readAt IS NULL`,
    userId, Number(isDemoMode()),
  );
  return count!.n;
}

export async function markAllRead(userId: string) {
  await run(
    `UPDATE notification SET readAt = ? WHERE ${VISIBLE_TO_RECIPIENT} AND readAt IS NULL`,
    new Date().toISOString(), userId, Number(isDemoMode()),
  );
}

/** Everyone verified in a society — the audience for a new group. */
export async function societyResidentIds(societyId: string, except?: string): Promise<string[]> {
  const residents = await all<{ userId: string }>(
    "SELECT userId FROM residency WHERE societyId = ? AND status = 'verified'",
    societyId,
  );
  return residents.map((r) => r.userId).filter((uid) => uid !== except);
}
