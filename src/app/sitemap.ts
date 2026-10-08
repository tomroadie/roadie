import type { MetadataRoute } from "next";

const BASE = "https://tempo.roadie.media";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/data-deletion"].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path ? "yearly" : "monthly",
    priority: path ? 0.3 : 1,
  }));
}
