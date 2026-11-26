import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isDemoMode } from "./auth-mode";
import { dealReturnHref } from "./deal-return";
import { all, id, inTransaction, one, run } from "./db";
import type { Residency, User } from "./types";

function sessionCookieName() {
  if (isDemoMode()) return "jodo_demo_session";
  return process.env.NODE_ENV === "production" ? "__Host-jodo_session" : "jodo_live_session";
}

function sessionKey(token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const mode = isDemoMode() ? "demo:" : "sms:";
  return mode + createHash("sha256").update(token).digest("hex");
}

export type Me = {
  user: User;
  residency: (Residency & { societyName: string }) | null;
};

const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const jar = await cookies();
  const name = sessionCookieName();
  const previous = sessionKey(jar.get(name)?.value);
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await inTransaction(async () => {
    if (previous) await run("DELETE FROM session WHERE token = ?", previous);
    await run(
      "INSERT INTO session (token,userId,createdAt,expiresAt) VALUES (?,?,?,?)",
      sessionKey(token), userId, new Date(now).toISOString(),
      new Date(now + SESSION_DAYS * 86_400_000).toISOString(),
    );
    await run("DELETE FROM session WHERE expiresAt < ?", new Date(now).toISOString());
  });
  jar.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  return token;
}

export async function signInDestination(user: Pick<User, "id" | "role">, next?: string) {
  if (user.role === "guard") {
    const active = await one("SELECT userId FROM guard_assignment WHERE userId = ? AND isActive = 1", user.id);
    return active ? "/society/visitors" : null;
  }
  if (user.role === "vendor") return "/vendor";
  if (user.role === "ops") return "/ops";
  const verified = await one("SELECT id FROM residency WHERE userId = ? AND status = 'verified'", user.id);
  return verified ? next ?? "/" : dealReturnHref("/onboarding", next);
}

export async function destroySession() {
  const jar = await cookies();
  const name = sessionCookieName();
  const token = sessionKey(jar.get(name)?.value);
  if (token) await run("DELETE FROM session WHERE token = ?", token);
  jar.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export async function getMe(): Promise<Me | null> {
  const jar = await cookies();
  const token = sessionKey(jar.get(sessionCookieName())?.value);
  if (!token) return null;
  const row = await one<User & {
    residencyId: string; societyId: string; societyName: string;
    flat: string; residencyType: Residency["type"]; residencyStatus: Residency["status"];
  }>(
    `SELECT u.*, r.id AS residencyId, r.societyId, sc.name AS societyName,
            r.flat, r.type AS residencyType, r.status AS residencyStatus
     FROM session s JOIN user u ON u.id = s.userId
     LEFT JOIN residency r ON r.id = (
       SELECT candidate.id FROM residency candidate WHERE candidate.userId = u.id
       ORDER BY CASE candidate.status WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                candidate.createdAt DESC, candidate.id LIMIT 1
     )
     LEFT JOIN society sc ON sc.id = r.societyId
     WHERE s.token = ? AND s.expiresAt > ?`,
    token, new Date().toISOString(),
  );
  if (!row) return null;
  const { residencyId, societyId, societyName, flat, residencyType, residencyStatus, ...user } = row;
  const residency = residencyId && societyName
    ? { id: residencyId, userId: user.id, societyId, societyName, flat, type: residencyType, status: residencyStatus }
    : null;
  return { user, residency };
}

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) throw new Error("UNAUTHENTICATED");
  return me;
}

export async function findOrCreateUser(phone: string, name?: string): Promise<User> {
  const existing = await one<User>("SELECT * FROM user WHERE phone = ?", phone);
  if (existing) return existing;
  await run(
    "INSERT INTO user (id,phone,name,role,vendorId) VALUES (?,?,?,'resident',NULL) ON CONFLICT(phone) DO NOTHING",
    id("usr"), phone, name ?? "New resident",
  );
  return (await one<User>("SELECT * FROM user WHERE phone = ?", phone))!;
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

/** Submits a request for committee review. Demo claims are verified immediately. */
export async function claimResidency(args: {
  userId: string; name: string; societyId: string; flat: string; type: "owner" | "tenant";
}): Promise<{ id: string; flat: string; societyName: string; status: "pending" | "verified" }> {
  const name = args.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new ResidencyError("Tell your neighbours your name.");
  if (name.length > 60) throw new ResidencyError("That name is a little long.");

  const society = await one<{ id: string; name: string }>("SELECT id, name FROM society WHERE id = ?", args.societyId);
  if (!society) throw new ResidencyError("Pick your society.");

  const flat = normaliseFlat(args.flat);
  if (!flat) throw new ResidencyError("Flat should look like A-402.");

  const status = isDemoMode() ? "verified" : "pending";
  return inTransaction(async () => {
    // A guard enrollment can supersede the resident session that started this request.
    const user = await one<Pick<User, "role">>("SELECT role FROM user WHERE id = ?", args.userId);
    if (user?.role !== "resident" && user?.role !== "secretary") {
      throw new ResidencyError("Sign in with a resident account to request flat verification.");
    }
    const current = await one<Pick<Residency, "id" | "societyId" | "flat" | "status">>(
      `SELECT id, societyId, flat, status FROM residency WHERE userId = ? AND status IN ('verified', 'pending')
       ORDER BY CASE status WHEN 'verified' THEN 0 ELSE 1 END, createdAt DESC, id LIMIT 1`,
      args.userId,
    );
    if (current) {
      if (current.societyId !== society.id || current.flat !== flat) {
        throw new ResidencyError(current.status === "verified"
          ? "Your flat is already verified. Contact your society committee to change it."
          : "You already have a flat request waiting for review. Contact your society committee to make a change.");
      }
      if (current.status === "verified") {
        await run("UPDATE user SET name = ? WHERE id = ?", name, args.userId);
        await run("UPDATE residency SET type = ? WHERE id = ?", args.type, current.id);
        return { id: current.id, flat, societyName: society.name, status: "verified" };
      }
      if (status === "pending") return { id: current.id, flat, societyName: society.name, status };
    }

    if (status === "verified") {
      const taken = await one(
        "SELECT id FROM residency WHERE societyId = ? AND flat = ? AND status = 'verified'",
        society.id, flat,
      );
      if (taken) {
        throw new ResidencyError(
          `${flat} is already verified in ${society.name}. If you live there, ask your society secretary for help.`,
        );
      }
    }

    await run("UPDATE user SET name = ? WHERE id = ?", name, args.userId);
    const requestId = id("res");
    await run("DELETE FROM residency WHERE userId = ? AND status IN ('rejected', 'pending')", args.userId);
    await run(
      "INSERT INTO residency (id,userId,societyId,flat,type,status,verifiedVia,createdAt) VALUES (?,?,?,?,?,?,?,?)",
      requestId, args.userId, society.id, flat, args.type, status, status === "verified" ? "demo" : null, new Date().toISOString(),
    );
    return { id: requestId, flat, societyName: society.name, status };
  });
}

export async function societies() {
  return all<{ id: string; name: string; locality: string; city: string; flatCount: number; residents: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM residency r WHERE r.societyId = s.id AND r.status='verified') AS residents
     FROM society s ORDER BY residents DESC`,
  );
}
