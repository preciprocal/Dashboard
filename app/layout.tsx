import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { redirect } from "next/navigation";
import NextImage from "next/image";
import logo from "@/public/logo.png";
import {
  isAuthenticated,
  getCurrentUser,
} from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getFeedbackByInterviewId,
} from "@/lib/actions/general.action";
import Sidebar from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Preciprocal - AI Interview Practice",
  description: "Master your interviews with AI-powered practice sessions",
};

// Helper function to calculate user stats
const calculateUserStats = async (interviews: any[]) => {
  const totalInterviews = interviews.length;

  // Get feedback for interviews to calculate accurate scores
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

  // Calculate current streak (simplified - based on recent activity)
  const currentStreak = Math.min(totalInterviews, 10);

  // Calculate additional stats for sidebar
  const practiceHours = Math.round((totalInterviews * 45) / 60);
  const improvement = Math.min(Math.max(totalInterviews * 2, 5), 50);
  const remainingSessions = 20; // Replace with actual subscription logic

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
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Authentication check
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  // Force fresh user data fetch
  const user = await getCurrentUser();

  // If user data is stale, try to refresh it
  if (!user) {
    console.log("❌ No user data found, redirecting to sign-in");
    redirect("/sign-in");
  }

  // Extract subscription data from user object (since it's nested in Firestore)
  const userSubscription = user?.subscription || null;

  // Debug logging - remove this after fixing
  console.log("🔍 Debug - User object:", user);
  console.log("🔍 Debug - User subscription:", userSubscription);
  console.log("🔍 Debug - Subscription plan:", userSubscription?.plan);
  console.log("🔍 Debug - Subscription status:", userSubscription?.status);
  console.log("🔍 Debug - User ID:", user?.id);
  console.log("🔍 Debug - Current timestamp:", new Date().toISOString());

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
    // Keep default stats if fetch fails
  }

  // Get user initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const userInitials = user?.name ? getInitials(user.name) : "U";

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-black flex">
          {/* Pass user with subscription data to sidebar */}
          <Sidebar 
            user={user} 
            userStats={userStats}
          />
          
          <div className="flex-1 lg:ml-64">
            {/* Mobile Header Only */}
            <div className="lg:hidden bg-gray-900 border-b border-gray-700 px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <NextImage 
                    src={logo} 
                    alt="Preciprocal" 
                    width={32} 
                    height={32}
                    className="rounded-lg"
                  />
                  <span className="text-white font-bold">Preciprocal</span>
                </div>
                <div className="flex items-center space-x-4">
                  <button className="text-gray-400 hover:text-white">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">{userInitials}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <main className="p-4 lg:p-8">
              {children}
            </main>
          </div>
        </div>

        {/* Add ChatBot Component - This will appear on all authenticated pages */}
        <ChatBot />
      </body>
    </html>
  );
}