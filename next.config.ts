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

  // CORS headers for Chrome extension API routes.
  // Runs at infrastructure level — before middleware, before route handlers.
  // Guarantees OPTIONS preflight is never redirected to sign-in.
  async headers() {
    return [
      {
        source: '/api/extension/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',      value: '*' },
          { key: 'Access-Control-Allow-Methods',     value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'false' },
          { key: 'Access-Control-Max-Age',           value: '86400' },
        ],
      },
    ];
  },

  reactStrictMode: true,
};

export default nextConfig;