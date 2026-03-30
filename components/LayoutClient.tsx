// components/LayoutClient.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import logo from "@/public/logo.png";
import {
  Search, Menu, X, Home, Video, BookOpen, Settings, HelpCircle,
  LogOut, Crown, FileText, Shield, Calendar, Pen, ArrowLeftRight,
  ChevronRight, NotebookPen, Sparkles, Briefcase, Zap,
} from 'lucide-react';
import { signOut } from "@/lib/actions/auth.action";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import { useNotifications } from '@/lib/hooks/useNotifications';
import NotificationCenter from '@/components/Notifications';
import type { LucideIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  feedback?: { overallScore?: number };
}

interface PlanInfo {
  text: string;
  displayName: string;
  icon: LucideIcon;
  style: string;
  badgeClass: string;
  showUpgrade: boolean;
}

// ─── Plan helpers ─────────────────────────────────────────────────────────────

function getPlanInfo(subscription?: UserData['subscription']): PlanInfo {
  const plan   = subscription?.plan ?? 'free';
  const status = subscription?.status ?? 'active';

  if (plan === 'premium' && status === 'active') {
    return {
      text: 'Premium', displayName: 'Premium Plan', icon: Zap,
      style: 'text-purple-400',
      badgeClass: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      showUpgrade: false,
    };
  }

  if (plan === 'pro' && status === 'active') {
    return {
      text: 'Pro', displayName: 'Pro Plan', icon: Crown,
      style: 'text-indigo-400',
      badgeClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      showUpgrade: true,
    };
  }

  if (plan === 'enterprise') {
    return {
      text: 'Enterprise', displayName: 'Enterprise Plan', icon: Zap,
      style: 'text-amber-400',
      badgeClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      showUpgrade: false,
    };
  }

  // free / starter / canceled / past_due / anything else → Free tier
  return {
    text: 'Free', displayName: 'Free Plan', icon: Shield,
    style: 'text-green-400',
    badgeClass: 'bg-green-500/10 border-green-500/20 text-green-400',
    showUpgrade: true,
  };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({
  photoURL, initials, size = 'md', className = '',
}: {
  photoURL?: string | null;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeMap = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-sm', lg: 'w-10 h-10 text-base' };
  const base = `${sizeMap[size]} rounded-full flex-shrink-0 ${className}`;
  if (photoURL) {
    return <img src={photoURL} alt="Profile photo" referrerPolicy="no-referrer" className={`${base} object-cover`} />;
  }
  return (
    <div className={`${base} gradient-primary flex items-center justify-center text-white font-semibold`}
      aria-label={`User avatar: ${initials}`}>
      {initials}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  '/sign-in', '/sign-up', '/forgot-password', '/reset-password',
  '/verify-email', '/onboarding', '/auth/action', '/auth',
  '/help', '/terms', '/privacy', '/subscription',
];

// ─── Resume count hook ────────────────────────────────────────────────────────

const useResumeCount = () => {
  const [user] = useAuthState(auth);
  const [resumeCount,  setResumeCount]  = useState(0);
  const [latestResume, setLatestResume] = useState<ResumeData | null>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const fetchResumeData = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const resumes = await FirebaseService.getUserResumes(user.uid);
        setResumeCount(resumes.length);
        if (resumes.length > 0) {
          const sorted = [...resumes].sort((a, b) => {
            const da = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const db = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return db.getTime() - da.getTime();
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

// ─── Search dropdown ──────────────────────────────────────────────────────────

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
    { id: 'new-interview', label: 'Start New Interview', href: '/interview/create', icon: Video       },
    { id: 'upload-resume', label: 'Upload Resume',       href: '/resume/upload',    icon: FileText    },
  ];

  const faqItems: FAQItem[] = [
    { id: 'faq-g1',  label: 'What is Preciprocal?',                         category: 'general',      keywords: ['about', 'platform', 'overview'] },
    { id: 'faq-g2',  label: 'How do I get started?',                        category: 'general',      keywords: ['start', 'begin', 'onboarding'] },
    { id: 'faq-g3',  label: 'Do I need to upload my resume?',               category: 'general',      keywords: ['resume', 'required', 'optional'] },
    { id: 'faq-g4',  label: 'Is Preciprocal free to use?',                  category: 'general',      keywords: ['free', 'pricing', 'cost'] },
    { id: 'faq-g5',  label: 'What are the subscription plans and limits?',  category: 'subscription', keywords: ['plans', 'pricing', 'limits'] },
    { id: 'faq-g6',  label: 'Is there a student discount?',                 category: 'subscription', keywords: ['student', 'discount', 'education'] },
    { id: 'faq-g7',  label: 'Can I cancel my subscription anytime?',        category: 'subscription', keywords: ['cancel', 'unsubscribe', 'stop'] },
    { id: 'faq-g8',  label: 'When do usage limits reset?',                  category: 'subscription', keywords: ['reset', 'limits', 'renewal'] },
    { id: 'faq-g9',  label: 'Is my data secure and private?',               category: 'technical',    keywords: ['security', 'privacy', 'safe'] },
    { id: 'faq-g10', label: 'What browsers are supported?',                 category: 'technical',    keywords: ['browser', 'Chrome', 'Firefox'] },
    { id: 'faq-g11', label: 'Can I use Preciprocal on mobile?',             category: 'technical',    keywords: ['mobile', 'phone', 'tablet'] },
    { id: 'faq-g12', label: 'Do I need a webcam or microphone?',            category: 'technical',    keywords: ['webcam', 'microphone', 'camera'] },
    { id: 'faq-g13', label: 'How do I update my profile?',                  category: 'account',      keywords: ['profile', 'update', 'edit'] },
    { id: 'faq-g14', label: 'Can I change my email address?',               category: 'account',      keywords: ['email', 'change email'] },
    { id: 'faq-g15', label: 'How do I delete my account?',                  category: 'account',      keywords: ['delete', 'remove', 'close account'] },
    { id: 'faq-g16', label: 'What is your refund policy?',                  category: 'support',      keywords: ['refund', 'money back', 'guarantee'] },
    { id: 'faq-g17', label: 'How do I contact support?',                    category: 'support',      keywords: ['contact', 'support', 'help'] },
    { id: 'faq-g18', label: 'What is your response time for tickets?',      category: 'support',      keywords: ['response time', 'support speed'] },
    { id: 'faq-i1',  label: 'How does the AI interview simulation work?',   category: 'interviews',   keywords: ['interview', 'AI', 'simulation'] },
    { id: 'faq-i2',  label: 'What interview types are supported?',          category: 'interviews',   keywords: ['types', 'technical', 'behavioral'] },
    { id: 'faq-i3',  label: 'Can I practice for specific companies?',       category: 'interviews',   keywords: ['company', 'specific', 'target'] },
    { id: 'faq-i4',  label: 'How long does each interview session last?',   category: 'interviews',   keywords: ['duration', 'time', 'length'] },
    { id: 'faq-i5',  label: 'How accurate is the interview feedback?',      category: 'interviews',   keywords: ['feedback', 'accuracy', 'scoring'] },
    { id: 'faq-i6',  label: 'Can I review my past interview performances?', category: 'interviews',   keywords: ['review', 'history', 'past'] },
    { id: 'faq-i7',  label: 'Does the platform support voice interviews?',  category: 'interviews',   keywords: ['voice', 'audio', 'speaking'] },
    { id: 'faq-i8',  label: 'What happens if I make a mistake?',            category: 'interviews',   keywords: ['mistake', 'error', 'retry'] },
    { id: 'faq-i9',  label: 'What is the Interview Debrief Journal?',       category: 'interviews',   keywords: ['debrief', 'journal', 'log'] },
    { id: 'faq-i10', label: 'How do I log a real interview?',               category: 'interviews',   keywords: ['log', 'real', 'debrief'] },
    { id: 'faq-r1',  label: 'What does the ATS score mean?',                category: 'resume',       keywords: ['ATS', 'score', 'applicant tracking'] },
    { id: 'faq-r2',  label: 'Can I analyze multiple resumes?',              category: 'resume',       keywords: ['multiple', 'versions', 'compare'] },
    { id: 'faq-r3',  label: 'What file formats are supported for resume?',  category: 'resume',       keywords: ['format', 'PDF', 'upload'] },
    { id: 'faq-r4',  label: 'How does the Recruiter Eye Simulation work?',  category: 'resume',       keywords: ['recruiter', 'eye', 'simulation'] },
    { id: 'faq-r5',  label: 'Does the AI improve my resume automatically?', category: 'resume',       keywords: ['automatic', 'AI editing', 'suggestions'] },
    { id: 'faq-r6',  label: 'How often should I update my resume?',         category: 'resume',       keywords: ['update', 'frequency'] },
    { id: 'faq-r7',  label: 'Can I download my analyzed resume?',           category: 'resume',       keywords: ['download', 'export', 'save'] },
    { id: 'faq-c1',  label: 'How does the AI Cover Letter Generator work?', category: 'cover-letter', keywords: ['cover letter', 'generator'] },
    { id: 'faq-c2',  label: 'What information does the AI use?',            category: 'cover-letter', keywords: ['inputs', 'data sources'] },
    { id: 'faq-c3',  label: 'Can I customize the tone of my cover letter?', category: 'cover-letter', keywords: ['tone', 'style', 'customize'] },
    { id: 'faq-c4',  label: 'How long does it take to generate?',           category: 'cover-letter', keywords: ['speed', 'time', 'how long'] },
    { id: 'faq-c5',  label: 'Does the cover letter use my resume?',         category: 'cover-letter', keywords: ['resume integration'] },
    { id: 'faq-c6',  label: 'Can I edit the generated cover letter?',       category: 'cover-letter', keywords: ['edit', 'modify', 'customize'] },
    { id: 'faq-c7',  label: 'How many cover letters can I generate?',       category: 'cover-letter', keywords: ['limit', 'how many', 'quota'] },
    { id: 'faq-p1',  label: 'How do I create an effective study plan?',     category: 'planner',      keywords: ['study plan', 'create plan'] },
    { id: 'faq-p2',  label: 'Can I customize my study plan?',               category: 'planner',      keywords: ['customize', 'modify', 'personalize'] },
    { id: 'faq-p3',  label: 'What happens if I miss a day in my plan?',     category: 'planner',      keywords: ['miss day', 'skip', 'behind'] },
    { id: 'faq-p4',  label: 'What happens when I complete all tasks?',      category: 'planner',      keywords: ['complete', 'finish', 'done'] },
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
            if (item.keywords.some(k => k.toLowerCase().startsWith(q))) score += 30;
            if (item.keywords.some(k => k.toLowerCase().includes(q)))   score += 10;
            q.split(' ').forEach(word => { if (word.length > 1 && label.includes(word)) score += 5; });
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
    const catParam = item.category !== 'general' ? `&category=${item.category}` : '';
    router.push(`/help?q=${encodeURIComponent(item.label)}${catParam}`);
    setIsOpen(false); setSearchQuery('');
  };

  const closeAndNavigate = () => { setIsOpen(false); setSearchQuery(''); };

  return (
    <div id="search-container" className="relative" role="search">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search pages, FAQs…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setActiveIndex(-1); }}
          onFocus={() => setIsOpen(true)}
          aria-label="Search pages and FAQs"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onKeyDown={e => {
            const total = filteredFAQs.slice(0, 6).length + filteredNavigation.length;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, total - 1)); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
            if (e.key === 'Escape')    { setIsOpen(false); setSearchQuery(''); setActiveIndex(-1); }
            if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault();
              const navCount = filteredNavigation.length;
              if (activeIndex < navCount) router.push(filteredNavigation[activeIndex].href);
              else handleFAQClick(filteredFAQs[activeIndex - navCount]);
              closeAndNavigate(); setActiveIndex(-1);
            }
          }}
          className="w-full pl-11 pr-4 py-2.5 text-sm glass-input rounded-xl
                     bg-slate-800/50 border border-white/10 text-white
                     placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                     transition-colors"
        />
      </div>

      {isOpen && (
        <div role="listbox" aria-label="Search results"
          className="absolute top-full left-0 right-0 mt-2
                     bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl
                     max-h-96 overflow-y-auto scrollbar-hide z-[9999] animate-fade-in-up">
          {!searchQuery ? (
            <div className="py-2">
              <div className="px-4 py-2.5 bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Common Questions</p>
                </div>
              </div>
              <div className="py-1">
                {faqItems
                  .filter(f => ['faq-g1','faq-i1','faq-r1','faq-c1','faq-p1','faq-g5','faq-g9'].includes(f.id))
                  .map(item => (
                    <button key={item.id} onClick={() => handleFAQClick(item)} role="option"
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-slate-800 last:border-0 hover:bg-slate-800/80">
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
            <div className="p-8 text-center">
              <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <>
              {filteredNavigation.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2.5 bg-slate-800/60">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pages</p>
                  </div>
                  <div className="py-1">
                    {filteredNavigation.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <Link key={`nav-${index}`} href={item.href} role="option" onClick={closeAndNavigate}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors border-b border-slate-800 last:border-0
                                      ${activeIndex === index ? 'bg-slate-700' : 'hover:bg-slate-800/80'}`}>
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
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
                  <div className="px-4 py-2.5 bg-slate-800/60">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">FAQ Articles</p>
                    </div>
                  </div>
                  <div className="py-1">
                    {filteredFAQs.slice(0, 6).map((item, faqIdx) => (
                      <button key={item.id} onClick={() => handleFAQClick(item)} role="option"
                        className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left border-b border-slate-800 last:border-0
                                    ${activeIndex === filteredNavigation.length + faqIdx ? 'bg-slate-700' : 'hover:bg-slate-800/80'}`}>
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <HelpCircle className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2 mb-1 text-slate-300">{highlight(item.label, searchQuery)}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 capitalize">
                            {item.category.replace('-', ' ')}
                          </span>
                        </div>
                      </button>
                    ))}
                    {filteredFAQs.length > 6 && (
                      <Link href={`/help?q=${encodeURIComponent(searchQuery)}`} onClick={closeAndNavigate}
                        className="flex items-center justify-center gap-2 px-4 py-3.5
                                   bg-slate-800/60 text-purple-400 hover:text-purple-300
                                   text-sm font-semibold transition-colors border-t border-slate-700">
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

// ─── Main layout ──────────────────────────────────────────────────────────────

function LayoutContent({ children, user }: LayoutClientProps) {
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [isLoggingOut,   setIsLoggingOut]   = useState(false);
  const [scrolled,       setScrolled]       = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const pathname = usePathname();
  const [recentPages, setRecentPages] = React.useState<NavItem[]>([]);
  const router = useRouter();
  const [currentUser, loading] = useAuthState(auth);
  const [authResolved, setAuthResolved] = useState(false);

  // ── Live subscription from Firestore (bypasses Redis cache) ───────────────
  const [liveSubscription, setLiveSubscription] = useState(user?.subscription);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const { db: clientDb } = await import("@/firebase/client");
      const { doc, onSnapshot } = await import("firebase/firestore");
      unsub = onSnapshot(doc(clientDb, "users", currentUser.uid), (snap) => {
        const data = snap.data();
        if (data?.subscription) {
          setLiveSubscription(data.subscription);
        }
      });
    })();
    return () => unsub?.();
  }, [currentUser?.uid]);

  const { latestResume } = useResumeCount();

  const {
    notifications, unreadCount,
    loading: notificationsLoading,
    markAsRead, markAllAsRead, deleteNotification,
  } = useNotifications(currentUser?.uid);

  const photoURL = currentUser?.photoURL ?? null;

  // ── Derive plan info from live Firestore subscription ─────────────────────
  const planInfo = getPlanInfo(liveSubscription);
  const PlanIcon = planInfo.icon;

  useEffect(() => { if (!loading) setAuthResolved(true); }, [loading]);

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    if (!authResolved) return;
    if (!user && !currentUser && !isPublicRoute) {
      router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, currentUser, authResolved, pathname, router]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('header-account-menu');
      if (menu && !menu.contains(event.target as Node)) setShowHeaderMenu(false);
    };
    if (showHeaderMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHeaderMenu]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSidebarOpen(false); setShowHeaderMenu(false); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

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

  const teamSpaces: NavItem[] = [{ id: 'templates', label: 'Templates', icon: BookOpen, href: '/templates' }];

  const otherItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings,   href: '/settings' },
    { id: 'help',     label: 'Support',  icon: HelpCircle, href: '/help'     },
  ];

  const authPages   = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth/action', '/auth'];
  const publicPages = ['/help', '/terms', '/privacy', '/subscription'];

  const isAuthPage    = authPages.some(page   => pathname.startsWith(page));
  const isPublicPage  = publicPages.some(page => pathname.startsWith(page));
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

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

  React.useEffect(() => {
    const match = TRACKED.find(p => pathname === p.href || pathname.startsWith(p.href + '/'));
    if (!match) return;
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('prc_recent') || '[]');
      const updated = [match.id, ...stored.filter(id => id !== match.id)].slice(0, 3);
      localStorage.setItem('prc_recent', JSON.stringify(updated));
      setRecentPages(updated.map(id => TRACKED.find(p => p.id === id)!).filter(Boolean));
    } catch {}
  }, [pathname]);

  React.useEffect(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('prc_recent') || '[]');
      setRecentPages(stored.map(id => TRACKED.find(p => p.id === id)!).filter(Boolean));
    } catch {}
  }, []);

  if (isAuthPage || isPublicPage) return <div className="min-h-screen">{children}</div>;

  if (!authResolved) {
    return <AnimatedLoader isVisible={true} loadingText="Loading" showNavigation={false} tone="focused" />;
  }

  if (!user && !currentUser && !isPublicRoute) {
    return <AnimatedLoader isVisible={true} loadingText="Redirecting" showNavigation={false} tone="focused" />;
  }

  const safeUser     = user || {};
  const getInitials  = (name?: string | null) => {
    if (!name || typeof name !== 'string' || !name.trim()) return 'U';
    try { return name.trim().split(' ').map(w => w.charAt(0)).join('').toUpperCase().substring(0, 2); }
    catch { return 'U'; }
  };
  const userInitials = getInitials(safeUser.name);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
  };

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/90 to-slate-900/95 -z-10" aria-hidden="true" />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} role="button" tabIndex={-1} />
      )}

      {/* ── Sidebar ──────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full w-64
                    bg-slate-900/95 backdrop-blur-xl border-r border-white/10 shadow-xl
                    z-50 transition-transform duration-300 overflow-y-auto scrollbar-hide
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        aria-label="Main navigation"
      >
        {/* Logo + user card */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between h-[57px]">
            <Link href="/" className="flex items-center space-x-3 group" onClick={handleLinkClick}>
              <NextImage src={logo} alt="Preciprocal logo" width={36} height={36} className="rounded-lg" priority />
              <span className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>
                Preciprocal
              </span>
            </Link>
            <button onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <Link href="/profile" onClick={handleLinkClick}
            className="w-full flex items-center space-x-3 mt-4
                       bg-slate-800/50 border border-white/10 p-3 rounded-xl hover:bg-slate-800/70 transition-colors">
            <div className="relative flex-shrink-0">
              <UserAvatar photoURL={photoURL} initials={userInitials} size="md" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{safeUser?.name || 'User'}</p>
              <p className="text-slate-400 text-xs break-all leading-snug mt-0.5">{safeUser?.email || ''}</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1" aria-label="App sections">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</p>
          </div>
          {mainNavItems.map(item => {
            const Icon   = item.icon;
            const active = isActive(item.href);
            const isNew  = ['debrief', 'career-tools', 'job-tracker'].includes(item.id);
            return (
              <Link key={item.id} href={item.href} onClick={handleLinkClick}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150
                             ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                {isNew && !active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 font-semibold leading-none">
                    New
                  </span>
                )}
              </Link>
            );
          })}

          {/* Resources */}
          <div className="pt-6">
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resources</p>
            </div>
            {teamSpaces.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href} onClick={handleLinkClick}
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
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
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent</p>
                </div>
                <Link href={isResume && latestResume ? `/resume/${latestResume.id}` : item.href}
                  onClick={handleLinkClick}
                  className="bg-slate-800/50 border border-white/10 mx-2 p-3 rounded-xl hover:bg-slate-800 transition-colors block">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {isResume && latestResume ? (latestResume.companyName || latestResume.jobTitle || 'Resume') : item.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isResume && latestResume ? `Score: ${latestResume.feedback?.overallScore ?? '…'}%` : 'Recently visited'}
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Other</p>
            </div>
            {otherItems.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href} onClick={handleLinkClick}
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Icon className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ── Plan card ─────────────────────────────── */}
        <div className="p-4 mt-4 border-t border-white/10">
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Plan</span>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${planInfo.badgeClass} text-xs font-semibold`}>
                <PlanIcon className="w-3.5 h-3.5" />
                <span>{planInfo.text}</span>
              </div>
            </div>

            {/* Plan-specific description */}
            <p className="text-[11px] text-slate-500 leading-snug">
              {planInfo.text === 'Premium' && 'Unlimited access to all features.'}
              {planInfo.text === 'Pro'     && 'Most features unlocked. Upgrade for unlimited.'}
              {planInfo.text === 'Free'    && 'Limited usage. Upgrade to unlock everything.'}
              {planInfo.text === 'Enterprise' && 'Full enterprise access enabled.'}
            </p>

            {planInfo.showUpgrade && (
              <Link href="/pricing" onClick={handleLinkClick}
                className="w-full px-4 py-2.5 rounded-lg flex items-center justify-center
                           text-white text-sm font-semibold
                           bg-gradient-to-r from-purple-600 to-blue-600
                           hover:from-purple-700 hover:to-blue-700
                           shadow-md hover:shadow-lg transition-all hover-lift">
                <Crown className="w-4 h-4 mr-2" />
                {planInfo.text === 'Pro' ? 'Upgrade to Premium' : 'Upgrade Plan'}
              </Link>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout} disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg
                       text-red-400 hover:bg-red-500/10 hover:text-red-300
                       transition-colors text-sm disabled:opacity-50">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────── */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header
          className={`fixed top-0 right-0 left-0 lg:left-64 z-40
                      border-b border-white/10 backdrop-blur-xl transition-all duration-200
                      ${scrolled ? 'bg-slate-900/95 shadow-lg' : 'bg-slate-900/80'}`}
          role="banner"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden bg-slate-800/50 border border-white/10 p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}>
                <Menu className="w-5 h-5 text-white" />
              </button>
              <div className="hidden lg:block flex-1 max-w-xl">
                <SearchDropdown />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationCenter
                notifications={notifications} unreadCount={unreadCount}
                loading={notificationsLoading}
                onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} onDelete={deleteNotification}
              />

              <div id="header-account-menu" className="relative">
                <button onClick={() => setShowHeaderMenu(prev => !prev)}
                  className="bg-slate-800/50 border border-white/10 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Open account menu" aria-expanded={showHeaderMenu} aria-haspopup="menu">
                  <UserAvatar photoURL={photoURL} initials={userInitials} size="sm" className="rounded-lg" />
                </button>

                {showHeaderMenu && (
                  <div role="menu" aria-label="Account options"
                    className="absolute top-full right-0 mt-2 w-64
                               bg-[#0f172a] border border-white/10
                               rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                    <div className="px-4 pt-4 pb-3 border-b border-white/10">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Current Account</p>
                      <div className="flex items-center gap-3">
                        <UserAvatar photoURL={photoURL} initials={userInitials} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{safeUser?.name || 'User'}</p>
                          <p className="text-xs text-slate-400 break-all leading-snug mt-0.5">{safeUser?.email || ''}</p>
                        </div>
                      </div>
                      {/* Plan badge in header menu */}
                      <div className={`mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${planInfo.badgeClass} w-fit text-xs font-semibold`}>
                        <PlanIcon className="w-3 h-3" />
                        <span>{planInfo.displayName}</span>
                      </div>
                    </div>

                    <div className="p-2" role="group">
                      <Link href="/sign-in" role="menuitem"
                        onClick={() => { setShowHeaderMenu(false); handleLinkClick(); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300">
                        <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">Switch Account</span>
                      </Link>

                      <div className="h-px bg-white/10 my-1" />

                      <Link href="/profile" role="menuitem"
                        onClick={() => { setShowHeaderMenu(false); handleLinkClick(); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300">
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">Account Settings</span>
                      </Link>

                      <Link href="/pricing" role="menuitem"
                        onClick={() => { setShowHeaderMenu(false); handleLinkClick(); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-slate-300">
                        <Crown className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">
                          {planInfo.showUpgrade ? 'Upgrade Plan' : 'Manage Subscription'}
                        </span>
                      </Link>

                      <div className="h-px bg-white/10 my-1" />

                      <button role="menuitem"
                        onClick={() => { setShowHeaderMenu(false); handleLogout(); }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                   hover:bg-red-500/10 transition-colors text-red-400 text-sm disabled:opacity-50">
                        <LogOut className="w-4 h-4" />
                        <span>{isLoggingOut ? 'Logging out…' : 'Sign Out'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 mt-[65px] flex-1" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

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
            background: '#0f172a', border: '1px solid rgba(148,163,184,0.12)',
            borderRadius: '12px', color: '#f1f5f9', fontSize: '13px',
            fontWeight: '500', padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)', gap: '10px',
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