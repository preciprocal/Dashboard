// app/layout.tsx
import { Metadata } from "next";
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
import { redis } from "@/lib/redis/redis-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Cache TTL for user stats (5 minutes - stats can change frequently)
const USER_STATS_CACHE_TTL = 5 * 60;

// Metadata configuration
export const metadata: Metadata = {
  title: "Preciprocal | Tired of AI Taking Your Job? Use AI to Take It Back",
  description: "Stop stressing about AI replacing you. Level up your career game with AI that actually works for YOU. Ace interviews, flex that resume, and land the bag. No cap.",
  keywords: [
    "AI career prep",
    "interview practice",
    "resume optimization",
    "job search",
    "career development",
    "interview coach",
    "ATS resume checker",
    "job prep tools",
  ],
  authors: [{ name: "Preciprocal" }],
  openGraph: {
    title: "Preciprocal | Tired of AI Taking Your Job? Use AI to Take It Back",
    description: "Stop stressing about AI replacing you. Use AI to level up your career game instead. Ace interviews, optimize your resume, land the bag ✨",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Preciprocal | AI Taking Your Job? Take It Back",
    description: "Stop stressing. Start winning. Use AI to ace interviews and land the bag. 💼✨",
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
};

// Define interfaces
interface Interview {
  id: string;
  userId: string;
  [key: string]: unknown;
}

interface Feedback {
  totalScore?: number;
  [key: string]: unknown;
}

interface InterviewWithFeedback extends Interview {
  feedback: Feedback;
}

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  currentStreak: number;
  practiceHours: number;
  improvement: number;
  remainingSessions: number;
  interviewsUsed: number;
  interviewsLimit: number;
  resumesUsed: number;
  resumesLimit: number;
}

interface CachedUserStats {
  stats: UserStats;
  cachedAt: string;
}

/**
 * Get cached user stats
 */
async function getCachedUserStats(userId: string): Promise<UserStats | null> {
  if (!redis) return null;

  try {
    const key = `user-stats:${userId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - User stats for ${userId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedUserStats).stats;
    }

    console.log(`❌ Cache MISS - User stats for ${userId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache user stats
 */
async function cacheUserStats(userId: string, stats: UserStats): Promise<void> {
  if (!redis) return;

  try {
    const key = `user-stats:${userId}`;
    const data: CachedUserStats = {
      stats,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, USER_STATS_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached user stats for ${userId} (${USER_STATS_CACHE_TTL / 60} minutes)`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Invalidate user stats cache
 */
export async function invalidateUserStatsCache(userId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `user-stats:${userId}`;
    await redis.del(key);
    console.log(`✅ Invalidated user stats cache for ${userId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

// Helper function to calculate user stats (interviews only for now)
const calculateUserStats = async (interviews: Interview[]): Promise<UserStats> => {
  const totalInterviews = interviews.length;

  const completedInterviews: InterviewWithFeedback[] = [];
  let totalScore = 0;
  let scoredInterviews = 0;

  for (const interview of interviews) {
    try {
      const feedback = await getFeedbackByInterviewId({
        interviewId: interview.id,
        userId: interview.userId,
      }) as Feedback | null;

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
  const startTime = Date.now();
  
  let user: { id: string; [key: string]: unknown } | null = null;
  let userStats: UserStats = {
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
  let statsFromCache = false;

  try {
    console.log('🔐 Checking authentication...');
    console.log('   Redis available:', !!redis);

    // Check authentication without immediate redirect
    const isUserAuthenticated = await isAuthenticated();
    
    if (isUserAuthenticated) {
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        user = {
          ...currentUser,
        } as { id: string; [key: string]: unknown };
        
        console.log(`👤 User authenticated: ${user.id}`);
      }
      
      // Only fetch interview stats if we have a user
      if (user?.id) {
        try {
          // Check cache first
          const cachedStats = await getCachedUserStats(user.id);
          
          if (cachedStats) {
            userStats = cachedStats;
            statsFromCache = true;
            console.log('⚡ Using cached user stats');
          } else {
            // Fetch from database
            console.log('🔍 Fetching user stats from database...');
            const interviews = await getInterviewsByUserId(user.id) as Interview[] | null;
            userStats = await calculateUserStats(interviews || []);
            
            // Cache the stats
            await cacheUserStats(user.id, userStats);
            console.log('💾 User stats calculated and cached');
          }
        } catch (error) {
          console.error("Failed to fetch user stats:", error);
          // Use default stats on error
        }
      }
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
    // Don't redirect here, let individual pages handle auth
  }

  const totalTime = Date.now() - startTime;
  console.log(`✅ Layout data loaded in ${totalTime}ms (stats from cache: ${statsFromCache})`);

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
