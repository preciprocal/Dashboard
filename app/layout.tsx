// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import {
  getCurrentUser,
} from "@/lib/actions/auth.action";
import LayoutClient from "@/components/LayoutClient";
import AttributionCapture from "@/components/AttributionCapture";
import { buildMetadata, SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

// ─── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  ...buildMetadata({
    title: `${SITE.name} - ${SITE.tagline}`,
    description: SITE.description,
    path: "/",
    index: false,
    canonical: SITE.marketing,
  }),
  verification: {
    google: "Gx5JSJmIhdKsJydR1agYdbj3-GZw5Cm5Js3K16sbgbU",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#08090a" },
    { media: "(prefers-color-scheme: dark)", color: "#08090a" },
  ],
  width: "device-width",
  initialScale: 1,
};

// ─── Fonts ────────────────────────────────────────────────────────────────────
// The Sectira type system: Inter for text and UI, Satoshi for headings
// (Fontshare, ITF Free Font License, served from app/fonts so nothing loads
// from a third party). Geist stays available for mono and older markup.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    { path: "./fonts/Satoshi-500.woff2", weight: "500" },
    { path: "./fonts/Satoshi-700.woff2", weight: "700" },
    { path: "./fonts/Satoshi-900.woff2", weight: "900" },
  ],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ─── Root layout ──────────────────────────────────────────────────────────────
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only the user. This layout used to fetch every interview plus one
  // feedback lookup per interview to build "userStats" on every page load,
  // and nothing read the result: it cost a few hundred ms per document
  // request, more for people with many interviews.
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("getCurrentUser failed (treated as logged out):", e);
    user = null;
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${satoshi.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AttributionCapture />
        <LayoutClient user={user}>
          {children}
        </LayoutClient>
      </body>
    </html>
  );
}