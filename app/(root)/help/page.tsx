// app/help/page.tsx
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
  Loader2
} from 'lucide-react';
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
      answer: 'Our AI uses Google Gemini 2.0 to generate realistic interview questions based on your role and experience level. The AI evaluates responses in real-time, providing detailed feedback on technical accuracy, communication, and problem-solving skills.',
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
      category: 'planner',
      question: 'How do I create an effective study plan?',
      answer: 'Navigate to the Planner section and click "Create New Plan". Enter your interview date, target role, and skill level. Our AI generates a personalized day-by-day schedule with curated resources and progress tracking.',
      icon: Target,
      gradient: 'gradient-primary'
    },
    {
      id: 4,
      category: 'general',
      question: 'What are the subscription limits?',
      answer: 'Free users receive 10 interviews and 5 resume analyses per month. Pro users get 50 interviews and 20 analyses. Premium users have unlimited access to all features.',
      icon: Award,
      gradient: 'gradient-warning'
    },
    {
      id: 5,
      category: 'resume',
      question: 'Can I analyze multiple resumes?',
      answer: 'Yes. You can upload and analyze multiple resume versions. This is useful for tailoring your resume to different job applications. Analyses are saved in your dashboard for easy comparison.',
      icon: FileText,
      gradient: 'gradient-secondary'
    },
    {
      id: 6,
      category: 'interviews',
      question: 'What interview types are supported?',
      answer: 'We support Technical (coding, algorithms), Behavioral (STAR method), System Design (architecture), and Mixed interviews. Each type includes relevant questions and evaluation criteria.',
      icon: MessageSquare,
      gradient: 'gradient-accent'
    },
    {
      id: 7,
      category: 'planner',
      question: 'What happens when I complete all tasks?',
      answer: 'Upon completing all tasks, you unlock an AI-generated quiz based on your study material. The quiz provides a final readiness assessment with personalized questions.',
      icon: Award,
      gradient: 'gradient-success'
    }
  ];

  const categories = [
    { value: 'all', label: 'All', icon: BookOpen },
    { value: 'interviews', label: 'Interviews', icon: Video },
    { value: 'resume', label: 'Resume', icon: FileText },
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
          {[
            { id: 'faq' as const, label: 'FAQs', icon: BookOpen },
            { id: 'contact' as const, label: 'Contact', icon: MessageSquare },
            { id: 'tickets' as const, label: 'Tickets', icon: FileText, badge: userTickets.filter(t => t.status !== 'resolved').length }
          ].map((tab) => (
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
              {tab.badge > 0 && (
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

              <div className="flex gap-2">
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