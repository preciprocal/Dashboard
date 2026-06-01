// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  isAuthenticated,
  getCurrentUser,
} from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getFeedbackByInterviewId,
} from "@/lib/actions/general.action";
import LayoutClient from "@/components/LayoutClient";
import { buildMetadata, SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

// ─── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  ...buildMetadata({
    title: `${SITE.name} — ${SITE.tagline}`,
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

// ─── Defaults ─────────────────────────────────────────────────────────────────
const defaultStats = {
  totalInterviews: 0,
  averageScore: 0,
  currentStreak: 0,
  practiceHours: 0,
  improvement: 0,
  remainingSessions: 0,
  interviewsUsed: 0,
  interviewsLimit: 0,
  resumesUsed: 0,
  resumesLimit: 0,
};

interface Interview {
  id: string;
  userId: string;
  createdAt?: { toDate?: () => Date } | string | Date;
}

interface Feedback {
  totalScore?: number;
}

// ─── Stats helper ─────────────────────────────────────────────────────────────
// Uses Promise.all (parallel) instead of sequential awaits to avoid N+1.
const calculateUserStats = async (interviews: Interview[]) => {
  const totalInterviews = interviews.length;

  // Fetch all feedbacks in parallel
  const feedbackResults = await Promise.allSettled(
    interviews.map((interview) =>
      getFeedbackByInterviewId({
        interviewId: interview.id,
        userId: interview.userId,
      })
    )
  );

  let totalScore = 0;
  let scoredInterviews = 0;

  feedbackResults.forEach((result) => {
    if (result.status === "fulfilled") {
      const feedback = result.value as Feedback | null;
      if (feedback?.totalScore) {
        totalScore += feedback.totalScore;
        scoredInterviews++;
      }
    }
  });

  const averageScore =
    scoredInterviews > 0 ? Math.round(totalScore / scoredInterviews) : 0;

  // ── Real consecutive-day streak ──────────────────────────────────────────
  // Build a Set of "YYYY-MM-DD" strings for days that had an interview,
  // then count how many consecutive days (ending today) are present.
  const daySet = new Set<string>();
  interviews.forEach((iv) => {
    try {
      const raw = iv.createdAt;
      let d: Date;
      if (raw && typeof raw === "object" && "toDate" in raw && typeof raw.toDate === "function") {
        d = raw.toDate();
      } else {
        d = new Date(raw as string | Date);
      }
      if (!isNaN(d.getTime())) {
        daySet.add(d.toISOString().slice(0, 10));
      }
    } catch {
      // skip unparseable dates
    }
  });

  let currentStreak = 0;
  const today = new Date();
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      currentStreak++;
    } else if (offset > 0) {
      // Gap found — streak ends (we allow today to be empty since the day isn't over)
      break;
    }
  }

  return {
    totalInterviews,
    averageScore,
    currentStreak,
    practiceHours: Math.round((totalInterviews * 45) / 60),
    improvement: Math.min(Math.max(totalInterviews * 2, 0), 50),
    // These should ideally come from your plan/subscription service.
    // Leaving 0 as a safe default so the UI can handle "unknown" gracefully
    // rather than showing a hardcoded wrong number.
    remainingSessions: 0,
    interviewsUsed: totalInterviews,
    interviewsLimit: 0,
    resumesUsed: 0,
    resumesLimit: 0,
  };
};

// ─── Root layout ──────────────────────────────────────────────────────────────
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let userStats = { ...defaultStats };

  try {
    const isUserAuthenticated = await isAuthenticated();

    if (isUserAuthenticated) {
      try {
        user = await getCurrentUser();
      } catch (e) {
        console.error("getCurrentUser failed:", e);
        user = null;
      }

      if (user?.id) {
        try {
          const interviews = await getInterviewsByUserId(user.id);
          userStats = await calculateUserStats(
            (interviews || []) as Interview[]
          );
        } catch (e) {
          console.error("Failed to fetch user stats:", e);
          userStats = { ...defaultStats };
        }
      }
    }
  } catch (error) {
    console.error("Auth check failed (treated as logged out):", error);
    user = null;
    userStats = { ...defaultStats };
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <LayoutClient user={user} userStats={userStats}>
          {children}
        </LayoutClient>
      </body>
    </html>
  );
}