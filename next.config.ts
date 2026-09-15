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

  reactStrictMode: true,

  // Dev-only build-activity indicator defaults to bottom-left, where it
  // overlaps the sidebar's nav/plan badge - move it out of the way. Never
  // shown in production builds.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;