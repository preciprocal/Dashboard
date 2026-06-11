// lib/seo.ts
import type { Metadata } from "next";

/**
 * SEO config for app.preciprocal.com (the dashboard).
 *
 * Strategy: this subdomain sits behind auth. We do NOT want it competing with
 * preciprocal.com in search. Most pages are noindex. Only /sign-in and
 * /sign-up are indexable, so branded queries like "Preciprocal login" land
 * on the right place. The dashboard root canonicals to the marketing site
 * so any link equity flows there.
 */

export const SITE = {
  marketing: "https://preciprocal.com",
  app: "https://app.preciprocal.com",

  name: "Preciprocal",
  tagline: "Land your next job, faster.",
  description:
    "Preciprocal is the AI-powered job search platform that auto-fills applications, optimizes your resume for ATS, and runs realistic AI mock interviews - all in one place.",

  twitterHandle: "@preciprocal",
  ogImage: "/og-default.png", // 1200×630 in /public
} as const;

interface PageMetaInput {
  title: string;
  description?: string;
  /** Path on app.preciprocal.com, e.g. "/sign-in" */
  path?: string;
  /** Override canonical (e.g. point dashboard root back to marketing site) */
  canonical?: string;
  /** Allow indexing. Default false - dashboard pages should NOT be indexed. */
  index?: boolean;
  ogImage?: string;
}

/**
 * Build Next.js Metadata for any page on app.preciprocal.com.
 * Defaults to noindex + nofollow because dashboard pages are private.
 * Pass `index: true` only on /sign-in and /sign-up.
 */
export function buildMetadata({
  title,
  description = SITE.description,
  path = "/",
  canonical,
  index = false,
  ogImage = SITE.ogImage,
}: PageMetaInput): Metadata {
  const fullTitle = title.includes(SITE.name) ? title : `${title} | ${SITE.name}`;
  const url = `${SITE.app}${path}`;
  const canonicalUrl = canonical ?? url;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(SITE.app),
    alternates: { canonical: canonicalUrl },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : {
          index: false,
          follow: false,
          nocache: true,
          googleBot: { index: false, follow: false, noimageindex: true },
        },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      site: SITE.twitterHandle,
      creator: SITE.twitterHandle,
      images: [ogImage],
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
    },
  };
}