import type { Metadata } from "next";
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
import Sidebar from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";
import NextImage from "next/image";
import logo from "@/public/logo.png";

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

// Helper function to calculate user stats from real data
const calculateUserStats = async (interviews: any[]) => {
  const totalInterviews = interviews.length;

  let totalScore = 0;
  let scoredInterviews = 0;

  for (const interview of interviews) {
    try {
      const feedback = await getFeedbackByInterviewId({
        interviewId: interview.id,
        userId: interview.userId,
      });

      if (feedback && feedback.totalScore) {
        totalScore += feedback.totalScore;
        scoredInterviews++;
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
    }
  }

  const averageScore = scoredInterviews > 0 ? Math.round(totalScore / scoredInterviews) : 0;
  const currentStreak = Math.min(totalInterviews, 10);
  const practiceHours = Math.round((totalInterviews * 45) / 60);
  const improvement = Math.min(Math.max(totalInterviews * 2, 5), 50);
  
  // Calculate remaining sessions based on subscription
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
  // Check authentication first
  const isUserAuthenticated = await isAuthenticated();
  
  // For public routes, don't require auth
  // You can expand this list as needed
  const publicRoutes = ['/sign-in', '/sign-up', '/forgot-password'];
  
  // Get real user data if authenticated with proper error handling
  let user = null;
  let userStats = {
    totalInterviews: 0,
    averageScore: 0,
    currentStreak: 0,
    practiceHours: 0,
    improvement: 0,
    remainingSessions: 8,
  };

  if (isUserAuthenticated) {
    try {
      user = await getCurrentUser();
      
      if (!user) {
        redirect("/sign-in");
      }
      
      // Fetch user's interviews and calculate real stats
      if (user?.id) {
        try {
          const interviews = await getInterviewsByUserId(user.id);
          if (interviews && interviews.length > 0) {
            const calculatedStats = await calculateUserStats(interviews);
            // Ensure all required properties exist
            userStats = {
              totalInterviews: calculatedStats.totalInterviews || 0,
              averageScore: calculatedStats.averageScore || 0,
              currentStreak: calculatedStats.currentStreak || 0,
              practiceHours: calculatedStats.practiceHours || 0,
              improvement: calculatedStats.improvement || 0,
              remainingSessions: calculatedStats.remainingSessions || 8,
            };
          }
        } catch (interviewError) {
          console.error("Failed to fetch interviews:", interviewError);
          // Keep default userStats
        }
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      // Keep default userStats and user = null
    }
  } else {
    redirect("/sign-in");
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-black flex">
          {/* Ensure sidebar always gets valid data */}
          <Sidebar 
            user={user} 
            userStats={{
              totalInterviews: userStats?.totalInterviews || 0,
              averageScore: userStats?.averageScore || 0,
              currentStreak: userStats?.currentStreak || 0,
              practiceHours: userStats?.practiceHours || 0,
              improvement: userStats?.improvement || 0,
              remainingSessions: userStats?.remainingSessions || 8,
            }} 
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
                    <span className="text-white font-medium text-sm">
                      {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'U'}
                    </span>
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

        {/* ChatBot for authenticated users */}
        <ChatBot />
      </body>
    </html>
  );
}