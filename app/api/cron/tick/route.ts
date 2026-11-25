import { NextResponse } from "next/server";
import { tick } from "@/lib/deals";

export const dynamic = "force-dynamic";

// Vercel Cron calls GET with CRON_SECRET. Manual schedulers can also use POST
// and send either configured secret in the Authorization header.
async function run(req: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.JODO_CRON_SECRET].filter(Boolean);
  const requiresAuth = secrets.length > 0 || process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const header = req.headers.get("authorization");
  if (requiresAuth && !secrets.some((secret) => header === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const closed = await tick();
  return NextResponse.json({ ok: true, closed, at: new Date().toISOString() });
}

export const GET = run;
export const POST = run;
