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
  Settings,
  HelpCircle,
  LogOut,
  Plus,
  Crown,
  FileText,
  Shield,
  Star,
  Calendar,
  Pen,
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import type { LucideIcon } from 'lucide-react';

// Define interfaces
interface ThemeContextType {
  darkMode: boolean;
  toggleTheme: () => void;
}

interface LayoutClientProps {
  children: React.ReactNode;
  user: UserData | null;
  userStats: UserStats;
}

interface UserData {
  id?: string;
  name?: string | null;
  email?: string | null;
  subscription?: {
    plan?: string;
    status?: string;
  };
}

interface UserStats {
  totalInterviews?: number;
  averageScore?: number;
  interviewsUsed?: number;
  interviewsLimit?: number;
  resumesUsed?: number;
  resumesLimit?: number;
}

interface SafeUserStats {
  totalInterviews: number;
  averageScore: number;
  interviewsUsed: number;
  interviewsLimit: number;
  resumesUsed: number;
  resumesLimit: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  category?: string;
}

interface ResumeData {
  id: string;
  companyName?: string;
  jobTitle?: string;
  createdAt: string;
  feedback?: {
    overallScore?: number;
  };
}

interface PlanInfo {
  text: string;
  icon: LucideIcon;
  style: string;
  badgeClass: string;
  showUpgrade: boolean;
}

// Theme Context
const ThemeContext = createContext<ThemeContextType | null>(null);

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme ? savedTheme === 'dark' : true;
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode, mounted]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newMode);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {mounted ? children : <div className="min-h-screen bg-slate-900" />}
    </ThemeContext.Provider>
  );
};

// Custom hook for resume count
const useResumeCount = () => {
  const [user] = useAuthState(auth);
  const [resumeCount, setResumeCount] = useState(0);
  const [latestResume, setLatestResume] = useState<ResumeData | null>(null);
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
const getPlanInfo = (subscription: UserData['subscription']): PlanInfo => {
  if (!subscription || subscription.plan === "starter" || !subscription.plan) {
    return {
      text: "Free Plan",
      icon: Shield,
      style: "text-green-400",
      badgeClass: "status-badge-done",
      showUpgrade: true
    };
  }

  switch (subscription.plan) {
    case "pro":
      return {
        text: subscription.status === "trial" ? "Pro Trial" : "Pro Plan",
        icon: Star,
        style: "text-purple-400",
        badgeClass: "status-badge-progress",
        showUpgrade: false
      };
    case "premium":
      return {
        text: "Premium Plan",
        icon: Crown,
        style: "text-yellow-400",
        badgeClass: "status-badge-todo",
        showUpgrade: false
      };
    default:
      return {
        text: "Free Plan",
        icon: Shield,
        style: "text-green-400",
        badgeClass: "status-badge-done",
        showUpgrade: true
      };
  }
};

const getSafeUserStats = (userStats: UserStats): SafeUserStats => {
  if (!userStats || typeof userStats !== 'object') {
    return {
      totalInterviews: 0,
      averageScore: 0,
      interviewsUsed: 5,
      interviewsLimit: 10,
      resumesUsed: 3,
      resumesLimit: 5,
    };
  }

  return {
    totalInterviews: userStats.totalInterviews || 0,
    averageScore: userStats.averageScore || 0,
    interviewsUsed: userStats.interviewsUsed || 5,
    interviewsLimit: userStats.interviewsLimit || 10,
    resumesUsed: userStats.resumesUsed || 3,
    resumesLimit: userStats.resumesLimit || 5,
  };
};

// Progress Bar Component
const ProgressBar = ({ used, limit }: { used: number; limit: number }) => {
  const percentage = Math.min((used / limit) * 100, 100);
  
  return (
    <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// Search Dropdown Component
const SearchDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', href: '/', icon: Home, category: 'Navigation' },
    { id: 'resume', label: 'Resume Analysis', href: '/resume', icon: FileText, category: 'Navigation' },
    { id: 'cover-letter', label: 'Cover Letter', href: '/cover-letter', icon: Pen, category: 'Navigation' },
    { id: 'interviews', label: 'Interviews', href: '/interview', icon: Video, category: 'Navigation' },
    { id: 'planner', label: 'Planner', href: '/planner', icon: Calendar, category: 'Navigation' },
    { id: 'new-interview', label: 'Start New Interview', href: '/createinterview', icon: Plus, category: 'Actions' },
    { id: 'upload-resume', label: 'Upload Resume', href: '/resume/upload', icon: FileText, category: 'Actions' },
  ];

  const filteredItems = searchQuery
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allItems;

  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

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

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div id="search-container" className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search or jump to..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-12 pr-4 py-2.5 text-sm glass-input rounded-xl text-white placeholder-slate-400 focus:outline-none"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-card max-h-96 overflow-y-auto glass-scrollbar z-50 animate-fade-in-up">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-4 text-center text-slate-400">No results found</div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {category}
                </div>
                <div className="py-1">
                  {items.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${category}-${index}`}
                        href={item.href}
                        onClick={() => {
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-white/5 transition-colors text-slate-300 hover:text-white"
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { darkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const { resumeCount, latestResume, loading: resumeLoading } = useResumeCount();

  // Scroll detection for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const mainNavItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: Home, href: '/' },
    { id: 'resume', label: 'Resume', icon: FileText, href: '/resume' },
    { id: 'cover-letter', label: 'Cover Letter', icon: Pen, href: '/cover-letter' },
    { id: 'interviews', label: 'Interviews', icon: Video, href: '/interview' },
    { id: 'planner', label: 'Planner', icon: Calendar, href: '/planner' },
  ];

  const teamSpaces: NavItem[] = [
    { id: 'templates', label: 'Templates', icon: BookOpen, href: '/templates' },
  ];

  const otherItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
    { id: 'help', label: 'Support', icon: HelpCircle, href: '/help' },
  ];

  const authPages = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding'];
  const isAuthPage = authPages.some(page => pathname.startsWith(page));

  if (isAuthPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  const safeUser = user || {};
  const stats = getSafeUserStats(userStats);
  const userSubscription = safeUser?.subscription || null;
  const planInfo = getPlanInfo(userSubscription);

  const updatedStats = { ...stats, resumesUsed: resumeCount };

  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return "U";
    try {
      return name.trim().split(" ").map((word) => word.charAt(0)).join("").toUpperCase().substring(0, 2);
    } catch (_error) {
      return "U";
    }
  };

  const userInitials = getInitials(safeUser.name);

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

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background with Gradient Mesh */}
      <div className="fixed inset-0 gradient-mesh -z-10" />
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/90 to-slate-900/95 -z-10" />
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Glass Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 glass-sidebar z-50 transition-transform duration-300 glass-scrollbar overflow-y-auto ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo & User Profile */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center space-x-3 group" onClick={handleLinkClick}>
              <NextImage src={logo} alt="Preciprocal" width={28} height={28} className="rounded-lg" priority />
              <span className="text-lg font-bold text-white">Preciprocal</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-3 glass-morphism p-3 rounded-xl">
            <div className="relative">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-semibold">
                {userInitials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{safeUser?.name || 'User'}</p>
              <button className="flex items-center space-x-1 text-slate-400 text-xs hover:text-white transition-colors">
                <span className="truncate">{safeUser?.email || 'user@example.com'}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-3 space-y-2">
          <Link 
            href="/createinterview"
            onClick={handleLinkClick}
            className="glass-button-primary w-full px-4 py-3 rounded-xl hover-lift flex items-center justify-center group"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            <span className="font-medium text-white">Start Interview</span>
          </Link>
          
          <Link 
            href="/resume/upload"
            onClick={handleLinkClick}
            className="glass-button w-full px-4 py-3 rounded-xl hover-lift flex items-center justify-center group text-white"
          >
            <FileText className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
            <span className="font-medium">Analyze Resume</span>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
          </div>
          
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleLinkClick}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  active ? 'bg-white/10 text-white shadow-glass' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}

          {/* Team Spaces Section */}
          <div className="pt-6">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resources</p>
            </div>
            {teamSpaces.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={handleLinkClick}
                  className="group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-all duration-200"
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Recent Resume Activity */}
          {resumeCount > 0 && latestResume && !resumeLoading && (
            <div className="pt-4">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent</p>
              </div>
              <Link
                href={`/resume/${latestResume.id}`}
                onClick={handleLinkClick}
                className="glass-card mx-2 p-3 hover-lift"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {latestResume.companyName || latestResume.jobTitle || 'Resume'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Score: {latestResume.feedback?.overallScore || '...'}%
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Other Section */}
          <div className="pt-6">
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Other</p>
            </div>
            {otherItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={handleLinkClick}
                  className="group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-all duration-200"
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Usage Stats */}
        <div className="p-4 mt-4 border-t border-white/10">
          <div className="glass-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Plan</span>
              <span className={`glass-badge ${planInfo.badgeClass} text-xs px-2 py-1`}>
                {planInfo.text}
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Interviews</span>
                <span className="text-sm font-medium text-white">
                  {updatedStats.interviewsUsed}/{updatedStats.interviewsLimit}
                </span>
              </div>
              <ProgressBar used={updatedStats.interviewsUsed} limit={updatedStats.interviewsLimit} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Resumes</span>
                <span className="text-sm font-medium text-white">
                  {resumeLoading ? '...' : `${updatedStats.resumesUsed}/${updatedStats.resumesLimit}`}
                </span>
              </div>
              <ProgressBar used={updatedStats.resumesUsed} limit={updatedStats.resumesLimit} />
            </div>

            {planInfo.showUpgrade && (
              <Link 
                href="/subscription"
                onClick={handleLinkClick}
                className="glass-button-primary w-full px-4 py-2.5 rounded-lg hover-lift flex items-center justify-center text-white text-sm font-medium"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 text-sm disabled:opacity-50"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Fixed Sticky Top Navigation Bar */}
        <header className={`fixed top-0 right-0 left-0 lg:left-64 z-40 border-b border-white/10 backdrop-blur-xl transition-all duration-300 ${
          scrolled 
            ? 'bg-slate-900/95 dark:bg-slate-900/95 shadow-2xl' 
            : 'bg-slate-900/80 dark:bg-slate-900/80 shadow-lg'
        }`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden glass-button p-2 rounded-lg hover-lift"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              
              <div className="hidden lg:block flex-1 max-w-2xl">
                <SearchDropdown />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={toggleTheme}
                className="glass-button p-2 rounded-lg hover-lift"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5 text-slate-300" /> : <Moon className="w-5 h-5 text-slate-300" />}
              </button>

              <button className="glass-button p-2 rounded-lg hover-lift relative">
                <Bell className="w-5 h-5 text-slate-300" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              <Link href="/profile" className="glass-button p-1 rounded-lg hover-lift">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-sm font-semibold">
                  {userInitials}
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content with top padding to account for fixed header */}
        <main className="p-6 mt-[73px] flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function LayoutClient({ children, user, userStats }: LayoutClientProps) {
  const pathname = usePathname();
  const authPages = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding'];
  const isAuthPage = authPages.some(page => pathname.startsWith(page));

  if (isAuthPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <ThemeProvider>
      <LayoutContent user={user} userStats={userStats}>
        {children}
      </LayoutContent>
    </ThemeProvider>
  );
}