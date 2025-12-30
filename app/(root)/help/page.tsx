// app/(root)/help/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  Search,
  MessageSquare,
  BookOpen,
  Video,
  FileText,
  Send,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Target,
  Award,
  ChevronRight,
  Loader2,
  Pen,
  Edit3,
  Sparkles,
  PenTool,
  Shield,
  Building2,
  Eye,
  Calendar,
  TrendingUp,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';

interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  category: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

interface TabItem {
  id: 'faq' | 'contact' | 'tickets';
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export default function HelpSupportPage() {
  const [user, loading] = useAuthState(auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);

  const faqs = [
    {
      id: 1,
      category: 'interviews',
      question: 'How does the AI interview simulation work?',
      answer: 'Our platform is powered by multi-agentic AI that creates realistic human interview experiences crafted by top industry recruiters. The AI evaluates responses in real-time, providing detailed feedback on technical accuracy, communication, and problem-solving skills.',
      icon: Video,
      gradient: 'gradient-accent'
    },
    {
      id: 2,
      category: 'resume',
      question: 'What does the ATS score mean?',
      answer: 'The ATS score measures how well your resume performs with automated screening systems. A score above 80% indicates good optimization, while scores below 70% suggest improvements are needed for better visibility to recruiters.',
      icon: FileText,
      gradient: 'gradient-success'
    },
    {
      id: 3,
      category: 'cover-letter',
      question: 'How does the AI Cover Letter Generator work?',
      answer: 'Our AI conducts comprehensive background research on the company, analyzing their latest projects, news articles, and company culture. It then crafts a personalized cover letter that aligns with the specific job role and description, incorporating relevant company insights to make your application stand out.',
      icon: Pen,
      gradient: 'gradient-primary'
    },
    {
      id: 4,
      category: 'planner',
      question: 'How do I create an effective study plan?',
      answer: 'Navigate to the Planner section and click "Create New Plan". Enter your interview date, target role, and skill level. Our AI generates a personalized day-by-day schedule with curated resources and progress tracking.',
      icon: Target,
      gradient: 'gradient-primary'
    },
    {
      id: 5,
      category: 'general',
      question: 'What are the subscription limits?',
      answer: 'Free users receive 10 interviews and 5 resume analyses per month. Pro users get 50 interviews and 20 analyses. Premium users have unlimited access to all features.',
      icon: Award,
      gradient: 'gradient-warning'
    },
    {
      id: 6,
      category: 'resume',
      question: 'Can I analyze multiple resumes?',
      answer: 'Yes. You can upload and analyze multiple resume versions. This is useful for tailoring your resume to different job applications. Analyses are saved in your dashboard for easy comparison.',
      icon: FileText,
      gradient: 'gradient-secondary'
    },
    {
      id: 7,
      category: 'interviews',
      question: 'What interview types are supported?',
      answer: 'We support Technical (coding, algorithms), Behavioral (STAR method), System Design (architecture), and Mixed interviews. Each type includes relevant questions and evaluation criteria crafted by experienced recruiters.',
      icon: MessageSquare,
      gradient: 'gradient-accent'
    },
    {
      id: 8,
      category: 'planner',
      question: 'What happens when I complete all tasks?',
      answer: 'Upon completing all tasks, you unlock an AI-generated quiz based on your study material. The quiz provides a final readiness assessment with personalized questions.',
      icon: Award,
      gradient: 'gradient-success'
    },
    {
      id: 9,
      category: 'interviews',
      question: 'How accurate is the interview feedback?',
      answer: 'Our multi-agentic AI system combines multiple evaluation models to provide comprehensive feedback. The system is trained on thousands of real interviews conducted by top recruiters from companies like Google, Amazon, and Microsoft.',
      icon: Target,
      gradient: 'gradient-primary'
    },
    {
      id: 10,
      category: 'resume',
      question: 'Does the AI improve my resume automatically?',
      answer: 'While our AI provides detailed suggestions and improvement areas, the Resume Writer feature can help you implement changes. You maintain full control over your resume content while getting expert-level guidance.',
      icon: Edit3,
      gradient: 'gradient-accent'
    },
    {
      id: 11,
      category: 'cover-letter',
      question: 'What information does the AI use to write my cover letter?',
      answer: 'The AI analyzes your resume, the job description, and conducts real-time research on the company including recent news, projects, values, and culture. This creates a highly personalized letter that demonstrates genuine interest and company knowledge.',
      icon: Sparkles,
      gradient: 'gradient-secondary'
    },
    {
      id: 12,
      category: 'general',
      question: 'Can I use Preciprocal on mobile devices?',
      answer: 'Yes! Preciprocal is fully responsive and works on all devices. However, for the best interview simulation experience, we recommend using a desktop or laptop with a webcam and microphone.',
      icon: HelpCircle,
      gradient: 'gradient-secondary'
    },
    {
      id: 13,
      category: 'interviews',
      question: 'How long does each interview session last?',
      answer: 'Interview sessions typically last 15-45 minutes depending on the type and difficulty level you select. You can pause and resume sessions at any time, and all progress is automatically saved.',
      icon: Clock,
      gradient: 'gradient-warning'
    },
    {
      id: 14,
      category: 'planner',
      question: 'Can I customize my study plan?',
      answer: 'Absolutely! While our AI generates an initial plan based on your interview date and skill level, you can add, remove, or reorder tasks. You can also set custom daily time commitments and mark tasks as complete.',
      icon: Target,
      gradient: 'gradient-primary'
    },
    {
      id: 15,
      category: 'resume',
      question: 'What file formats are supported for resume upload?',
      answer: 'We currently support PDF files for resume uploads. PDFs are industry standard and ensure your formatting remains consistent across all systems. Maximum file size is 5MB.',
      icon: FileText,
      gradient: 'gradient-success'
    },
    {
      id: 16,
      category: 'cover-letter',
      question: 'Can I customize the tone of my cover letter?',
      answer: 'Yes! You can choose from multiple tone options: Professional, Enthusiastic, Formal, Friendly, or Confident. The AI adapts the writing style while maintaining the researched company insights and personalization.',
      icon: PenTool,
      gradient: 'gradient-accent'
    },
    {
      id: 17,
      category: 'general',
      question: 'Is my data secure and private?',
      answer: 'Yes. All data is encrypted in transit and at rest. Your resumes and interview responses are never shared with third parties. We use enterprise-grade Firebase security and comply with GDPR and CCPA regulations.',
      icon: Shield,
      gradient: 'gradient-accent'
    },
    {
      id: 18,
      category: 'interviews',
      question: 'Can I practice for specific companies?',
      answer: 'Yes! When creating an interview, you can specify your target company. Our AI adapts questions to match that company\'s known interview style, culture, and technical focus areas based on real interview data from industry recruiters.',
      icon: Building2,
      gradient: 'gradient-primary'
    },
    {
      id: 19,
      category: 'resume',
      question: 'How does the Recruiter Eye Simulation work?',
      answer: 'Our AI conducts background research on the target company and role, analyzing the personality and work culture of people in similar positions. It then simulates how recruiters from that specific company would review your resume, providing insights on what catches their attention and generates actionable feedback based on their preferences.',
      icon: Eye,
      gradient: 'gradient-secondary'
    },
    {
      id: 20,
      category: 'planner',
      question: 'What happens if I miss a day in my plan?',
      answer: 'No worries! Your plan adapts to your pace. Missed tasks automatically roll over, and you can adjust deadlines as needed. The AI re-calculates your daily workload to keep you on track for your interview date.',
      icon: Calendar,
      gradient: 'gradient-warning'
    },
    {
      id: 21,
      category: 'cover-letter',
      question: 'How long does it take to generate a cover letter?',
      answer: 'Cover letter generation typically takes 10-30 seconds. The AI performs real-time company research, analyzes the job description, and crafts a personalized letter. You can save, edit, and download the result in PDF or Word format.',
      icon: Zap,
      gradient: 'gradient-success'
    },
    {
      id: 22,
      category: 'general',
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time from the Settings page. You\'ll retain access to paid features until the end of your current billing period, and all your data remains accessible.',
      icon: Award,
      gradient: 'gradient-accent'
    },
    {
      id: 23,
      category: 'interviews',
      question: 'What makes Preciprocal different from other platforms?',
      answer: 'We combine multi-agentic AI with real recruiter expertise, personalized study planning, comprehensive resume analysis, and intelligent cover letter generation. Our platform adapts to your specific needs and provides actionable feedback, not just generic tips.',
      icon: Sparkles,
      gradient: 'gradient-primary'
    },
    {
      id: 24,
      category: 'resume',
      question: 'How often should I update my resume analysis?',
      answer: 'We recommend analyzing your resume after making significant changes or when applying to different industries. Most users analyze 2-3 versions: a general version, and tailored versions for specific roles or companies.',
      icon: TrendingUp,
      gradient: 'gradient-success'
    },
    {
      id: 25,
      category: 'cover-letter',
      question: 'Does the cover letter use my resume information?',
      answer: 'Yes! If you have a resume uploaded, the AI automatically incorporates your experience, skills, and achievements into the cover letter. This ensures consistency between your application materials and highlights your most relevant qualifications.',
      icon: CheckCircle2,
      gradient: 'gradient-primary'
    }
  ];

  const categories = [
    { value: 'all', label: 'All', icon: BookOpen },
    { value: 'interviews', label: 'Interviews', icon: Video },
    { value: 'resume', label: 'Resume', icon: FileText },
    { value: 'cover-letter', label: 'Cover Letter', icon: Pen },
    { value: 'planner', label: 'Planner', icon: Target },
    { value: 'general', label: 'General', icon: HelpCircle }
  ];

  const ticketCategories = [
    { value: 'general', label: 'General Question' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'billing', label: 'Billing' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'bug', label: 'Bug Report' }
  ];

  const openTicketsCount = userTickets.filter(t => t.status !== 'resolved').length;

  const tabs: TabItem[] = [
    { id: 'faq', label: 'FAQs', icon: BookOpen },
    { id: 'contact', label: 'Contact', icon: MessageSquare },
    { id: 'tickets', label: 'Tickets', icon: FileText, badge: openTicketsCount }
  ];

  useEffect(() => {
    const loadTickets = async () => {
      if (!user) return;
      
      try {
        setLoadingTickets(true);
        const ticketsRef = collection(db, 'supportTickets');
        const q = query(
          ticketsRef,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SupportTicket[];
        
        setUserTickets(tickets);
      } catch (error) {
        console.error('Error loading tickets:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Firebase') || errorMessage.includes('permission')) {
          setCriticalError({
            code: 'DATABASE',
            title: 'Database Connection Error',
            message: 'Unable to load support tickets',
            details: errorMessage
          });
        }
      } finally {
        setLoadingTickets(false);
      }
    };

    if (activeSection === 'tickets' && user) {
      loadTickets();
    }
  }, [user, activeSection]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setSubmitError('Please log in to submit a ticket');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setSubmitError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      const ticketsRef = collection(db, 'supportTickets');
      await addDoc(ticketsRef, {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'User',
        subject: subject.trim(),
        message: message.trim(),
        category,
        priority,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSubmitSuccess(true);
      setSubject('');
      setMessage('');
      
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveSection('tickets');
      }, 2000);
    } catch (error) {
      console.error('Error submitting ticket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Firebase')) {
        setCriticalError({
          code: 'DATABASE',
          title: 'Submission Error',
          message: 'Unable to submit ticket',
          details: errorMessage
        });
      } else {
        setSubmitError('Failed to submit. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        onRetry={() => setCriticalError(null)}
      />
    );
  }

  if (loading) {
    return <AnimatedLoader isVisible={true} loadingText="Loading help center..." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Minimal Header */}
      <div className="glass-card animate-fade-in-up">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glass">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Help & Support</h1>
              <p className="text-sm text-slate-400">Get answers and assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Tabs */}
      <div className="glass-morphism rounded-xl p-1.5 animate-fade-in-up">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeSection === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glass'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      {activeSection === 'faq' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Search & Filter */}
          <div className="glass-card">
            <div className="p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-white placeholder-slate-500 text-sm"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCategory === cat.value
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const Icon = faq.icon;
              return (
                <div key={faq.id} className="glass-card hover-lift">
                  <div className="p-5 flex items-start gap-4">
                    <div className={`w-10 h-10 ${faq.gradient} rounded-lg flex items-center justify-center flex-shrink-0 shadow-glass`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white mb-2">
                        {faq.question}
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredFaqs.length === 0 && (
              <div className="glass-card">
                <div className="text-center py-16">
                  <Search className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-white mb-1">No results found</h3>
                  <p className="text-slate-400 text-sm">Try different search terms</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contact Section */}
      {activeSection === 'contact' && (
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in-up">
          {/* Contact Form */}
          <div className="glass-card">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 gradient-accent rounded-lg flex items-center justify-center shadow-glass">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Submit Ticket</h3>
              </div>

              {submitSuccess ? (
                <div className="glass-morphism p-8 rounded-xl border border-green-500/30 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h4 className="text-base font-semibold text-white mb-1">Ticket Submitted</h4>
                  <p className="text-slate-400 text-sm">We&apos;ll respond within 24 hours</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  {submitError && (
                    <div className="glass-morphism p-3 rounded-lg border border-red-500/30 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm flex-1">{submitError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="glass-input w-full px-3 py-2.5 rounded-lg text-white text-sm"
                      required
                    >
                      {ticketCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Priority</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            priority === p
                              ? 'bg-white/10 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief description"
                      className="glass-input w-full px-3 py-2.5 rounded-lg text-white placeholder-slate-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue..."
                      rows={5}
                      className="glass-input w-full px-3 py-2.5 rounded-lg text-white placeholder-slate-500 resize-none glass-scrollbar text-sm"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !user}
                    className="w-full glass-button-primary hover-lift px-5 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <div className="glass-card">
              <div className="p-6">
                <h3 className="text-base font-semibold text-white mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="glass-morphism p-3 rounded-lg border border-white/5 flex items-center gap-3">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="text-white font-medium text-sm">support@preciprocal.com</p>
                    </div>
                  </div>

                  <div className="glass-morphism p-3 rounded-lg border border-white/5 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-xs text-slate-500">Response Time</p>
                      <p className="text-white font-medium text-sm">Within 24 hours</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-6">
                <h3 className="text-base font-semibold text-white mb-4">Resources</h3>
                <div className="space-y-2">
                  <a href="/docs" className="glass-morphism p-3 rounded-lg hover-lift border border-white/5 flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-400" />
                      <span className="text-white text-sm">Documentation</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </a>
                  
                  <a href="/tutorials" className="glass-morphism p-3 rounded-lg hover-lift border border-white/5 flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-400" />
                      <span className="text-white text-sm">Video Guides</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tickets Section */}
      {activeSection === 'tickets' && (
        <div className="space-y-4 animate-fade-in-up">
          {loadingTickets ? (
            <div className="glass-card">
              <div className="text-center py-16">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading tickets...</p>
              </div>
            </div>
          ) : userTickets.length > 0 ? (
            <div className="space-y-3">
              {userTickets.map((ticket) => (
                <div key={ticket.id} className="glass-card hover-lift">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-base font-semibold text-white">{ticket.subject}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                            ticket.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mb-2 line-clamp-2">{ticket.message}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{ticket.category}</span>
                          <span>•</span>
                          <span>{ticket.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}</span>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        ticket.priority === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {ticket.priority}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card">
              <div className="text-center py-16">
                <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white mb-2">No tickets</h3>
                <p className="text-slate-400 text-sm mb-4">You haven&apos;t submitted any tickets yet</p>
                <button
                  onClick={() => setActiveSection('contact')}
                  className="glass-button-primary hover-lift inline-flex items-center px-5 py-2.5 rounded-lg font-medium text-sm"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Create Ticket
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}