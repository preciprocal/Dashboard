// app/layout.tsx - Simplified without custom providers for now
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Helper function to calculate user stats (interviews only for now)
const calculateUserStats = async (interviews: any[]) => {
  const totalInterviews = interviews.length;

  let completedInterviews = [];
  let totalScore = 0;
  let scoredInterviews = 0;

  for (const interview of interviews) {
    try {
      const feedback = await getFeedbackByInterviewId({
        interviewId: interview.id,
        userId: interview.userId,
      });

      if (feedback && feedback.totalScore) {
        completedInterviews.push({ ...interview, feedback });
        totalScore += feedback.totalScore;
        scoredInterviews++;
      }
    } catch (error) {
      console.error(
        "Error fetching feedback for interview:",
        interview.id,
        error
      );
    }
  }

  const averageScore =
    scoredInterviews > 0 ? Math.round(totalScore / scoredInterviews) : 0;
  const currentStreak = Math.min(totalInterviews, 10);
  const practiceHours = Math.round((totalInterviews * 45) / 60);
  const improvement = Math.min(Math.max(totalInterviews * 2, 5), 50);
  const remainingSessions = 20;

  return {
    totalInterviews,
    averageScore,
    currentStreak,
    practiceHours,
    improvement,
    remainingSessions,
    interviewsUsed: totalInterviews,
    interviewsLimit: 10,
    // Resume stats will be fetched client-side
    resumesUsed: 0,
    resumesLimit: 5,
  };
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let userStats = {
    totalInterviews: 0,
    averageScore: 0,
    currentStreak: 0,
    practiceHours: 0,
    improvement: 0,
    remainingSessions: 8,
    interviewsUsed: 5,
    interviewsLimit: 10,
    resumesUsed: 0,
    resumesLimit: 5,
  };

  try {
    // Check authentication without immediate redirect
    const isUserAuthenticated = await isAuthenticated();
    
    if (isUserAuthenticated) {
      user = await getCurrentUser();
      
      // Only fetch interview stats if we have a user
      if (user?.id) {
        try {
          const interviews = await getInterviewsByUserId(user.id);
          userStats = await calculateUserStats(interviews || []);
        } catch (error) {
          console.error("Failed to fetch user stats:", error);
        }
      }
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
    // Don't redirect here, let individual pages handle auth
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <LayoutClient user={user} userStats={userStats}>
          {children}
        </LayoutClient>
      </body>
    </html>
  );
}