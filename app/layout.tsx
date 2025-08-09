import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { redirect } from "next/navigation";
import {
  isAuthenticated,
  getCurrentUser,
} from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getFeedbackByInterviewId,
} from "@/lib/actions/general.action";
import LayoutClient from "@/components/LayoutClient";
import ChatBot from "@/components/ChatBot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Helper function to calculate user stats
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
  };
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication check
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user) {
    console.log("❌ No user data found, redirecting to sign-in");
    redirect("/sign-in");
  }

  // Fetch user interviews for dynamic stats
  let userStats = {
    totalInterviews: 0,
    averageScore: 0,
    currentStreak: 0,
    practiceHours: 0,
    improvement: 0,
    remainingSessions: 8,
  };

  try {
    if (user?.id) {
      const interviews = await getInterviewsByUserId(user.id);
      userStats = await calculateUserStats(interviews || []);
    }
  } catch (error) {
    console.error("Failed to fetch user stats:", error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <LayoutClient user={user} userStats={userStats}>
          {children}
        </LayoutClient>
        <ChatBot />
      </body>
    </html>
  );
}