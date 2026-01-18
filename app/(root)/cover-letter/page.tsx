'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { toast } from 'sonner';
import { 
  FileText, 
  Sparkles, 
  Zap, 
  LayoutGrid, 
  List, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Plus,
  Copy,
  Download,
  Trash2,
  Eye,
  Building2,
  Calendar,
  TrendingUp,
  X,
  FileDown,
  ChevronDown
} from 'lucide-react';

type SortOption = 'all' | 'recent' | 'by-company' | 'by-role';
type ViewMode = 'grid' | 'list';

interface CoverLetter {
  id: string;
  userId: string;
  jobRole: string;
  companyName?: string;
  tone: string;
  content: string;
  wordCount: number;
  createdAt: Date;
  usedResume?: boolean;
}

interface CoverLetterStats {
  totalLetters: number;
  averageWordCount: number;
  companiesApplied: number;
  thisMonth: number;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

export default function CoverLetterDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loadingLetters, setLoadingLetters] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sortFilter, setSortFilter] = useState<SortOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [stats, setStats] = useState<CoverLetterStats>({
    totalLetters: 0,
    averageWordCount: 0,
    companiesApplied: 0,
    thisMonth: 0
  });

  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [lettersError, setLettersError] = useState<string>('');
  const [selectedLetter, setSelectedLetter] = useState<CoverLetter | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<string | null>(null);

  // Helper function to convert markdown links to HTML
  const convertMarkdownLinks = (text: string): string => {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (showDownloadMenu && !target.closest('.download-dropdown-menu') && !target.closest('.download-button')) {
        setShowDownloadMenu(null);
      }
      
      if (showFilterMenu && !target.closest('.filter-dropdown')) {
        setShowFilterMenu(false);
      }
    };

    if (showDownloadMenu || showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu, showFilterMenu]);

  // Define loading steps
  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Connecting to database...', weight: 1 },
    { name: 'Loading cover letters...', weight: 3 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Organizing content...', weight: 1 },
    { name: 'Finalizing dashboard...', weight: 1 }
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [loading, user, router]);

  const loadCoverLetters = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoadingLetters(true);
      setLettersError('');
      setLoadingStep(0);

      setLoadingStep(1);
      await new Promise(resolve => setTimeout(resolve, 200));

      setLoadingStep(2);
      const lettersQuery = query(
        collection(db, 'coverLetters'),
        where('userId', '==', user.uid)
      );
      
      const snapshot = await getDocs(lettersQuery);
      let letters = snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
        createdAt: docSnapshot.data().createdAt?.toDate() || new Date(),
      })) as CoverLetter[];

      letters = letters.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setCoverLetters(letters);
      
      setLoadingStep(3);
      if (letters.length > 0) {
        const avgWords = Math.round(
          letters.reduce((sum, letter) => sum + (letter.wordCount || 0), 0) / letters.length
        );
        
        const uniqueCompanies = new Set(
          letters.filter(l => l.companyName).map(l => l.companyName)
        ).size;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthCount = letters.filter(letter => {
          const letterDate = new Date(letter.createdAt);
          return letterDate.getMonth() === currentMonth && letterDate.getFullYear() === currentYear;
        }).length;
        
        setStats({
          totalLetters: letters.length,
          averageWordCount: avgWords,
          companiesApplied: uniqueCompanies,
          thisMonth: thisMonthCount
        });
      }

      setLoadingStep(4);
      await new Promise(resolve => setTimeout(resolve, 150));

      setLoadingStep(5);
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (err: unknown) {
      console.error('Error loading cover letters:', err);
      const error = err as Error;
      
      if (error.message.includes('Firebase') || error.message.includes('firestore')) {
        setCriticalError({
          code: 'DATABASE',
          title: 'Database Connection Error',
          message: 'Unable to load your cover letters. Please check your internet connection.',
          details: error.message
        });
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        setCriticalError({
          code: 'NETWORK',
          title: 'Network Error',
          message: 'Unable to connect to the server. Please check your internet connection.',
          details: error.message
        });
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        setLettersError('You do not have permission to view cover letters. Please contact support.');
      } else {
        setLettersError('Failed to load cover letters. Please try again.');
      }
    } finally {
      setLoadingLetters(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCoverLetters();
    }
  }, [user, loadCoverLetters]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setLettersError('');
    if (user) {
      loadCoverLetters();
    }
  };

  const handleDelete = async (letterId: string) => {
    if (!confirm('Are you sure you want to delete this cover letter?')) return;
    
    try {
      await deleteDoc(doc(db, 'coverLetters', letterId));
      setCoverLetters(prev => prev.filter(l => l.id !== letterId));
      toast.success('Cover letter deleted');
      
      const updatedLetters = coverLetters.filter(l => l.id !== letterId);
      if (updatedLetters.length > 0) {
        const avgWords = Math.round(
          updatedLetters.reduce((sum, letter) => sum + (letter.wordCount || 0), 0) / updatedLetters.length
        );
        const uniqueCompanies = new Set(
          updatedLetters.filter(l => l.companyName).map(l => l.companyName)
        ).size;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthCount = updatedLetters.filter(letter => {
          const letterDate = new Date(letter.createdAt);
          return letterDate.getMonth() === currentMonth && letterDate.getFullYear() === currentYear;
        }).length;
        
        setStats({
          totalLetters: updatedLetters.length,
          averageWordCount: avgWords,
          companiesApplied: uniqueCompanies,
          thisMonth: thisMonthCount
        });
      } else {
        setStats({
          totalLetters: 0,
          averageWordCount: 0,
          companiesApplied: 0,
          thisMonth: 0
        });
      }
    } catch (error) {
      console.error('Error deleting cover letter:', error);
      toast.error('Failed to delete cover letter');
    }
  };

  const handleCopy = async (content: string) => {
    try {
      const plainText = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');
      await navigator.clipboard.writeText(plainText);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy');
    }
  };

  const handleDownloadPDF = async (letter: CoverLetter): Promise<void> => {
    try {
      const response = await fetch('/api/cover-letter/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: letter.content,
          jobRole: letter.jobRole,
          companyName: letter.companyName,
          format: 'pdf'
        })
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'cover-letter.pdf';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      window.open(url, '_blank');
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      toast.success('PDF downloaded and opened!');
      setShowDownloadMenu(null);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleDownloadWord = async (letter: CoverLetter): Promise<void> => {
    try {
      const response = await fetch('/api/cover-letter/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: letter.content,
          jobRole: letter.jobRole,
          companyName: letter.companyName,
          format: 'docx'
        })
      });

      if (!response.ok) {
        throw new Error('Word document generation failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'cover-letter.docx';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      window.open(url, '_blank');
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      toast.success('Word document downloaded and opened!');
      setShowDownloadMenu(null);
    } catch (error) {
      console.error('Failed to generate Word document:', error);
      toast.error('Failed to generate Word document');
    }
  };

  const filteredLetters = useMemo(() => {
    const filtered = [...coverLetters];

    switch (sortFilter) {
      case 'recent':
        return filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'by-company':
        return filtered.sort((a, b) => 
          (a.companyName || '').localeCompare(b.companyName || '')
        );
      case 'by-role':
        return filtered.sort((a, b) => 
          a.jobRole.localeCompare(b.jobRole)
        );
      case 'all':
      default:
        return filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }, [coverLetters, sortFilter]);

  const getFilterCount = (): number => {
    return coverLetters.length;
  };

  const getFilterLabel = (option: SortOption): string => {
    switch (option) {
      case 'all':
        return `All (${getFilterCount()})`;
      case 'recent':
        return 'Recent First';
      case 'by-company':
        return 'By Company';
      case 'by-role':
        return 'By Role';
      default:
        return 'All';
    }
  };

  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        showBackButton={true}
        showHomeButton={true}
        showRefreshButton={true}
        onRetry={handleRetryError}
      />
    );
  }

  if (loading || loadingLetters) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your cover letters..."
        showNavigation={true}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card-gradient hover-lift w-full max-w-md">
          <div className="glass-card-gradient-inner text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">Please log in to view your cover letters</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Clean Header */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Cover Letter Generator
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                AI-powered professional cover letters
              </p>
            </div>
            
            <Link
              href="/cover-letter/create"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Generate New</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {lettersError && (
        <div className="glass-card-gradient hover-lift animate-fade-in-up">
          <div className="glass-card-gradient-inner p-4 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-400 text-xs sm:text-sm mb-2">{lettersError}</p>
                <button
                  onClick={() => {
                    setLettersError('');
                    loadCoverLetters();
                  }}
                  className="glass-button hover-lift inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-white text-xs sm:text-sm font-medium rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {coverLetters.length > 0 ? (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Stats Cards - Responsive Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.totalLetters}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Total Letters</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.averageWordCount}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Avg Word Count</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.companiesApplied}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Companies</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.thisMonth}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">This Month</p>
              </div>
            </div>
          </div>

          {/* Controls Bar - Responsive */}
          <div className="glass-card">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Your Cover Letters</h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    {filteredLetters.length} of {coverLetters.length} letters
                  </p>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Filter Dropdown - Custom Styled */}
                  <div className="relative filter-dropdown flex-1 sm:flex-initial sm:min-w-[180px]">
                    <button
                      type="button"
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className="glass-input w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                        <span>{getFilterLabel(sortFilter)}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showFilterMenu && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('all');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'all' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          All ({getFilterCount()})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('recent');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'recent' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          Recent First
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('by-company');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'by-company' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          By Company
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('by-role');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'by-role' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          By Role
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* View Toggle */}
                  <div className="flex bg-slate-900/50 rounded-lg p-1">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 sm:p-2 rounded transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 sm:p-2 rounded transition-all ${
                        viewMode === 'list' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="List view"
                    >
                      <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Cover Letters Grid/List - Responsive */}
          {filteredLetters.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6" 
                : "space-y-3 sm:space-y-4"
            }>
              {filteredLetters.map((letter, index) => (
                <div
                  key={`letter-${letter.id}-${index}`}
                  className="glass-card hover-lift opacity-0 animate-fadeIn relative"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="p-4 sm:p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-white font-semibold mb-1 line-clamp-1 text-sm sm:text-base">
                          {letter.jobRole}
                        </h3>
                        {letter.companyName && (
                          <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-1">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{letter.companyName}</span>
                          </p>
                        )}
                      </div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="mb-3 sm:mb-4">
                      <div 
                        className="text-slate-300 text-xs sm:text-sm line-clamp-3"
                        dangerouslySetInnerHTML={{ 
                          __html: convertMarkdownLinks(letter.content.substring(0, 150) + '...') 
                        }}
                      />
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>{new Date(letter.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span>{letter.wordCount} words</span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                      <span className="px-2 py-0.5 sm:py-1 bg-blue-500/10 text-blue-400 rounded text-xs capitalize">
                        {letter.tone}
                      </span>
                      {letter.usedResume && (
                        <span className="px-2 py-0.5 sm:py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Resume
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedLetter(letter);
                          setShowPreview(true);
                        }}
                        className="flex-1 glass-button hover-lift px-3 py-1.5 sm:py-2 rounded-lg text-white text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
                      >
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleCopy(letter.content)}
                        className="glass-button hover-lift p-1.5 sm:p-2 rounded-lg"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
                      </button>
                      
                      {/* Download Dropdown */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDownloadMenu(showDownloadMenu === letter.id ? null : letter.id);
                          }}
                          className="glass-button hover-lift p-1.5 sm:p-2 rounded-lg download-button"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
                        </button>
                        
                        {showDownloadMenu === letter.id && (
                          <div className="absolute right-0 bottom-full mb-2 w-44 sm:w-48 glass-card rounded-lg shadow-xl z-[101] overflow-hidden download-dropdown-menu">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(letter);
                              }}
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-white hover:bg-white/5 flex items-center gap-2 sm:gap-3 transition-colors"
                            >
                              <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                              <span>Download as PDF</span>
                            </button>
                            <div className="h-px bg-white/10" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadWord(letter);
                              }}
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-white hover:bg-white/5 flex items-center gap-2 sm:gap-3 transition-colors"
                            >
                              <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                              <span>Download as Word</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => handleDelete(letter.id)}
                        className="glass-button hover-lift p-1.5 sm:p-2 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* No Results State */
            <div className="glass-card">
              <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  No letters match this filter
                </h3>
                <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">
                  Try adjusting your filter or generate a new letter
                </p>
                <button
                  onClick={() => setSortFilter('all')}
                  className="text-xs sm:text-sm text-slate-300 hover:text-white underline"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !lettersError ? (
        /* Empty State - Responsive */
        <div className="glass-card">
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-6 sm:mb-8">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 sm:mb-3">
              Welcome to Cover Letter Generator
            </h3>
            <p className="text-slate-400 mb-8 sm:mb-10 max-w-xl mx-auto text-sm sm:text-base">
              Generate professional, personalized cover letters powered by AI. Stand out from the competition.
            </p>

            {/* Feature Grid - Responsive */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">AI-Powered</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Fast Generation</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Professional</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Customizable</p>
              </div>
            </div>

            <Link
              href="/cover-letter/create"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Generate First Letter</span>
            </Link>
            
            <p className="text-xs text-slate-500 mt-4 sm:mt-6">
              Upload your resume for personalized letters
            </p>
          </div>
        </div>
      ) : null}

      {/* Preview Modal - Responsive */}
      {showPreview && selectedLetter && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPreview(false);
            }
          }}
        >
          <div className="glass-card max-w-3xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg sm:text-xl font-semibold text-white truncate pr-4">{selectedLetter.jobRole}</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {selectedLetter.companyName && (
                <p className="text-slate-400 text-sm truncate">{selectedLetter.companyName}</p>
              )}
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[50vh] sm:max-h-[60vh]">
              <div 
                className="text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: convertMarkdownLinks(selectedLetter.content) }}
              />
            </div>

            <div className="p-4 sm:p-6 border-t border-white/10 flex gap-2 sm:gap-3">
              <button
                onClick={() => handleCopy(selectedLetter.content)}
                className="flex-1 glass-button hover-lift px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Copy</span>
              </button>
              
              {/* Download Dropdown in Modal */}
              <div className="flex-1 relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDownloadMenu(showDownloadMenu === 'modal' ? null : 'modal');
                  }}
                  className="w-full glass-button-primary hover-lift px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 download-button text-xs sm:text-sm"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Download</span>
                </button>
                
                {showDownloadMenu === 'modal' && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 glass-card rounded-lg shadow-xl z-[101] overflow-hidden download-dropdown-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPDF(selectedLetter);
                      }}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-white hover:bg-white/5 flex items-center gap-2 sm:gap-3 transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                      <span>Download as PDF</span>
                    </button>
                    <div className="h-px bg-white/10" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadWord(selectedLetter);
                      }}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-white hover:bg-white/5 flex items-center gap-2 sm:gap-3 transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                      <span>Download as Word</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}