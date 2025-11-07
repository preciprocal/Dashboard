import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ FIXED: Moved from experimental.serverComponentsExternalPackages
  serverExternalPackages: [
    "firebase-admin",
    "@google/generative-ai",
  ],

  // Allow images from any domain (or specify specific domains)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Optional: Enable strict mode
  reactStrictMode: true,
};

export default nextConfig;