// components/LayoutClient.tsx
"use client"
import React, { useState, useEffect, createContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import logo from "@/public/logo.png";
import { 
  Search, 
  Menu,
  X,
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
  ArrowLeftRight,
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import { useNotifications } from '@/lib/hooks/useNotifications';
import NotificationCenter from '@/components/Notifications';
import type { LucideIcon } from 'lucide-react';
import { Toaster } from 'sonner';

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
  createdAt: string | Date;
  feedback?: {
    overallScore?: number;
  };
}

interface PlanInfo {
  text: string;
  displayName: string;
  icon: LucideIcon;
  style: string;
  badgeClass: string;
  showUpgrade: boolean;
}

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/onboarding',
  '/auth/action',
  '/help',
  '/terms',
  '/privacy',
  '/subscription', // Newsletter page
];

// Define routes that should redirect authenticated users
const AUTH_ROUTES = ['/sign-in', '/sign-up', '/forgot-password'];

const ThemeContext = createContext<ThemeContextType | null>(null);

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
          const sorted = resumes.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
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

const getPlanInfo = (subscription: UserData['subscription']): PlanInfo => {
  if (!subscription || subscription.plan === "free" || !subscription.plan) {
    return {
      text: "Free",
      displayName: "Free Plan",
      icon: Shield,
      style: "text-green-400",
      badgeClass: "bg-green-500/10 border-green-500/20 text-green-400",
      showUpgrade: true
    };
  }

  switch (subscription.plan) {
    case "starter":
      return {
        text: subscription.status === "trial" ? "Starter Trial" : "Starter",
        displayName: subscription.status === "trial" ? "Starter Trial" : "Starter Plan",
        icon: Star,
        style: "text-blue-400",
        badgeClass: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        showUpgrade: true
      };
    case "pro":
      return {
        text: subscription.status === "trial" ? "Pro Trial" : "Pro",
        displayName: subscription.status === "trial" ? "Pro Trial" : "Pro Plan",
        icon: Star,
        style: "text-purple-400",
        badgeClass: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        showUpgrade: false
      };
    case "premium":
      return {
        text: "Premium",
        displayName: "Premium Plan",
        icon: Crown,
        style: "text-yellow-400",
        badgeClass: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
        showUpgrade: false
      };
    default:
      return {
        text: "Free",
        displayName: "Free Plan",
        icon: Shield,
        style: "text-green-400",
        badgeClass: "bg-green-500/10 border-green-500/20 text-green-400",
        showUpgrade: true
      };
  }
};

const getSafeUserStats = (userStats: UserStats): SafeUserStats => {
  if (!userStats || typeof userStats !== 'object') {
    return {
      totalInterviews: 0,
      averageScore: 0,
      interviewsUsed: 0,
      interviewsLimit: 1,
      resumesUsed: 0,
      resumesLimit: 999,
    };
  }

  return {
    totalInterviews: userStats.totalInterviews || 0,
    averageScore: userStats.averageScore || 0,
    interviewsUsed: userStats.interviewsUsed || 0,
    interviewsLimit: userStats.interviewsLimit || 1,
    resumesUsed: userStats.resumesUsed || 0,
    resumesLimit: userStats.resumesLimit || 999,
  };
};

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
          className="w-full pl-12 pr-4 py-2.5 text-sm glass-input rounded-xl 
                     bg-slate-800/50 
                     border border-white/10
                     text-white 
                     placeholder-slate-400 
                     focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 
                       bg-slate-800/95 
                       border border-white/10
                       backdrop-blur-xl rounded-xl shadow-xl
                       max-h-96 overflow-y-auto glass-scrollbar z-50 animate-fade-in-up">
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
                        className="flex items-center space-x-3 px-4 py-3 
                                 hover:bg-white/5 
                                 transition-colors 
                                 text-slate-300 
                                 hover:text-white"
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

function LayoutContent({ children, user, userStats }: LayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<Array<{email: string, name: string}>>([]);
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser] = useAuthState(auth);

  const { resumeCount, latestResume, loading: resumeLoading } = useResumeCount();
  
  // Real-time notifications hook
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(currentUser?.uid);

  // Load saved accounts from localStorage
  useEffect(() => {
    const accounts = localStorage.getItem('saved_accounts');
    if (accounts) {
      try {
        setSavedAccounts(JSON.parse(accounts));
      } catch (e) {
        console.error('Failed to parse saved accounts:', e);
      }
    }
  }, []);

  // ============ AUTHENTICATION REDIRECT LOGIC ============
  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));

    if (!user && !isPublicRoute) {
      const redirectUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;
      console.log('🔒 Redirecting to sign-in:', redirectUrl);
      router.push(redirectUrl);
    } else if (user && isAuthRoute) {
      console.log('✅ User authenticated, redirecting to home');
      router.push('/');
    }
  }, [user, pathname, router]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const accountMenu = document.getElementById('account-menu-container');
      if (accountMenu && !accountMenu.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

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

  const authPages = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth/action'];
  const isAuthPage = authPages.some(page => pathname.startsWith(page));

  // Check if current page is a public page
  const publicPages = ['/help', '/terms', '/privacy', '/subscription'];
  const isPublicPage = publicPages.some(page => pathname.startsWith(page));

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  if (!user && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage || isPublicPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  const safeUser = user || {};
  const stats = getSafeUserStats(userStats);
  const userSubscription = safeUser?.subscription || undefined;
  const planInfo = getPlanInfo(userSubscription);

  const updatedStats = { ...stats, resumesUsed: resumeCount };

  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return "U";
    try {
      return name.trim().split(" ").map((word) => word.charAt(0)).join("").toUpperCase().substring(0, 2);
    } catch {
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

  const PlanIcon = planInfo.icon;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/90 to-slate-900/95 -z-10" />
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-full w-64 
                        bg-slate-900/95 
                        backdrop-blur-xl
                        border-r border-white/10
                        shadow-xl
                        z-50 transition-transform duration-300 overflow-y-auto scrollbar-hide ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between h-[57px]">
            <Link href="/" className="flex items-center space-x-3 group" onClick={handleLinkClick}>
              <NextImage src={logo} alt="Preciprocal" width={36} height={36} className="rounded-lg" priority />
              <span className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em', fontWeight: 700 }}>Preciprocal</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div 
            id="account-menu-container"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-full flex items-center space-x-3 mt-4
                       bg-slate-800/50 
                       border border-white/10
                       p-3 rounded-xl relative cursor-pointer
                       hover:bg-slate-800/70
                       transition-colors"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-semibold">
                {userInitials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate text-left">{safeUser?.name || 'User'}</p>
              <div className="flex items-center space-x-1 text-slate-400 text-xs">
                <span className="truncate text-left">{safeUser?.email || 'user@example.com'}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Account Menu Dropdown */}
            {showAccountMenu && (
              <div 
                className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  {/* Current Account */}
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Account</p>
                    <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm">
                        {userInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{safeUser?.name || 'User'}</p>
                        <p className="text-xs text-slate-400 truncate">{safeUser?.email || 'user@example.com'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Saved Accounts */}
                  {savedAccounts.length > 0 && (
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Switch Account</p>
                      {savedAccounts.map((account, index) => {
                        const accountInitials = getInitials(account.name);
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              console.log('Switch to:', account.email);
                              setShowAccountMenu(false);
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors mb-1 cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                              {accountInitials}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-white truncate">{account.name}</p>
                              <p className="text-xs text-slate-400 truncate">{account.email}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Switch Account */}
                  <div className="p-2 border-b border-white/10">
                    <Link
                      href="/sign-in"
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleLinkClick();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span className="text-sm">Switch Account</span>
                    </Link>
                  </div>

                  {/* Account Actions */}
                  <div className="p-2">
                    <Link
                      href="/profile"
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleLinkClick();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300 cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Account Settings</span>
                    </Link>
                    
                    <Link
                      href="/subscription"
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleLinkClick();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300 cursor-pointer"
                    >
                      <Crown className="w-4 h-4" />
                      <span className="text-sm">Manage Subscription</span>
                    </Link>

                    <div className="h-px bg-white/10 my-2" />

                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleLogout();
                      }}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-400 text-sm disabled:opacity-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{isLoggingOut ? 'Logging out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 space-y-2">
          <Link 
            href="/interview/create"
            onClick={handleLinkClick}
            className="glass-button-primary w-full px-4 py-3 rounded-xl hover-lift flex items-center justify-center group
                       bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700
                       shadow-lg hover:shadow-xl cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            <span className="font-medium text-white">Start Interview</span>
          </Link>
          
          <Link 
            href="/resume/upload"
            onClick={handleLinkClick}
            className="w-full px-4 py-3 rounded-xl hover-lift flex items-center justify-center group
                       bg-slate-800/50 
                       border border-white/10
                       hover:bg-slate-800
                       text-white
                       shadow-sm hover:shadow-md cursor-pointer"
          >
            <FileText className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
            <span className="font-medium">Analyze Resume</span>
          </Link>
        </div>

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
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  active 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}

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
                  className="group flex items-center space-x-3 px-3 py-2.5 rounded-lg 
                           text-slate-300 
                           hover:bg-white/5 
                           hover:text-white 
                           transition-all duration-200 cursor-pointer"
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {resumeCount > 0 && latestResume && !resumeLoading && (
            <div className="pt-4">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent</p>
              </div>
              <Link
                href={`/resume/${latestResume.id}`}
                onClick={handleLinkClick}
                className="bg-slate-800/50 
                         border border-white/10
                         mx-2 p-3 rounded-xl
                         hover:bg-slate-800
                         hover:shadow-md transition-all duration-200 cursor-pointer"
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
                  className="group flex items-center space-x-3 px-3 py-2.5 rounded-lg 
                           text-slate-300 
                           hover:bg-white/5 
                           hover:text-white 
                           transition-all duration-200 cursor-pointer"
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-4 mt-4 border-t border-white/10">
          <div className="bg-slate-800/50 
                         border border-white/10
                         rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Plan</span>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${planInfo.badgeClass} text-xs font-medium`}>
                <PlanIcon className="w-3.5 h-3.5" />
                <span>{planInfo.text}</span>
              </div>
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
                href="/pricing"
                onClick={handleLinkClick}
                className="glass-button-primary w-full px-4 py-2.5 rounded-lg hover-lift flex items-center justify-center text-white text-sm font-medium
                           bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700
                           shadow-md hover:shadow-lg cursor-pointer"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg 
                     text-red-400 
                     hover:bg-red-500/10 
                     hover:text-red-300 
                     transition-all duration-200 text-sm disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className={`fixed top-0 right-0 left-0 lg:left-64 z-40 
                          border-b border-white/10 
                          backdrop-blur-xl transition-all duration-300 ${
          scrolled 
            ? 'bg-slate-900/95 shadow-lg' 
            : 'bg-slate-900/80 shadow-sm'
        }`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden 
                         bg-slate-800/50 
                         border border-white/10
                         p-2 rounded-lg hover-lift cursor-pointer"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              
              <div className="hidden lg:block flex-1 max-w-2xl">
                <SearchDropdown />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Real-time Notification Center */}
              <NotificationCenter
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notificationsLoading}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onDelete={deleteNotification}
              />

              <Link href="/profile" className="bg-slate-800/50 
                                              border border-white/10
                                              p-1 rounded-lg hover-lift
                                              hover:bg-slate-800 cursor-pointer">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-sm font-semibold">
                  {userInitials}
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="p-6 mt-[73px] flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function LayoutClient({ children, user, userStats }: LayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));

    if (!user && !isPublicRoute) {
      const redirectUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;
      console.log('🔒 Redirecting to sign-in:', redirectUrl);
      router.push(redirectUrl);
    } else if (user && isAuthRoute) {
      console.log('✅ User authenticated, redirecting to home');
      router.push('/');
    }
  }, [user, pathname, router]);

  const authPages = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth/action'];
  const isAuthPage = authPages.some(page => pathname.startsWith(page));

  // Check if current page is a public page (help, terms, privacy, subscription)
  const publicPages = ['/help', '/terms', '/privacy', '/subscription'];
  const isPublicPage = publicPages.some(page => pathname.startsWith(page));

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  if (!user && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage || isPublicPage) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <div className="min-h-screen">{children}</div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <ThemeProvider>
        <LayoutContent user={user} userStats={userStats}>
          {children}
        </LayoutContent>
      </ThemeProvider>
    </>
  );
}