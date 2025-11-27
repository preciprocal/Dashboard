'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
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
  X
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
  const [sortFilter, setSortFilter] = useState<SortOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy');
    }
  };

  const handleDownload = (letter: CoverLetter) => {
    const element = document.createElement('a');
    const file = new Blob([letter.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `cover_letter_${letter.jobRole.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Downloaded!');
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
        loadingText="Loading your cover letters..."
        showNavigation={true}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner text-center p-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-6">Please log in to view your cover letters</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-xl"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clean Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-1">
                Cover Letter Generator
              </h1>
              <p className="text-slate-400 text-sm">
                AI-powered professional cover letters
              </p>
            </div>
            
            <Link
              href="/cover-letter/create"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-4 py-2.5 rounded-lg"
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
          <div className="glass-card-gradient-inner">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 text-sm mb-2">{lettersError}</p>
                <button
                  onClick={() => {
                    setLettersError('');
                    loadCoverLetters();
                  }}
                  className="glass-button hover-lift inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {coverLetters.length > 0 ? (
        <div className="space-y-6">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.totalLetters}</span>
                </div>
                <p className="text-sm text-slate-400">Total Letters</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.averageWordCount}</span>
                </div>
                <p className="text-sm text-slate-400">Avg Word Count</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.companiesApplied}</span>
                </div>
                <p className="text-sm text-slate-400">Companies</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.thisMonth}</span>
                </div>
                <p className="text-sm text-slate-400">This Month</p>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="glass-card">
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Your Cover Letters</h2>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {filteredLetters.length} of {coverLetters.length} letters
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Filter Dropdown */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <select 
                      value={sortFilter} 
                      onChange={(e) => setSortFilter(e.target.value as SortOption)}
                      className="glass-input pl-10 pr-4 py-2.5 rounded-lg text-white text-sm appearance-none cursor-pointer min-w-[200px]"
                    >
                      <option value="all">All ({getFilterCount()})</option>
                      <option value="recent">Recent First</option>
                      <option value="by-company">By Company</option>
                      <option value="by-role">By Role</option>
                    </select>
                  </div>
                  
                  {/* View Toggle */}
                  <div className="flex bg-slate-900/50 rounded-lg p-1">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded transition-all ${
                        viewMode === 'list' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="List view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Cover Letters Grid/List */}
          {filteredLetters.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
                : "space-y-4"
            }>
              {filteredLetters.map((letter, index) => (
                <div
                  key={`letter-${letter.id}-${index}`}
                  className="glass-card hover-lift opacity-0 animate-fadeIn"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-1 line-clamp-1">
                          {letter.jobRole}
                        </h3>
                        {letter.companyName && (
                          <p className="text-slate-400 text-sm flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {letter.companyName}
                          </p>
                        )}
                      </div>
                      <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-purple-400" />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="mb-4">
                      <p className="text-slate-300 text-sm line-clamp-3">
                        {letter.content.substring(0, 150)}...
                      </p>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 mb-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(letter.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {letter.wordCount} words
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs capitalize">
                        {letter.tone}
                      </span>
                      {letter.usedResume && (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs flex items-center gap-1">
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
                        className="flex-1 glass-button hover-lift px-3 py-2 rounded-lg text-white text-sm flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleCopy(letter.content)}
                        className="glass-button hover-lift p-2 rounded-lg"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4 text-slate-300" />
                      </button>
                      <button
                        onClick={() => handleDownload(letter)}
                        className="glass-button hover-lift p-2 rounded-lg"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-slate-300" />
                      </button>
                      <button
                        onClick={() => handleDelete(letter.id)}
                        className="glass-button hover-lift p-2 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* No Results State */
            <div className="glass-card">
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No letters match this filter
                </h3>
                <p className="text-slate-400 mb-6">
                  Try adjusting your filter or generate a new letter
                </p>
                <button
                  onClick={() => setSortFilter('all')}
                  className="text-sm text-slate-300 hover:text-white underline"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !lettersError ? (
        /* Empty State */
        <div className="glass-card">
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            
            <h3 className="text-2xl font-semibold text-white mb-3">
              Welcome to Cover Letter Generator
            </h3>
            <p className="text-slate-400 mb-10 max-w-xl mx-auto">
              Generate professional, personalized cover letters powered by AI. Stand out from the competition.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm text-slate-400">AI-Powered</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-slate-400">Fast Generation</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-400">Professional</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-sm text-slate-400">Customizable</p>
              </div>
            </div>

            <Link
              href="/cover-letter/generate"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Generate First Letter</span>
            </Link>
            
            <p className="text-xs text-slate-500 mt-6">
              Upload your resume for personalized letters
            </p>
          </div>
        </div>
      ) : null}

      {/* Preview Modal */}
      {showPreview && selectedLetter && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-white">{selectedLetter.jobRole}</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {selectedLetter.companyName && (
                <p className="text-slate-400 text-sm">{selectedLetter.companyName}</p>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                {selectedLetter.content}
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => handleCopy(selectedLetter.content)}
                className="flex-1 glass-button hover-lift px-4 py-2.5 rounded-lg text-white flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={() => handleDownload(selectedLetter)}
                className="flex-1 glass-button-primary hover-lift px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
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