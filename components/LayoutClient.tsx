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
  User
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';

// Theme Context (unchanged)
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
      {mounted ? children : null}
    </ThemeContext.Provider>
  );
};

// Simple hook to fetch resume count
const useResumeCount = () => {
  const [user] = useAuthState(auth);
  const [resumeCount, setResumeCount] = useState(0);
  const [latestResume, setLatestResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchResumeData = async () => {
    if (!user) {
      setResumeCount(0);
      setLatestResume(null);
      setLoading(false);
      return;
    }

    try {
      const resumes = await FirebaseService.getUserResumes(user.uid);
      setResumeCount(resumes.length);
      setLatestResume(resumes.length > 0 ? resumes[0] : null);
      console.log('📊 Resume count updated:', resumes.length);
    } catch (error) {
      console.error('Error fetching resume count:', error);
      setResumeCount(0);
      setLatestResume(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchResumeData();
  }, [user]);

  // Refresh when navigating to/from resume pages
  useEffect(() => {
    if (pathname.includes('/resume')) {
      const timer = setTimeout(fetchResumeData, 1000); // Small delay for data consistency
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Refresh periodically when on resume pages
  useEffect(() => {
    if (pathname.includes('/resume')) {
      const interval = setInterval(fetchResumeData, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [pathname]);

  return { resumeCount, latestResume, loading, refresh: fetchResumeData };
};

// Dynamic sidebar navigation items
const useDynamicNavItems = () => {
  const { resumeCount, loading } = useResumeCount();

  const mainNavItems = [
    { id: 'overview', label: 'Dashboard', icon: Home, href: '/' },
    { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
    { 
      id: 'resume', 
      label: 'Resume Analysis', 
      icon: FileText, 
      href: '/resume',
      badge: loading ? '...' : resumeCount > 0 ? resumeCount.toString() : undefined,
      subtitle: loading ? 'Loading...' : 
                resumeCount === 0 ? 'No analyses yet' : 
                resumeCount === 1 ? '1 analysis' : 
                `${resumeCount} analyses`,
      isActive: (pathname: string) => pathname.startsWith('/resume')
    },
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

  return { mainNavItems, studyToolsItems, aiVoiceToolsItems };
};

// Helper functions (unchanged)
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

// Progress Bar Component (unchanged)
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

// Section Header Component (unchanged)
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

// Search Dropdown Component with dynamic resume count
const SearchDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { resumeCount } = useResumeCount();

  // Updated search suggestions with dynamic resume count
  const quickActions = [
    { label: 'Start New Interview', href: '/createinterview', icon: Plus, category: 'Actions' },
    { label: 'View Profile', href: '/profile', icon: User, category: 'Actions' },
    { label: 'Upload Resume', href: '/resume/upload', icon: FileText, category: 'Actions' },
    { label: `View ${resumeCount} Resume Analyses`, href: '/resume', icon: FileText, category: 'Actions' },
  ];

  const navigationItems = [
    { label: 'Dashboard', href: '/', icon: Home, category: 'Navigation' },
    { label: 'Interviews', href: '/interviews', icon: Video, category: 'Navigation' },
    { label: `Resume Analysis (${resumeCount})`, href: '/resume', icon: FileText, category: 'Navigation' },
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
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Type a command or search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-12 pr-16 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-700 transition-all"
        />
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium">
          ⌘ F
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
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
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Icon className="w-4 h-4 text-gray-400" />
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

// Bottom navigation items
const bottomItems = [
  { id: 'help', label: 'Help & Support', icon: HelpCircle, href: '/help' }
];

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

  // Dynamic navigation items with resume count
  const mainNavItems = [
    { id: 'overview', label: 'Dashboard', icon: Home, href: '/' },
    { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
    { 
      id: 'resume', 
      label: 'Resume Analysis', 
      icon: FileText, 
      href: '/resume',
      badge: resumeLoading ? '...' : resumeCount > 0 ? resumeCount.toString() : undefined,
      subtitle: resumeLoading ? 'Loading...' : 
                resumeCount === 0 ? 'No analyses yet' : 
                resumeCount === 1 ? '1 analysis' : 
                `${resumeCount} analyses`
    },
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
  const planInfo = getPlanInfo(userSubscription);

  // Resize functionality (unchanged)
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
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center space-x-3">
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex flex-col">
          <span className="font-medium">{item.label}</span>
          {item.subtitle && (
            <span className={`text-xs ${
              isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {item.subtitle}
            </span>
          )}
        </div>
      </div>
      {item.badge && (
        <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ${
          isActive 
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
          {item.badge}
        </span>
      )}
    </Link>
  );

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex overflow-hidden">
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
        } lg:translate-x-0 transition-all duration-300 ease-in-out flex flex-col h-full overflow-hidden lg:relative lg:z-auto`}
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

        {/* Quick Actions */}
        <div className="p-4 flex-shrink-0 space-y-3">
          <Link 
            href="/createinterview"
            onClick={handleLinkClick}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center group shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Start Interview
          </Link>
          
          <Link 
            href="/resume/upload"
            onClick={handleLinkClick}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center group"
          >
            <FileText className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
            Analyze Resume
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto min-h-0">
          {/* Main Items with dynamic resume data */}
          <div className="px-3 space-y-1">
            {mainNavItems.map((item) => {
              const isActive = item.isActive ? item.isActive(pathname) : pathname === item.href;
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
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-700">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {latestResume.companyName || latestResume.jobTitle || 'Resume Analysis'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Score: {latestResume.feedback?.overallScore || 'Processing...'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${
                      (latestResume.feedback?.overallScore || 0) >= 80 ? 'bg-green-500' :
                      (latestResume.feedback?.overallScore || 0) >= 60 ? 'bg-yellow-500' : 
                      (latestResume.feedback?.overallScore || 0) > 0 ? 'bg-red-500' : 'bg-gray-300'
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
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 border border-gray-200 dark:border-gray-700">
            {/* Plan Info */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Current Plan</span>
              <span className={`text-sm font-semibold ${planInfo.style}`}>
                {planInfo.text}
              </span>
            </div>

            {/* Interviews Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Interviews</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {updatedStats.interviewsUsed}/{updatedStats.interviewsLimit}
                </span>
              </div>
              <ProgressBar used={updatedStats.interviewsUsed} limit={updatedStats.interviewsLimit} color="purple" />
            </div>

            {/* Dynamic Resume Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Resume Analysis</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {resumeLoading ? 'Loading...' : `${resumeCount}/${updatedStats.resumesLimit}`}
                </span>
              </div>
              <ProgressBar used={resumeCount} limit={updatedStats.resumesLimit} color="blue" />
              {resumeCount > 0 && latestResume && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Latest: {latestResume.companyName || latestResume.jobTitle || 'Recent analysis'}
                </p>
              )}
            </div>

            {/* Upgrade Button */}
            {planInfo.showUpgrade && (
              <Link 
                href="/subscription"
                onClick={handleLinkClick}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center text-sm font-medium shadow-sm"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="space-y-1">
            {bottomItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleLinkClick}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                  pathname === item.href
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </span>
            </button>
          </div>
        </div>

        {/* Resize Handle - Desktop only */}
        <div 
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors hidden lg:block group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-6 h-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm">
            <GripVertical className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
              <SearchDropdown />
            </div>

            {/* Right section */}
            <div className="flex items-center space-x-3">
              {/* Resume Quick Stats in Navbar */}
              {resumeCount > 0 && !resumeLoading && (
                <Link
                  href="/resume"
                  className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">{resumeCount} analyses</span>
                  {latestResume?.feedback?.overallScore && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      latestResume.feedback.overallScore >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      latestResume.feedback.overallScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {latestResume.feedback.overallScore}
                    </span>
                  )}
                </Link>
              )}

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
              <Link
                href="/profile"
                className="flex items-center space-x-3 cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-3 py-2 transition-all duration-200"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
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
                <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
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