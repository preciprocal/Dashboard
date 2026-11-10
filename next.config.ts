import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "firebase-admin",
    "@google/generative-ai",
    "@sparticuz/chromium-min",
    "puppeteer-core",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://mocker-508e1.firebaseapp.com/__/auth/:path*",
      },
    ];
  },

  // The invoice PDF reads its embedded fonts from disk (lib/billing/invoice-pdf.ts).
  outputFileTracingIncludes: {
    "/api/billing/invoices/**": ["./lib/billing/fonts/**/*"],
  },

  reactStrictMode: true,

  // Next 16.3 turned on Turbopack's build cache by default, and Vercel
  // restores .next/cache before every build. The restored cache kept serving
  // the Oct 20 globals.css: production got today's JavaScript with a stylesheet
  // that had no .btn-primary, .btn-secondary, .field or .choice, so every
  // button and input in the app rendered unstyled. Builds start cold instead.
  experimental: {
    turbopackFileSystemCacheForBuild: false,
  },

  // Dev-only build-activity indicator defaults to bottom-left, where it
  // overlaps the sidebar's nav/plan badge - move it out of the way. Never
  // shown in production builds.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;