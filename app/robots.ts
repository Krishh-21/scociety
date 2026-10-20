import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/partners", "/help", "/privacy", "/terms"],
      // Everything behind sign-in is private to a society.
      disallow: ["/deal/", "/bookings", "/society", "/profile", "/notifications", "/create", "/explore", "/ops", "/vendor", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
