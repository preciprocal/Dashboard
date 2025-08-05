"use client"
import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import logo from "@/public/logo.png";
import { 
  Search, 
  Bell, 
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Home,
  Video,
  BookOpen,
  BarChart3,
  Award,
  Settings,
  HelpCircle,
  LogOut,
  Plus,
  Crown,
  GraduationCap,
  FileText,
  Users,
  Brain,
  Calendar,
  Mic,
  Volume2,
  Gift,
  GripVertical
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";

// Theme Context
const ThemeContext = createContext<{
  darkMode: boolean;
  toggleTheme: () => void;
} | null>(null);

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      const isDark = savedTheme === 'dark';
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(systemPrefersDark);
      if (systemPrefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode, mounted]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    
    // Force immediate DOM update
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {mounted ? children : null}
    </ThemeContext.Provider>
  );
};

// Sidebar items configuration
const mainNavItems = [
  { id: 'overview', label: 'Dashboard', icon: Home, href: '/' },
  { id: 'documents', label: 'Documents', icon: FileText, href: '/documents' },
];

const studyToolsItems = [
  { id: 'interviews', label: 'Interviews', icon: Video, href: '/interviews' },
  { id: 'templates', label: 'Templates', icon: BookOpen, href: '/templates' },  
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'achievements', label: 'Achievements', icon: Award, href: '/achievements' },
];

const aiVoiceToolsItems = [
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

const bottomItems = [
  { id: 'help', label: 'Help & Support', icon: HelpCircle, href: '/help' }
];

// Helper functions
const getPlanInfo = (subscription: any) => {
  if (
    !subscription ||
    subscription.plan === "starter" ||
    subscription.plan === null ||
    subscription.plan === undefined
  ) {
    return {
      text: "Free Plan",
      style: "text-gray-400 dark:text-gray-500",
      showUpgrade: true
    };
  }

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
      return {
        text: "Free Plan",
        style: "text-gray-400 dark:text-gray-500",
        showUpgrade: true
      };
  }
};

const getSafeUserStats = (userStats: any) => {
  if (!userStats || typeof userStats !== 'object') {
    return {
      totalInterviews: 0,
      averageScore: 0,
      currentStreak: 0,
      practiceHours: 0,
      improvement: 0,
      remainingSessions: 8,
      interviewsUsed: 5,
      interviewsLimit: 10,
      resumesUsed: 3,
      resumesLimit: 5,
    };
  }

  return {
    totalInterviews: userStats.totalInterviews || 0,
    averageScore: userStats.averageScore || 0,
    currentStreak: userStats.currentStreak || 0,
    practiceHours: userStats.practiceHours || 0,
    improvement: userStats.improvement || 0,
    remainingSessions: userStats.remainingSessions || 8,
    interviewsUsed: userStats.interviewsUsed || 5,
    interviewsLimit: userStats.interviewsLimit || 10,
    resumesUsed: userStats.resumesUsed || 3,
    resumesLimit: userStats.resumesLimit || 5,
  };
};

interface LayoutClientProps {
  children: React.ReactNode;
  user: any;
  userStats: any;
}

// Progress Bar Component
const ProgressBar = ({ used, limit, color = "blue" }: { used: number; limit: number; color?: string }) => {
  const percentage = Math.min((used / limit) * 100, 100);
  
  const colorClasses = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500"
  };

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div 
        className={`h-2 rounded-full ${colorClasses[color]} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// Section Header Component
const SectionHeader = ({ title, showPlus = false }: { title: string; showPlus?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-2 mt-4 mb-2">
    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      {title}
    </h3>
    {showPlus && (
      <Plus className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors" />
    )}
  </div>
);

// Main Layout Content Component
function LayoutContent({ children, user, userStats }: LayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { darkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Safe data handling
  const safeUser = user || {};
  const stats = getSafeUserStats(userStats);
  const userSubscription = safeUser?.subscription || null;

  // Get user initials
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
      return "U";
    }
  };

  const userInitials = getInitials(safeUser.name);
  const planInfo = getPlanInfo(userSubscription);

  // Resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsResizing(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || (typeof window !== 'undefined' && window.innerWidth < 1024)) return;
    const newWidth = Math.max(240, Math.min(400, e.clientX));
    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Close sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderNavItem = (item: any, isActive: boolean) => (
    <Link
      key={item.id}
      href={item.href}
      onClick={handleLinkClick}
      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all group text-sm ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      <span className="font-medium">{item.label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-all duration-300 ease-in-out flex flex-col h-screen overflow-hidden`}
        style={{ 
          width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '280px' 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 h-16">
          <Link href="/" className="flex items-center space-x-3 group" onClick={handleLinkClick}>
            <NextImage 
              src={logo} 
              alt="Preciprocal" 
              width={24} 
              height={24}
              className="rounded-lg group-hover:scale-105 transition-transform"
              priority
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white">Preciprocal</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action */}
        <div className="p-4 flex-shrink-0">
          <Link 
            href="/createinterview"
            onClick={handleLinkClick}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-4 py-3 rounded-xl transition-all flex items-center justify-center group shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Start Interview
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {/* Main Items */}
          <div className="px-3 space-y-1">
            {mainNavItems.map((item) => renderNavItem(item, pathname === item.href))}
          </div>

          {/* Study Tools Section */}
          <SectionHeader title="Study Tools" showPlus={true} />
          <div className="px-3 space-y-1">
            {studyToolsItems.map((item) => renderNavItem(item, pathname === item.href))}
          </div>

          {/* AI Voice Tools Section */}
          <SectionHeader title="Other" showPlus={false} />
          <div className="px-3 space-y-1">
            {aiVoiceToolsItems.map((item) => renderNavItem(item, pathname === item.href))}
          </div>
        </nav>

        {/* Usage Stats Section */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 space-y-4">
            {/* Interviews Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Interviews</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {stats.interviewsUsed}
                </span>
              </div>
              <ProgressBar used={stats.interviewsUsed} limit={stats.interviewsLimit} color="purple" />
            </div>

            {/* Resumes Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resumes</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {stats.resumesUsed}
                </span>
              </div>
              <ProgressBar used={stats.resumesUsed} limit={stats.resumesLimit} color="blue" />
            </div>

            {/* Upgrade Button */}
            {planInfo.showUpgrade && (
              <Link 
                href="/subscription"
                onClick={handleLinkClick}
                className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 px-4 py-3 rounded-lg transition-all flex items-center justify-center text-sm font-medium shadow-sm"
              >
                Upgrade
              </Link>
            )}

            {/* Get 1 Month Free */}
            <Link 
              href="/promo"
              onClick={handleLinkClick}
              className="w-full flex items-center space-x-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium transition-colors"
            >
              <Gift className="w-4 h-4" />
              <span>Get 1 Month Free</span>
            </Link>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="space-y-1">
            {bottomItems.map((item) => renderNavItem(item, pathname === item.href))}
          </div>
        </div>

        {/* Resize Handle - Desktop only */}
        <div 
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors hidden lg:block group"
          onMouseDown={handleMouseDown}
        >
          {/* Visual resize indicator */}
          <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-6 h-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm">
            <GripVertical className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Navbar */}
      <header 
        className="fixed top-0 right-0 z-30 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out"
        style={{ 
          left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0'
        }}
      >
        <div className="flex items-center justify-between h-full px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-2xl mx-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search anything"
                className="w-full pl-12 pr-16 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-700 transition-all"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium">
                ⌘ F
              </div>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <button className="p-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Profile */}
            <div className="flex items-center space-x-3 cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-white text-sm font-semibold">{userInitials}</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {safeUser?.name || 'User'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {safeUser?.email || 'user@example.com'}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div 
        className="transition-all duration-300 ease-in-out"
        style={{ 
          marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0',
          paddingTop: '64px'
        }}
      >
        <main className="p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

// Main component that provides the theme context
export default function LayoutClient({ children, user, userStats }: LayoutClientProps) {
  return (
    <ThemeProvider>
      <LayoutContent user={user} userStats={userStats}>
        {children}
      </LayoutContent>
    </ThemeProvider>
  );
}