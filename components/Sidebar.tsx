"use client"
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import logo from "@/public/logo.png";
import { 
  Home,
  Video,
  BookOpen,
  BarChart3,
  Award,
  Settings,
  HelpCircle,
  User,
  LogOut,
  X,
  Menu,
  Plus,
  Crown
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";

const sidebarItems = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/' },
  { id: 'interviews', label: 'Interviews', icon: Video, href: '/interviews' },
  { id: 'templates', label: 'Templates', icon: BookOpen, href: '/templates' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
];

const bottomItems = [
  { id: 'achievements', label: 'Achievements', icon: Award, href: '/achievements' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'help', label: 'Help', icon: HelpCircle, href: '/help' }
];

// Helper function to get plan info from real subscription data (matching your existing code)
const getPlanInfo = (subscription: any) => {
  console.log("🔍 getPlanInfo called with:", subscription);

  // Handle free users (no subscription object, null, undefined, or starter plan)
  if (
    !subscription ||
    subscription.plan === "starter" ||
    subscription.plan === null ||
    subscription.plan === undefined
  ) {
    console.log("🔍 Returning free plan");
    return {
      text: "Free Plan",
      style: "text-gray-400",
      showUpgrade: true
    };
  }

  console.log("🔍 Processing subscription plan:", subscription.plan);

  switch (subscription.plan) {
    case "pro":
      if (subscription.status === "trial") {
        return {
          text: "Pro Trial",
          style: "text-purple-400",
          showUpgrade: false
        };
      }
      return {
        text: "Pro Plan",
        style: "text-purple-400",
        showUpgrade: false
      };
    case "premium":
      return {
        text: "Premium Plan",
        style: "text-yellow-400",
        showUpgrade: false
      };
    default:
      console.log("🔍 Default case - returning free plan");
      return {
        text: "Free Plan",
        style: "text-gray-400",
        showUpgrade: true
      };
  }
};

// Safe user stats with proper defaults
const getSafeUserStats = (userStats: any) => {
  if (!userStats || typeof userStats !== 'object') {
    return {
      totalInterviews: 0,
      averageScore: 0,
      currentStreak: 0,
      practiceHours: 0,
      improvement: 0,
      remainingSessions: 8,
    };
  }

  return {
    totalInterviews: userStats.totalInterviews || 0,
    averageScore: userStats.averageScore || 0,
    currentStreak: userStats.currentStreak || 0,
    practiceHours: userStats.practiceHours || 0,
    improvement: userStats.improvement || 0,
    remainingSessions: userStats.remainingSessions || 8,
  };
};

interface SidebarProps {
  user?: any;
  userStats?: any;
}

export default function Sidebar({ user = null, userStats = null }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Safe data handling with proper fallbacks and debug logging (matching your existing structure)
  const safeUser = user || {};
  const stats = getSafeUserStats(userStats);

  // Extract subscription data from user object (since it's nested in Firestore)
  const userSubscription = safeUser?.subscription || null;
  
  console.log("🔍 Debug - User object:", safeUser);
  console.log("🔍 Debug - User subscription:", userSubscription);
  console.log("🔍 Debug - Subscription plan:", userSubscription?.plan);
  console.log("🔍 Debug - Subscription status:", userSubscription?.status);

  // Get real user initials with safe handling
  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return "U";
    
    try {
      return name
        .trim()
        .split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase()
        .substring(0, 2);
    } catch (error) {
      console.error("Error generating initials:", error);
      return "U";
    }
  };

  const userInitials = getInitials(safeUser.name);
  const planInfo = getPlanInfo(userSubscription);
  
  console.log("🔍 Final plan info:", planInfo); // Debug log

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
      // Optionally show error toast
    }
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 bg-gray-900 text-gray-400 hover:text-white p-2 rounded-lg border border-gray-700 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700/50 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-all duration-300 ease-in-out flex flex-col h-screen overflow-hidden`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50 flex-shrink-0">
          <Link href="/" className="flex items-center space-x-3 group">
            <NextImage 
              src={logo} 
              alt="Preciprocal" 
              width={28} 
              height={28}
              className="rounded-lg group-hover:scale-105 transition-transform"
              priority
            />
            <span className="text-white font-semibold text-lg">Preciprocal</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action */}
        <div className="p-4 flex-shrink-0">
          <Link 
            href="/createinterview"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-4 py-3 rounded-xl transition-all flex items-center justify-center group shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Start Interview
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all group ${
                  pathname === item.href
                    ? 'bg-blue-600/90 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Secondary Navigation */}
        <div className="px-3 py-2 border-t border-gray-700/50 flex-shrink-0">
          <div className="space-y-1">
            {bottomItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                  pathname === item.href
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Real-time Stats Card - Only show if user has data */}
        {(stats.totalInterviews > 0 || stats.averageScore > 0) && (
          <div className="px-4 py-3 border-t border-gray-700/50 flex-shrink-0">
            <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
              <div className="text-center mb-2">
                <div className="text-xs text-gray-400">Your Progress</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-white font-bold text-lg">{stats.totalInterviews}</div>
                  <div className="text-gray-400 text-xs">Interviews</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-bold text-lg">{stats.averageScore}</div>
                  <div className="text-gray-400 text-xs">Avg Score</div>
                </div>
              </div>
              {stats.currentStreak > 0 && (
                <div className="mt-2 text-center">
                  <div className="text-green-400 text-xs bg-green-500/20 px-2 py-1 rounded-full">
                    🔥 {stats.currentStreak} day streak
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Section */}
        <div className="px-4 py-4 border-t border-gray-700/50 flex-shrink-0">
          {/* User Info */}
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate text-sm">
                {safeUser.name || 'User'}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${planInfo.style}`}>{planInfo.text}</span>
                {!planInfo.showUpgrade && (
                  <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* Upgrade Button for Free Users */}
          {planInfo.showUpgrade && (
            <Link 
              href="/subscription"
              className="w-full mb-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 px-3 py-2 rounded-lg transition-all flex items-center justify-center text-sm font-medium"
            >
              <Crown className="w-4 h-4 mr-2 flex-shrink-0" />
              Upgrade
            </Link>
          )}
          
          {/* Logout */}
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}