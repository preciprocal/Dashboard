import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ FIXED: Moved from experimental.serverComponentsExternalPackages
  serverExternalPackages: [
    "firebase-admin",
    "@google/generative-ai",
  ],

  // Allow images from any domain
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;