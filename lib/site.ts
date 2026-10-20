/** The public origin, for absolute URLs in metadata, the sitemap and share cards. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3127").replace(/\/$/, "");

export const SITE_NAME = "JODO";
export const SITE_TAGLINE = "Your building books together. Everyone pays less.";
export const SITE_DESCRIPTION =
  "Group booking for residential societies: neighbours book the same home service on the same day with one vendor, and the price falls as each flat joins.";
