import { cookies } from "next/headers";
import { all, id, inTransaction, one, run } from "./db";
import type { Residency, User } from "./types";

const COOKIE = "jodo_session";

export type Me = {
  user: User;
  residency: (Residency & { societyName: string }) | null;
};

const SESSION_DAYS = 60;

export async function createSession(userId: string) {
  const token = id("sess");
  const now = Date.now();
  run(
    "INSERT INTO session (token,userId,createdAt,expiresAt) VALUES (?,?,?,?)",
    token, userId, new Date(now).toISOString(),
    new Date(now + SESSION_DAYS * 86_400_000).toISOString(),
  );
  run("DELETE FROM session WHERE expiresAt IS NOT NULL AND expiresAt < ?", new Date(now).toISOString());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  return token;
}

const otpAttempts = new Map<string, { n: number; since: number }>();
const OTP_WINDOW_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

/** Crude but real: five wrong codes per phone per ten minutes. */
export function otpAttemptAllowed(phone: string): boolean {
  const now = Date.now();
  const rec = otpAttempts.get(phone);
  if (!rec || now - rec.since > OTP_WINDOW_MS) {
    otpAttempts.set(phone, { n: 1, since: now });
    return true;
  }
  rec.n += 1;
  return rec.n <= OTP_MAX_ATTEMPTS;
}

export function otpAttemptsReset(phone: string) {
  otpAttempts.delete(phone);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run("DELETE FROM session WHERE token = ?", token);
  jar.delete(COOKIE);
}

export async function getMe(): Promise<Me | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = one<User & { token: string }>(
    `SELECT u.* FROM session s JOIN user u ON u.id = s.userId
     WHERE s.token = ? AND (s.expiresAt IS NULL OR s.expiresAt > ?)`,
    token, new Date().toISOString(),
  );
  if (!row) return null;
  const residency = one<Residency & { societyName: string }>(
    `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
     WHERE r.userId = ? ORDER BY r.createdAt DESC LIMIT 1`,
    row.id,
  );
  return { user: row, residency };
}

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) throw new Error("UNAUTHENTICATED");
  return me;
}

export function findOrCreateUser(phone: string, name?: string): User {
  const existing = one<User>("SELECT * FROM user WHERE phone = ?", phone);
  if (existing) return existing;
  const uid = id("usr");
  run("INSERT INTO user (id,phone,name,role,vendorId) VALUES (?,?,?,?,NULL)", uid, phone, name ?? "New resident", "resident");
  return one<User>("SELECT * FROM user WHERE id = ?", uid)!;
}

export class ResidencyError extends Error {}

/** Indian mobile numbers: ten digits, starting 6–9. */
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

/** "a402", "A 402", "A/402" and "A-402" are the same flat. */
export function normaliseFlat(raw: string): string | null {
  const m = raw.trim().toUpperCase().replace(/\s+/g, "").match(/^([A-Z]{1,2})[-/]?(\d{3,4})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Puts a user in a flat. A flat already held by a verified neighbour can't be
 * claimed by somebody else — otherwise anyone could join groups, read
 * neighbours' names and pay as "A-402".
 */
export function claimResidency(args: {
  userId: string; name: string; societyId: string; flat: string; type: "owner" | "tenant";
}) {
  const name = args.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new ResidencyError("Tell your neighbours your name.");
  if (name.length > 60) throw new ResidencyError("That name is a little long.");

  const society = one<{ id: string; name: string }>("SELECT id, name FROM society WHERE id = ?", args.societyId);
  if (!society) throw new ResidencyError("Pick your society.");

  const flat = normaliseFlat(args.flat);
  if (!flat) throw new ResidencyError("Flat should look like A-402.");

  return inTransaction(() => {
    const verified = one<{ id: string; societyId: string; flat: string }>(
      "SELECT id, societyId, flat FROM residency WHERE userId = ? AND status = 'verified' ORDER BY createdAt DESC, id LIMIT 1",
      args.userId,
    );
    if (verified && (verified.societyId !== society.id || verified.flat !== flat)) {
      throw new ResidencyError("Your flat is already verified. Contact your society committee to change it.");
    }
    const taken = one<{ userId: string }>(
      "SELECT userId FROM residency WHERE societyId = ? AND flat = ? AND status = 'verified' AND userId <> ?",
      society.id, flat, args.userId,
    );
    if (taken) {
      throw new ResidencyError(
        `${flat} is already verified in ${society.name}. If you live there, ask your society secretary for help.`,
      );
    }

    run("UPDATE user SET name = ? WHERE id = ?", name, args.userId);
    if (verified) {
      run("UPDATE residency SET type = ? WHERE id = ?", args.type, verified.id);
    } else {
      run("DELETE FROM residency WHERE userId = ?", args.userId);
      run(
        "INSERT INTO residency (id,userId,societyId,flat,type,status,verifiedVia,createdAt) VALUES (?,?,?,?,?,?,?,?)",
        id("res"), args.userId, society.id, flat, args.type, "verified", "neighbour_vouch", new Date().toISOString(),
      );
    }
    return { flat, societyName: society.name };
  });
}

export function societies() {
  return all<{ id: string; name: string; locality: string; city: string; flatCount: number; residents: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM residency r WHERE r.societyId = s.id AND r.status='verified') AS residents
     FROM society s ORDER BY residents DESC`,
  );
}
