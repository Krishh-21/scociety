import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { inTransaction, one, run } from "./db";
import type { User } from "./types";

const TTL_SECONDS = 10 * 60;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const LINK_ID = /^[A-Za-z0-9_-]{22}$/;

type Identity = { subject: string; email: string };
type PendingLink = Identity & { id: string };
type CookieJar = Awaited<ReturnType<typeof cookies>>;

export function authCookieName(name: string) {
  return process.env.NODE_ENV === "production" ? "__Host-" + name : name;
}

export function writeAuthCookie(jar: CookieJar, name: string, value: string, maxAge = TTL_SECONDS) {
  jar.set(authCookieName(name), value, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge,
  });
}

export function authRedirect(url: URL) {
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class AccountLinkError extends Error {}

export function accountLink(method: "google" | "email", enabled: () => boolean) {
  const label = method === "google" ? "Google account" : "email address";
  const pendingTable = method + "_link";
  const identityTable = method + "_identity";
  const cookie = "jodo_" + method + "_link";
  const expired = "This " + (method === "google" ? "Google" : "email") + " sign-in expired. Start again or continue with SMS.";

  async function pendingHash() {
    if (!enabled()) return null;
    const token = (await cookies()).get(authCookieName(cookie))?.value;
    return token && TOKEN.test(token) ? tokenHash(token) : null;
  }

  async function pending() {
    const hash = await pendingHash();
    if (!hash) return null;
    return one<PendingLink>(
      `SELECT id,subject,email FROM ${pendingTable} WHERE tokenHash = ? AND expiresAt > ?`, hash, new Date().toISOString(),
    );
  }

  return {
    findUser(subject: string) {
      return one<User>(`SELECT u.* FROM ${identityTable} i JOIN user u ON u.id = i.userId WHERE i.subject = ?`, subject);
    },
    async clear() {
      const jar = await cookies();
      const token = jar.get(authCookieName(cookie))?.value;
      if (!token) return;
      writeAuthCookie(jar, cookie, "", 0);
      if (TOKEN.test(token) && enabled()) await run(`DELETE FROM ${pendingTable} WHERE tokenHash = ?`, tokenHash(token));
    },
    async begin(identity: Identity) {
      const token = randomBytes(32).toString("base64url");
      const id = randomBytes(16).toString("base64url");
      const now = new Date();
      await inTransaction(async () => {
        await run(`DELETE FROM ${pendingTable} WHERE expiresAt <= ?`, now.toISOString());
        await run(
          `INSERT INTO ${pendingTable} (id,tokenHash,subject,email,expiresAt) VALUES (?,?,?,?,?)`,
          id, tokenHash(token), identity.subject, identity.email, new Date(now.getTime() + TTL_SECONDS * 1000).toISOString(),
        );
      });
      writeAuthCookie(await cookies(), cookie, token);
    },
    pending,
    async require(intent: unknown) {
      if (typeof intent !== "string" || !LINK_ID.test(intent)) throw new AccountLinkError(expired);
      const link = await pending();
      if (link?.id !== intent) throw new AccountLinkError(expired);
      return link;
    },
    async linkVerified(intent: string, userId: string) {
      const hash = await pendingHash();
      if (!hash) throw new AccountLinkError(expired);
      await inTransaction(async () => {
        const link = await one<{ subject: string }>(
          `SELECT subject FROM ${pendingTable} WHERE id = ? AND tokenHash = ? AND expiresAt > ?`,
          intent, hash, new Date().toISOString(),
        );
        if (!link) throw new AccountLinkError(expired);
        const consumed = await run(
          `DELETE FROM ${pendingTable} WHERE id = ? AND tokenHash = ? AND expiresAt > ?`,
          intent, hash, new Date().toISOString(),
        );
        if (!consumed.changes) throw new AccountLinkError(expired);
        await run(`INSERT INTO ${identityTable} (subject,userId) VALUES (?,?) ON CONFLICT DO NOTHING`, link.subject, userId);
        const owner = await one<{ userId: string }>(`SELECT userId FROM ${identityTable} WHERE subject = ?`, link.subject);
        if (owner?.userId !== userId) {
          throw new AccountLinkError("This " + label + " or JODO account is already linked. Use SMS to sign in or contact support.");
        }
      });
      writeAuthCookie(await cookies(), cookie, "", 0);
    },
  };
}
