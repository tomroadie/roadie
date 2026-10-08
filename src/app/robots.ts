import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/data-deletion"],
      disallow: ["/admin", "/api", "/home", "/settings", "/onboarding", "/insights", "/events", "/prep", "/dashboard", "/reset-password"],
    },
    sitemap: "https://tempo.roadie.media/sitemap.xml",
  };
}
