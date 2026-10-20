// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  getCurrentUser,
} from "@/lib/actions/auth.action";
import LayoutClient from "@/components/LayoutClient";
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
    { media: "(prefers-color-scheme: light)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

// ─── Fonts ────────────────────────────────────────────────────────────────────
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <LayoutClient user={user}>
          {children}
        </LayoutClient>
      </body>
    </html>
  );
}