// app/robots.ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * app.preciprocal.com/ IS the dashboard. Block it and every dashboard route.
 * Allow only the public auth pages so branded queries like "Preciprocal sign in"
 * still resolve correctly. Also block AI scrapers from the entire subdomain.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/sign-in", "/sign-up"],
        disallow: [
          "/",                // the dashboard itself
          "/profile",
          "/resume",
          "/interview",
          "/planner",
          "/settings",
          "/verify-email",
          "/forgot-password",
          "/api/",
          "/auth/",
          "/_next/",
        ],
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "CCBot", "anthropic-ai", "PerplexityBot"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE.app}/sitemap.xml`,
    host: SITE.app,
  };
}