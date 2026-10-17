import { all, id, one, run } from "./db";

export type Notification = {
  id: string;
  userId: string;
  dealId: string | null;
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
export function notify(
  userIds: string[],
  n: { type: string; title: string; body: string; dealId?: string },
) {
  const at = new Date().toISOString();
  for (const userId of new Set(userIds)) {
    run(
      "INSERT INTO notification (id,userId,dealId,type,title,body,createdAt,readAt) VALUES (?,?,?,?,?,?,?,NULL)",
      id("ntf"), userId, n.dealId ?? null, n.type, n.title, n.body, at,
    );
  }
}

export function listNotifications(userId: string, limit = 40): Notification[] {
  return all<Notification>(
    "SELECT * FROM notification WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
    userId, limit,
  );
}

export function unreadCount(userId: string): number {
  return one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notification WHERE userId = ? AND readAt IS NULL",
    userId,
  )!.n;
}

export function markAllRead(userId: string) {
  run("UPDATE notification SET readAt = ? WHERE userId = ? AND readAt IS NULL", new Date().toISOString(), userId);
}

/** Everyone verified in a society — the audience for a new group. */
export function societyResidentIds(societyId: string, except?: string): string[] {
  return all<{ userId: string }>(
    "SELECT userId FROM residency WHERE societyId = ? AND status = 'verified'",
    societyId,
  )
    .map((r) => r.userId)
    .filter((uid) => uid !== except);
}
