/** The public origin, for absolute URLs in metadata, the sitemap and share cards. */
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? (productionHost ? `https://${productionHost}` : "http://localhost:3127")).replace(/\/$/, "");

export const SITE_NAME = "JODO";
export const SITE_TAGLINE = "Your housing society, in one place";
export const SITE_DESCRIPTION =
  "Manage visitors, society notices, maintenance dues, complaints and amenity reservations with JODO, a shared app for residents, committees and gate staff.";
