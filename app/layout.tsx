// app/layout.tsx
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

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultStats = {
  totalInterviews: 0,
  averageScore: 0,
  currentStreak: 0,
  practiceHours: 0,
  improvement: 0,
  remainingSessions: 8,
  interviewsUsed: 0,
  interviewsLimit: 10,
  resumesUsed: 0,
  resumesLimit: 5,
};

interface Interview {
  id: string;
  userId: string;
}

interface Feedback {
  totalScore?: number;
}

const calculateUserStats = async (interviews: Interview[]) => {
  const totalInterviews = interviews.length;

  let totalScore = 0;
  let scoredInterviews = 0;

  for (const interview of interviews) {
    try {
      const feedback = await getFeedbackByInterviewId({
        interviewId: interview.id,
        userId: interview.userId,
      }) as Feedback | null;

      if (feedback && feedback.totalScore) {
        totalScore += feedback.totalScore;
        scoredInterviews++;
      }
    } catch (error) {
      console.error("Error fetching feedback for interview:", interview.id, error);
    }
  }

  const averageScore =
    scoredInterviews > 0 ? Math.round(totalScore / scoredInterviews) : 0;

  return {
    totalInterviews,
    averageScore,
    currentStreak: Math.min(totalInterviews, 10),
    practiceHours: Math.round((totalInterviews * 45) / 60),
    improvement: Math.min(Math.max(totalInterviews * 2, 5), 50),
    remainingSessions: 20,
    interviewsUsed: totalInterviews,
    interviewsLimit: 10,
    resumesUsed: 0,
    resumesLimit: 5,
  };
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always default to null/empty — never let auth errors crash the layout
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
          userStats = await calculateUserStats(interviews || []);
        } catch (e) {
          console.error("Failed to fetch user stats:", e);
          userStats = { ...defaultStats };
        }
      }
    }
  } catch (error) {
    // Stale cookie, expired token, etc. — treat as logged out
    // LayoutClient will resolve the real state via Firebase client SDK
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