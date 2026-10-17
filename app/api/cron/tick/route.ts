import { NextResponse } from "next/server";
import { tick } from "@/lib/deals";

export const dynamic = "force-dynamic";

/**
 * Closing a deal captures money and creates jobs, so it must not depend on
 * somebody loading a page. Point a scheduler at this route (every minute is
 * plenty); in development instrumentation.ts calls tick() on a timer instead.
 *
 * Set JODO_CRON_SECRET to require `Authorization: Bearer <secret>`.
 */
async function run(req: Request) {
  const secret = process.env.JODO_CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }
  const closed = tick();
  return NextResponse.json({ ok: true, closed, at: new Date().toISOString() });
}

export const GET = run;
export const POST = run;
