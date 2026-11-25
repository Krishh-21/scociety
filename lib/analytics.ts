import { all, run } from "./db";

/**
 * The events docs/04-screens-spec.md lists per screen. Written to a table here;
 * in production this is the PostHog call with the same name and props.
 */
export async function track(userId: string | null, name: string, props: Record<string, unknown> = {}) {
  try {
    await run(
      "INSERT INTO analytics_event (userId,name,props,createdAt) VALUES (?,?,?,?)",
      userId, name, JSON.stringify(props), new Date().toISOString(),
    );
  } catch {
    // analytics must never break a user action
  }
}

export async function funnel() {
  const rows = await all<{ name: string; n: number }>(
    "SELECT name, COUNT(*) AS n FROM analytics_event GROUP BY name ORDER BY n DESC",
  );
  const byName = Object.fromEntries(rows.map((r) => [r.name, r.n]));
  const step = (k: string) => byName[k] ?? 0;
  return {
    rows,
    deal_view: step("deal_view"),
    join_tap: step("join_tap"),
    join_success: step("join_success"),
    create_publish: step("create_publish"),
    viewToJoinPct: step("deal_view") ? Math.round((step("join_success") / step("deal_view")) * 100) : 0,
  };
}
