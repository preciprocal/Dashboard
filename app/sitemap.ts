// app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * Tiny by design. Only auth pages — the legitimate landing points for
 * branded queries. Everything else belongs in the marketing site's sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE.app}/sign-in`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE.app}/sign-up`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}