// components/LayoutClient.tsx
"use client"
import React, { useState, useEffect } from 'react';
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
  Calendar,
  Pen,
  ArrowLeftRight,
  ChevronRight,
  NotebookPen,
  Sparkles,
  Briefcase,
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import { useNotifications } from '@/lib/hooks/useNotifications';
import NotificationCenter from '@/components/Notifications';
import type { LucideIcon } from 'lucide-react';
import { Toaster } from 'sonner';

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

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  category?: string;
}

interface FAQItem {
  id: string;
  label: string;
  category: string;
  keywords: string[];
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

// ── Avatar helper ─────────────────────────────────────────────────────────────
function UserAvatar({
  photoURL,
  initials,
  size = 'md',
  className = '',
}: {
  photoURL?: string | null;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeMap = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm',
    lg: 'w-10 h-10 text-base',
  };
  const base = `${sizeMap[size]} rounded-full flex-shrink-0 ${className}`;

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt="Profile"
        referrerPolicy="no-referrer"
        className={`${base} object-cover`}
      />
    );
  }
  return (
    <div className={`${base} gradient-primary flex items-center justify-center text-white font-semibold`}>
      {initials}
    </div>
  );
}

// ── Skeleton shown while Firebase auth resolves ───────────────────────────────
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <NextImage
          src={logo}
          alt="Preciprocal"
          width={48}
          height={48}
          className="rounded-xl opacity-80 animate-pulse"
          priority
        />
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/onboarding',
  '/auth/action',
  '/auth',
  '/help',
  '/terms',
  '/privacy',
  '/subscription',
];

const useResumeCount = () => {
  const [user] = useAuthState(auth);
  const [resumeCount, setResumeCount] = useState(0);
  const [latestResume, setLatestResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResumeData = async () => {
      if (!user) { setLoading(false); return; }
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

const FREE_PLAN_INFO: PlanInfo = {
  text: "Free",
  displayName: "Free Plan",
  icon: Shield,
  style: "text-green-400",
  badgeClass: "bg-green-500/10 border-green-500/20 text-green-400",
  showUpgrade: true,
};

const SearchDropdown = () => {
  const [isOpen,      setIsOpen]      = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();

  const highlight = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <span className="text-white font-semibold">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </span>
    );
  };

  const allItems: NavItem[] = [
    { id: 'dashboard',     label: 'Dashboard',           href: '/',                 icon: Home        },
    { id: 'resume',        label: 'Resume Analysis',     href: '/resume',           icon: FileText    },
    { id: 'cover-letter',  label: 'Cover Letter',        href: '/cover-letter',     icon: Pen         },
    { id: 'interviews',    label: 'Interviews',          href: '/interview',        icon: Video       },
    { id: 'planner',       label: 'Planner',             href: '/planner',          icon: Calendar    },
    { id: 'debrief',       label: 'Interview Journal',   href: '/debrief',          icon: NotebookPen },
    { id: 'career-tools',  label: 'Career Tools',        href: '/career-tools',     icon: Sparkles    },
    { id: 'job-tracker',   label: 'Job Tracker',         href: '/job-tracker',      icon: Briefcase   },
    { id: 'new-interview', label: 'Start New Interview', href: '/interview/create', icon: Plus        },
    { id: 'upload-resume', label: 'Upload Resume',       href: '/resume/upload',    icon: FileText    },
  ];

  const faqItems: FAQItem[] = [
    { id: 'faq-g1',  label: 'What is Preciprocal?',                         category: 'general',      keywords: ['about', 'platform', 'overview'] },
    { id: 'faq-g2',  label: 'How do I get started?',                        category: 'general',      keywords: ['start', 'begin', 'onboarding'] },
    { id: 'faq-g4',  label: 'Is Preciprocal free to use?',                  category: 'general',      keywords: ['free', 'pricing', 'cost'] },
    { id: 'faq-g5',  label: 'What are the subscription plans and limits?',  category: 'subscription', keywords: ['plans', 'pricing', 'limits'] },
    { id: 'faq-g9',  label: 'Is my data secure and private?',               category: 'technical',    keywords: ['security', 'privacy', 'safe'] },
    { id: 'faq-i1',  label: 'How does the AI interview simulation work?',   category: 'interviews',   keywords: ['interview', 'AI', 'simulation'] },
    { id: 'faq-r1',  label: 'What does the ATS score mean?',                category: 'resume',       keywords: ['ATS', 'score', 'optimization'] },
    { id: 'faq-c1',  label: 'How does the AI Cover Letter Generator work?', category: 'cover-letter', keywords: ['cover letter', 'generator'] },
    { id: 'faq-p1',  label: 'How do I create an effective study plan?',     category: 'planner',      keywords: ['study plan', 'schedule'] },
  ];

  const filteredNavigation = searchQuery
    ? allItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : allItems;

  const filteredFAQs: FAQItem[] = searchQuery
    ? (() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return [];
        return faqItems
          .map(item => {
            const label = item.label.toLowerCase();
            let score = 0;
            if (label.startsWith(q))                                     score += 100;
            if (label.includes(q))                                       score += 50;
            if (item.keywords.some(k => k.toLowerCase().includes(q)))   score += 10;
            return { item, score };
          })
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(s => s.item);
      })()
    : [];

  const hasResults = filteredNavigation.length > 0 || filteredFAQs.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const el = document.getElementById('search-container');
      if (el && !el.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleFAQClick = (item: FAQItem) => {
    const categoryParam = item.category !== 'general' ? `&category=${item.category}` : '';
    router.push(`/help?q=${encodeURIComponent(item.label)}${categoryParam}`);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div id="search-container" className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search pages, FAQs..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setActiveIndex(-1); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            const total = filteredFAQs.slice(0, 6).length + filteredNavigation.length;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, total - 1)); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
            if (e.key === 'Escape')    { setIsOpen(false); setSearchQuery(''); setActiveIndex(-1); }
            if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault();
              const navCount = filteredNavigation.length;
              if (activeIndex < navCount) router.push(filteredNavigation[activeIndex].href);
              else handleFAQClick(filteredFAQs[activeIndex - navCount]);
              setIsOpen(false); setSearchQuery(''); setActiveIndex(-1);
            }
          }}
          className="w-full pl-12 pr-4 py-2.5 text-sm glass-input rounded-xl 
                     bg-slate-800/50 border border-white/10 text-white 
                     placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 
                       bg-slate-900 border border-slate-700 rounded-xl shadow-2xl
                       max-h-96 overflow-y-auto scrollbar-hide z-[9999] animate-fade-in-up">
          {!searchQuery ? (
            <div className="py-2">
              <div className="px-4 py-2.5 bg-slate-800">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Common Questions</p>
                </div>
              </div>
              <div className="py-1">
                {faqItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleFAQClick(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 text-left border-b border-slate-800 last:border-0 hover:bg-slate-800 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : !hasResults ? (
            <div className="p-6 text-center">
              <p className="text-slate-400 text-sm font-medium">No results for &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <>
              {filteredNavigation.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2.5 bg-slate-800">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pages</p>
                  </div>
                  <div className="py-1">
                    {filteredNavigation.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={`nav-${index}`}
                          href={item.href}
                          onClick={() => { setIsOpen(false); setSearchQuery(''); }}
                          className={`flex items-center space-x-3 px-4 py-3 transition-all duration-150 text-white border-b border-slate-800 last:border-0 cursor-pointer ${activeIndex === index ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-purple-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-200">{highlight(item.label, searchQuery)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {filteredFAQs.length > 0 && (
                <div className={`py-2 ${filteredNavigation.length > 0 ? 'border-t border-slate-700' : ''}`}>
                  <div className="px-4 py-2.5 bg-slate-800">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">FAQ Articles</p>
                    </div>
                  </div>
                  <div className="py-1">
                    {filteredFAQs.slice(0, 6).map((item, faqIdx) => (
                      <button
                        key={item.id}
                        onClick={() => handleFAQClick(item)}
                        className={`w-full flex items-start space-x-3 px-4 py-3 transition-all duration-150 text-white text-left border-b border-slate-800 last:border-0 cursor-pointer ${activeIndex === filteredNavigation.length + faqIdx ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <HelpCircle className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium line-clamp-2 mb-1 text-slate-300">{highlight(item.label, searchQuery)}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 capitalize">
                            {item.category.replace('-', ' ')}
                          </span>
                        </div>
                      </button>
                    ))}
                    {filteredFAQs.length > 6 && (
                      <Link
                        href={`/help?q=${encodeURIComponent(searchQuery)}`}
                        onClick={() => { setIsOpen(false); setSearchQuery(''); }}
                        className="flex items-center justify-center gap-2 px-4 py-3.5
                                 bg-slate-800 text-purple-400 hover:text-purple-300
                                 text-sm font-semibold transition-all duration-150 
                                 border-t border-slate-700 cursor-pointer"
                      >
                        View all {filteredFAQs.length} FAQ results
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function LayoutContent({ children, user }: LayoutClientProps) {
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [isLoggingOut,    setIsLoggingOut]    = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [savedAccounts,   setSavedAccounts]   = useState<Array<{email: string, name: string}>>([]);
  const [recentPages,     setRecentPages]     = React.useState<NavItem[]>([]);
  const [authResolved,    setAuthResolved]    = useState(false);

  const pathname = usePathname();
  const router   = useRouter();

  // Firebase client auth state — this is the source of truth on the client
  const [currentUser, firebaseLoading] = useAuthState(auth);

  const { latestResume } = useResumeCount();

  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(currentUser?.uid);

  const photoURL   = currentUser?.photoURL ?? null;

  // ── Route classification ───────────────────────────────────────────────────
  const authPages   = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth'];
  const publicPages = ['/help', '/terms', '/privacy', '/subscription'];
  const isAuthPage    = authPages.some(p  => pathname.startsWith(p));
  const isPublicPage  = publicPages.some(p => pathname.startsWith(p));
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  // ── Wait for Firebase to resolve before making any routing decisions ───────
  useEffect(() => {
    if (!firebaseLoading) {
      setAuthResolved(true);
    }
  }, [firebaseLoading]);

  // ── Redirect unauthenticated users ONLY after auth is resolved ────────────
  useEffect(() => {
    if (!authResolved) return;
    if (isPublicRoute) return;
    if (!currentUser && !user) {
      router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authResolved, currentUser, user, isPublicRoute, pathname, router]);

  useEffect(() => {
    const accounts = localStorage.getItem('saved_accounts');
    if (accounts) {
      try { setSavedAccounts(JSON.parse(accounts)); }
      catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const el = document.getElementById('account-menu-container');
      if (el && !el.contains(event.target as Node)) setShowAccountMenu(false);
    };
    if (showAccountMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  // ── Recent pages tracking ─────────────────────────────────────────────────
  const TRACKED: NavItem[] = [
    { id: 'resume',       label: 'Resume',            icon: FileText,    href: '/resume'       },
    { id: 'cover-letter', label: 'Cover Letter',      icon: Pen,         href: '/cover-letter' },
    { id: 'interviews',   label: 'Interviews',        icon: Video,       href: '/interview'    },
    { id: 'planner',      label: 'Planner',           icon: Calendar,    href: '/planner'      },
    { id: 'debrief',      label: 'Interview Journal', icon: NotebookPen, href: '/debrief'      },
    { id: 'career-tools', label: 'Career Tools',      icon: Sparkles,    href: '/career-tools' },
    { id: 'job-tracker',  label: 'Job Tracker',       icon: Briefcase,   href: '/job-tracker'  },
    { id: 'templates',    label: 'Templates',         icon: BookOpen,    href: '/templates'    },
  ];

  useEffect(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('prc_recent') || '[]');
      setRecentPages(stored.map(id => TRACKED.find(p => p.id === id)!).filter(Boolean));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const match = TRACKED.find(p => pathname === p.href || pathname.startsWith(p.href + '/'));
    if (!match) return;
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('prc_recent') || '[]');
      const updated = [match.id, ...stored.filter(id => id !== match.id)].slice(0, 3);
      localStorage.setItem('prc_recent', JSON.stringify(updated));
      setRecentPages(updated.map(id => TRACKED.find(p => p.id === id)!).filter(Boolean));
    } catch { /* ignore */ }
  }, [pathname]);

  // ── Render: auth/public pages — no shell ──────────────────────────────────
  if (isAuthPage || isPublicPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  // ── Render: still waiting for Firebase — show skeleton, NEVER black screen ─
  if (!authResolved) {
    return <PageSkeleton />;
  }

  // ── Render: not authenticated and not a public route — show skeleton while redirect happens ─
  if (!currentUser && !user && !isPublicRoute) {
    return <PageSkeleton />;
  }

  // ── From here the user is authenticated ──────────────────────────────────
  const safeUser  = user || {};
  const planInfo  = FREE_PLAN_INFO;

  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return "U";
    try { return name.trim().split(" ").map(w => w.charAt(0)).join("").toUpperCase().substring(0, 2); }
    catch { return "U"; }
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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
  };

  const isActive  = (href: string) => pathname === href;
  const PlanIcon  = planInfo.icon;

  const mainNavItems: NavItem[] = [
    { id: 'overview',     label: 'Overview',         icon: Home,        href: '/'             },
    { id: 'resume',       label: 'Resume',            icon: FileText,    href: '/resume'       },
    { id: 'cover-letter', label: 'Cover Letter',      icon: Pen,         href: '/cover-letter' },
    { id: 'interviews',   label: 'Interviews',        icon: Video,       href: '/interview'    },
    { id: 'planner',      label: 'Planner',           icon: Calendar,    href: '/planner'      },
    { id: 'debrief',      label: 'Interview Journal', icon: NotebookPen, href: '/debrief'      },
    { id: 'career-tools', label: 'Career Tools',      icon: Sparkles,    href: '/career-tools' },
    { id: 'job-tracker',  label: 'Job Tracker',       icon: Briefcase,   href: '/job-tracker'  },
  ];

  const teamSpaces: NavItem[] = [
    { id: 'templates', label: 'Templates', icon: BookOpen, href: '/templates' },
  ];

  const otherItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings,   href: '/settings' },
    { id: 'help',     label: 'Support',  icon: HelpCircle, href: '/help'     },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/90 to-slate-900/95 -z-10" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed left-0 top-0 h-full w-64 
                        bg-slate-900/95 backdrop-blur-xl
                        border-r border-white/10 shadow-xl
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

          {/* Account switcher */}
          <div
            id="account-menu-container"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-full flex items-center space-x-3 mt-4
                       bg-slate-800/50 border border-white/10
                       p-3 rounded-xl relative cursor-pointer
                       hover:bg-slate-800/70 transition-colors"
          >
            <div className="relative flex-shrink-0">
              <UserAvatar photoURL={photoURL} initials={userInitials} size="md" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate text-left">{safeUser?.name || 'User'}</p>
              <div className="flex items-center space-x-1 text-slate-400 text-xs">
                <span className="truncate text-left">{safeUser?.email || currentUser?.email || 'user@example.com'}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {showAccountMenu && (
              <div
                className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Account</p>
                    <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                      <UserAvatar photoURL={photoURL} initials={userInitials} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{safeUser?.name || 'User'}</p>
                        <p className="text-xs text-slate-400 truncate">{safeUser?.email || currentUser?.email || ''}</p>
                      </div>
                    </div>
                  </div>

                  {savedAccounts.length > 0 && (
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Switch Account</p>
                      {savedAccounts.map((account, index) => (
                        <button
                          key={index}
                          onClick={() => { setShowAccountMenu(false); }}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors mb-1 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {getInitials(account.name)}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-white truncate">{account.name}</p>
                            <p className="text-xs text-slate-400 truncate">{account.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-2 border-b border-white/10">
                    <Link
                      href="/sign-in"
                      onClick={() => { setShowAccountMenu(false); handleLinkClick(); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span className="text-sm">Switch Account</span>
                    </Link>
                  </div>

                  <div className="p-2">
                    <Link
                      href="/profile"
                      onClick={() => { setShowAccountMenu(false); handleLinkClick(); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300 cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Account Settings</span>
                    </Link>

                    <Link
                      href="/pricing"
                      onClick={() => { setShowAccountMenu(false); handleLinkClick(); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300 cursor-pointer"
                    >
                      <Crown className="w-4 h-4" />
                      <span className="text-sm">Manage Subscription</span>
                    </Link>

                    <div className="h-px bg-white/10 my-2" />

                    <button
                      onClick={() => { setShowAccountMenu(false); handleLogout(); }}
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

        {/* Quick actions */}
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
                       bg-slate-800/50 border border-white/10 hover:bg-slate-800
                       text-white shadow-sm hover:shadow-md cursor-pointer"
          >
            <FileText className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
            <span className="font-medium">Analyze Resume</span>
          </Link>
        </div>

        {/* Main nav */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
          </div>

          {mainNavItems.map((item) => {
            const Icon   = item.icon;
            const active = isActive(item.href);
            const isNew  = ['debrief', 'career-tools', 'job-tracker'].includes(item.id);

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
                {isNew && !active && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 font-medium leading-none">
                    New
                  </span>
                )}
              </Link>
            );
          })}

          {/* Resources */}
          <div className="pt-6">
            <div className="px-3 py-2">
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
                           text-slate-300 hover:bg-white/5 hover:text-white 
                           transition-all duration-200 cursor-pointer"
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Recent */}
          {recentPages.length > 0 && (() => {
            const item     = recentPages[0];
            const Icon     = item.icon;
            const isResume = item.id === 'resume';
            return (
              <div className="pt-4">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent</p>
                </div>
                <Link
                  href={isResume && latestResume ? `/resume/${latestResume.id}` : item.href}
                  onClick={handleLinkClick}
                  className="bg-slate-800/50 border border-white/10 mx-2 p-3 rounded-xl
                             hover:bg-slate-800 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {isResume && latestResume
                          ? (latestResume.companyName || latestResume.jobTitle || 'Resume')
                          : item.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {isResume && latestResume
                          ? `Score: ${latestResume.feedback?.overallScore || '...'}%`
                          : 'Recently visited'}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })()}

          {/* Other */}
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
                           text-slate-300 hover:bg-white/5 hover:text-white 
                           transition-all duration-200 cursor-pointer"
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Plan */}
        <div className="p-4 mt-4 border-t border-white/10">
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Plan</span>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${planInfo.badgeClass} text-xs font-medium`}>
                <PlanIcon className="w-3.5 h-3.5" />
                <span>{planInfo.text}</span>
              </div>
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

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg 
                     text-red-400 hover:bg-red-500/10 hover:text-red-300 
                     transition-all duration-200 text-sm disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className={`fixed top-0 right-0 left-0 lg:left-64 z-40 
                          border-b border-white/10 backdrop-blur-xl transition-all duration-300 ${
          scrolled
            ? 'bg-slate-900/95 shadow-lg'
            : 'bg-slate-900/80 shadow-sm'
        }`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden bg-slate-800/50 border border-white/10 p-2 rounded-lg hover-lift cursor-pointer"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>

              <div className="hidden lg:block flex-1 max-w-2xl">
                <SearchDropdown />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <NotificationCenter
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notificationsLoading}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onDelete={deleteNotification}
              />

              <Link
                href="/profile"
                className="bg-slate-800/50 border border-white/10 p-1 rounded-lg hover-lift hover:bg-slate-800 cursor-pointer"
              >
                <UserAvatar
                  photoURL={photoURL}
                  initials={userInitials}
                  size="sm"
                  className="rounded-lg"
                />
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
  return (
    <>
      <Toaster
        position="top-right"
        expand={false}
        gap={8}
        toastOptions={{
          duration: 3000,
          style: {
            background:     '#0f172a',
            border:         '1px solid rgba(148,163,184,0.12)',
            borderRadius:   '12px',
            color:          '#f1f5f9',
            fontSize:       '13px',
            fontWeight:     '500',
            padding:        '12px 16px',
            boxShadow:      '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
            gap:            '10px',
          },
          classNames: {
            toast:        'font-sans',
            title:        'text-slate-100 font-semibold text-sm',
            description:  'text-slate-400 text-xs mt-0.5',
            success:      'border-emerald-500/25 [&>[data-icon]]:text-emerald-400',
            error:        'border-red-500/25    [&>[data-icon]]:text-red-400',
            warning:      'border-amber-500/25  [&>[data-icon]]:text-amber-400',
            info:         'border-blue-500/25   [&>[data-icon]]:text-blue-400',
            actionButton: 'bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg px-3 py-1.5',
            cancelButton: 'bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg px-3 py-1.5',
            closeButton:  'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700',
          },
        }}
      />
      <LayoutContent user={user} userStats={userStats}>
        {children}
      </LayoutContent>
    </>
  );
}