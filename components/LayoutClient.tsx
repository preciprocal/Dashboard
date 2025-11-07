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
  GripVertical,
  User,
  Star,
  Zap,
  Shield,
  Pen
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';

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
    
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {mounted ? children : <div className="min-h-screen bg-white dark:bg-slate-900" />}
    </ThemeContext.Provider>
  );
};

// Custom hook for resume count
const useResumeCount = () => {
  const [user] = useAuthState(auth);
  const [resumeCount, setResumeCount] = useState(0);
  const [latestResume, setLatestResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResumeData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const resumes = await FirebaseService.getUserResumes(user.uid);
        setResumeCount(resumes.length);
        
        if (resumes.length > 0) {
          const sorted = resumes.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setLatestResume(sorted[0]);
        }
      } catch (error) {
        console.error('Error fetching resume data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResumeData();
  }, [user]);

  return { resumeCount, latestResume, loading };
};

// Helper Functions
const getPlanInfo = (subscription: any) => {
  if (
    !subscription ||
    subscription.plan === "starter" ||
    subscription.plan === null ||
    subscription.plan === undefined
  ) {
    return {
      text: "Free Plan",
      emoji: "⭐",
      icon: Shield,
      style: "text-green-400",
      badgeStyle: "bg-green-500/20 text-green-400 border-green-500/30",
      buttonStyle: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
      showUpgrade: true
    };
  }

  switch (subscription.plan) {
    case "pro":
      if (subscription.status === "trial") {
        return {
          text: "Pro Trial",
          emoji: "🎉",
          icon: Star,
          style: "text-purple-400",
          badgeStyle: "bg-purple-500/20 text-purple-400 border-purple-500/30",
          buttonStyle: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
          showUpgrade: false
        };
      }
      return {
        text: "Pro Plan",
        emoji: "💎",
        icon: Star,
        style: "text-purple-400",
        badgeStyle: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        buttonStyle: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
        showUpgrade: false
      };
    case "premium":
      return {
        text: "Premium Plan",
        emoji: "👑",
        icon: Crown,
        style: "text-yellow-400",
        badgeStyle: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        buttonStyle: "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700",
        showUpgrade: false
      };
    default:
      return {
        text: "Free Plan",
        emoji: "⭐",
        icon: Shield,
        style: "text-green-400",
        badgeStyle: "bg-green-500/20 text-green-400 border-green-500/30",
        buttonStyle: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
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
const ProgressBar = ({ used, limit, color = "blue" }: { used: number; limit: number; color?: "blue" | "purple" | "green" }) => {
  const percentage = Math.min((used / limit) * 100, 100);
  
  const colorClasses = {
    blue: "bg-blue-500 dark:bg-blue-400",
    purple: "bg-indigo-500 dark:bg-indigo-400",
    green: "bg-emerald-500 dark:bg-emerald-400"
  };

  return (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
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
    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
      {title}
    </h3>
    {showPlus && (
      <Plus className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors" />
    )}
  </div>
);

// Search Dropdown Component
const SearchDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { resumeCount } = useResumeCount();

  const quickActions = [
    { label: 'Start New Interview', href: '/createinterview', icon: Plus, category: 'Actions' },
    { label: 'View Profile', href: '/profile', icon: User, category: 'Actions' },
    { label: 'Upload Resume', href: '/resume/upload', icon: FileText, category: 'Actions' },
    { label: `View ${resumeCount} Resume Analyses`, href: '/resume', icon: FileText, category: 'Actions' },
    { label: 'Generate Cover Letter', href: '/cover-letter', icon: Pen, category: 'Actions' },
  ];

  const navigationItems = [
    { label: 'Dashboard', href: '/', icon: Home, category: 'Navigation' },
    { label: 'Interviews', href: '/interviews', icon: Video, category: 'Navigation' },
    { label: `Resume Analysis (${resumeCount})`, href: '/resume', icon: FileText, category: 'Navigation' },
    { label: 'Cover Letter', href: '/cover-letter', icon: Pen, category: 'Navigation' },
    { label: 'Analytics', href: '/analytics', icon: BarChart3, category: 'Navigation' },
    { label: 'Settings', href: '/settings', icon: Settings, category: 'Navigation' },
  ];

  const helpItems = [
    { label: 'How to prepare for interviews', href: '/help/interview-prep', icon: HelpCircle, category: 'Help' },
    { label: 'Resume writing tips', href: '/help/resume-tips', icon: BookOpen, category: 'Help' },
    { label: 'Contact Support', href: '/help/contact', icon: HelpCircle, category: 'Help' },
  ];

  const allItems = [...quickActions, ...navigationItems, ...helpItems];

  const filteredItems = searchQuery
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allItems;

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof allItems>);

  const handleItemClick = (href: string) => {
    setIsOpen(false);
    setSearchQuery('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const searchContainer = document.getElementById('search-container');
      if (searchContainer && !searchContainer.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div id="search-container" className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Type a command or search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-12 pr-16 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-slate-300 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-700 transition-all"
        />
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs font-medium">
          ⌘ F
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              No results found
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  {category}
                </div>
                <div className="py-1">
                  {items.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${category}-${index}`}
                        href={item.href}
                        onClick={() => handleItemClick(item.href)}
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Main Layout Content Component
function LayoutContent({ children, user, userStats }: LayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { darkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Get dynamic resume data
  const { resumeCount, latestResume, loading: resumeLoading } = useResumeCount();

  // Dynamic navigation items with resume, cover letter, interviews, and planner
  const mainNavItems = [
    { id: 'overview', label: 'Dashboard', icon: Home, href: '/' },
    { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
    { 
      id: 'resume', 
      label: 'Resume', 
      icon: FileText, 
      href: '/resume'
    },
    { 
      id: 'cover-letter', 
      label: 'Cover Letter', 
      icon: Pen,
      href: '/cover-letter' 
    },
    { 
      id: 'interviews', 
      label: 'Interview', 
      icon: Video, 
      href: '/interviews' 
    },
    { 
      id: 'planner', 
      label: 'Planner', 
      icon: Calendar, 
      href: '/planner' 
    },
  ];

  const studyToolsItems = [
    { id: 'templates', label: 'Templates', icon: BookOpen, href: '/templates' },  
  ];

  const aiVoiceToolsItems = [
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  // Bottom navigation items
  const bottomItems = [
    { id: 'help', label: 'Help & Support', icon: HelpCircle, href: '/help' }
  ];

  // Define pages where navbar/sidebar should be hidden
  const authPages = [
    '/sign-in', 
    '/sign-up', 
    '/forgot-password', 
    '/reset-password',
    '/verify-email',
    '/onboarding'
  ];
  
  const isAuthPage = authPages.some(page => pathname.startsWith(page));

  // Define pages that need full width (no padding)
  const fullWidthPages = ['/'];
  const isFullWidthPage = fullWidthPages.includes(pathname);

  // For auth pages, render only children without layout
  if (isAuthPage) {
    return (
      <div className="min-h-screen">
        {children}
      </div>
    );
  }

  // Safe data handling
  const safeUser = user || {};
  const stats = getSafeUserStats(userStats);
  const userSubscription = safeUser?.subscription || null;
  const planInfo = getPlanInfo(userSubscription);

  // Update resume count in stats
  const updatedStats = {
    ...stats,
    resumesUsed: resumeCount,
  };

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
      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${
        isActive
          ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-sm'
          : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center space-x-3">
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{item.label}</span>
      </div>
    </Link>
  );

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 transition-colors flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-all duration-300 ease-in-out flex flex-col h-full overflow-hidden lg:relative lg:z-auto`}
        style={{ 
          width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '280px' 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 h-16">
          <Link href="/" className="flex items-center space-x-3 group" onClick={handleLinkClick}>
            <NextImage 
              src={logo} 
              alt="Preciprocal" 
              width={24} 
              height={24}
              className="rounded-lg group-hover:scale-105 transition-transform"
              priority
            />
            <span className="text-lg font-bold text-slate-900 dark:text-white">Preciprocal</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="p-4 flex-shrink-0 space-y-3">
          <Link 
            href="/createinterview"
            onClick={handleLinkClick}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 py-3 rounded-lg transition-all duration-300 flex items-center justify-center group shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Start Interview
          </Link>
          
          <Link 
            href="/resume/upload"
            onClick={handleLinkClick}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-4 py-3 rounded-lg transition-all duration-300 flex items-center justify-center group shadow-lg hover:shadow-xl"
          >
            <FileText className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
            Analyze Resume
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto min-h-0">
          {/* Main Items */}
          <div className="px-3 space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              return renderNavItem(item, isActive);
            })}
          </div>

          {/* Study Tools Section */}
          <SectionHeader title="Study Tools" showPlus={true} />
          <div className="px-3 space-y-1">
            {studyToolsItems.map((item) => renderNavItem(item, pathname === item.href))}
          </div>

          {/* Recent Resume Activity */}
          {resumeCount > 0 && latestResume && !resumeLoading && (
            <>
              <SectionHeader title="Recent Activity" />
              <div className="px-3">
                <Link
                  href={`/resume/${latestResume.id}`}
                  onClick={handleLinkClick}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-700">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {latestResume.companyName || latestResume.jobTitle || 'Resume Analysis'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Score: {latestResume.feedback?.overallScore || 'Processing...'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${
                      (latestResume.feedback?.overallScore || 0) >= 80 ? 'bg-emerald-500' :
                      (latestResume.feedback?.overallScore || 0) >= 60 ? 'bg-amber-500' : 
                      (latestResume.feedback?.overallScore || 0) > 0 ? 'bg-red-500' : 'bg-slate-300'
                    }`}></div>
                  </div>
                </Link>
              </div>
            </>
          )}

          {/* Other Section */}
          <SectionHeader title="Other" showPlus={false} />
          <div className="px-3 space-y-1">
            {aiVoiceToolsItems.map((item) => renderNavItem(item, pathname === item.href))}
          </div>
        </nav>

        {/* Usage Stats Section */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4 border border-slate-200 dark:border-slate-700">
            {/* Plan Info */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900 dark:text-white">Current Plan</span>
              <span className={`text-sm font-semibold ${planInfo.style}`}>
                {planInfo.text}
              </span>
            </div>

            {/* Interviews Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Interviews</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {updatedStats.interviewsUsed}/{updatedStats.interviewsLimit}
                </span>
              </div>
              <ProgressBar used={updatedStats.interviewsUsed} limit={updatedStats.interviewsLimit} color="purple" />
            </div>

            {/* Resume Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Resume Analysis</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {resumeLoading ? '...' : `${updatedStats.resumesUsed}/${updatedStats.resumesLimit}`}
                </span>
              </div>
              <ProgressBar used={updatedStats.resumesUsed} limit={updatedStats.resumesLimit} color="green" />
            </div>

            {/* Upgrade Button */}
            {planInfo.showUpgrade && (
              <Link 
                href="/pricing"
                className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md ${planInfo.buttonStyle} text-white`}
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade Plan</span>
              </Link>
            )}
          </div>
        </div>

        {/* Bottom Navigation - Help & Logout */}
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 space-y-2 pt-3">
          {bottomItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={handleLinkClick}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 text-sm"
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
          
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
          </button>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden lg:block absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 h-16">
          <div className="h-full px-4 lg:px-6 flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="hidden lg:block flex-1 max-w-2xl">
                <SearchDropdown />
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <button className="p-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Profile */}
              <Link
                href="/profile"
                className="flex items-center space-x-3 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-3 py-2 transition-all duration-200"
              >
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-semibold">{userInitials}</span>
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {safeUser?.name || 'User'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {safeUser?.email || 'user@example.com'}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-200" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area with conditional padding */}
        <main className={`flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 ${isFullWidthPage ? '' : 'p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

// Main component
export default function LayoutClient({ children, user, userStats }: LayoutClientProps) {
  const pathname = usePathname();
  
  const authPages = [
    '/sign-in', 
    '/sign-up', 
    '/forgot-password', 
    '/reset-password',
    '/verify-email',
    '/onboarding'
  ];
  
  const isAuthPage = authPages.some(page => pathname.startsWith(page));

  if (isAuthPage) {
    return (
      <div className="min-h-screen">
        {children}
      </div>
    );
  }

  return (
    <ThemeProvider>
      <LayoutContent user={user} userStats={userStats}>
        {children}
      </LayoutContent>
    </ThemeProvider>
  );
}