/** Hosted deployments use SMS unless the private demo is explicitly selected. */
export function isDemoMode(): boolean {
  const mode = process.env.JODO_AUTH_MODE;
  return mode === "demo" || (!mode && process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1");
}
