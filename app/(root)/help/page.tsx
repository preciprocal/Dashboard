// app/(root)/help/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/firebase/client';
import {
  collection, addDoc, query, where, orderBy, getDocs,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import {
  Search, MessageSquare, BookOpen, Video, FileText, Send, Mail, Clock,
  CheckCircle2, AlertCircle, HelpCircle, Target, Award, ChevronRight,
  Loader2, Pen, Edit3, Sparkles, PenTool, Shield, Building2, Eye,
  Calendar, TrendingUp, Zap, BarChart3, Users, Globe, Smartphone,
  CreditCard, Lock, Settings as SettingsIcon, Download,
  RefreshCw, ArrowLeft, Home, LogOut
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';

interface SupportTicket {
  id: string; userId: string; userEmail?: string; userName?: string;
  subject: string; message: string; category: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp | null; updatedAt: Timestamp | null;
  lastReplyBy?: 'user' | 'support'; lastReplyAt?: Timestamp | null;
}

interface TicketReply {
  id: string; ticketId: string; message: string; from: 'user' | 'support';
  fromEmail?: string; createdAt: Timestamp; isStaff: boolean;
}

interface CriticalError { code: string; title: string; message: string; details?: string; }

interface TabItem { id: 'faq' | 'contact' | 'tickets'; label: string; icon: LucideIcon; badge?: number; }

interface FAQ {
  id: number; category: string; question: string; answer: string;
  icon: LucideIcon; gradient: string; keywords?: string[];
}

export default function HelpSupportPage() {
  const [user, loading] = useAuthState(auth);
  const searchParams = useSearchParams();
  const [searchQuery,     setSearchQuery]     = useState('');
  const [activeSection,   setActiveSection]   = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [selectedCategory,setSelectedCategory]= useState('all');

  const [subject,       setSubject]       = useState('');
  const [message,       setMessage]       = useState('');
  const [category,      setCategory]      = useState('general');
  const [priority,      setPriority]      = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError,   setSubmitError]   = useState('');

  const [userTickets,   setUserTickets]   = useState<SupportTicket[]>([]);
  const [loadingTickets,setLoadingTickets]= useState(false);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [selectedTicket,setSelectedTicket]= useState<string | null>(null);
  const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
  const [loadingReplies,setLoadingReplies]= useState(false);

  useEffect(() => {
    const q   = searchParams.get('q');
    const cat = searchParams.get('category');
    const sec = searchParams.get('section');
    if (q)   { setSearchQuery(decodeURIComponent(q)); setActiveSection('faq'); }
    if (cat && cat !== 'all') setSelectedCategory(cat);
    if (sec === 'tickets') setActiveSection('tickets');
  }, [searchParams]);

  const faqs: FAQ[] = [
    { id: 1,  category: 'general',       question: 'What is Preciprocal?',                          answer: 'Preciprocal is an AI-powered career preparation platform that helps you ace your job interviews. We offer realistic interview simulations, comprehensive resume analysis with ATS scoring, intelligent cover letter generation with company research, and personalized study planning to maximize your interview readiness.', icon: HelpCircle,   gradient: 'gradient-primary',   keywords: ['about','platform','what is','introduction','overview'] },
    { id: 2,  category: 'general',       question: 'How do I get started?',                         answer: 'Sign up with your email, complete your profile in Settings (add your name, experience level, target role, skills), and optionally upload your resume. Then you can start with interview practice, resume analysis, cover letter generation, or create a study plan. We recommend starting with a resume analysis to understand your baseline.', icon: Target,       gradient: 'gradient-success',   keywords: ['getting started','begin','start','first steps','onboarding','setup'] },
    { id: 3,  category: 'general',       question: 'Do I need to upload my resume to use the platform?', answer: 'While not mandatory, uploading your resume significantly enhances the experience. It enables personalized cover letters that incorporate your actual experience, more accurate recruiter eye simulations, and better-tailored interview questions. You can still use most features without a resume by completing your profile.', icon: FileText,     gradient: 'gradient-accent',    keywords: ['resume upload','required','mandatory','optional'] },
    { id: 4,  category: 'general',       question: 'Is Preciprocal free to use?',                   answer: 'Preciprocal offers a free plan with 10 interview sessions and 5 resume analyses per month. Pro and Premium plans provide expanded limits and additional features like unlimited cover letters, advanced analytics, and priority support.', icon: CreditCard,   gradient: 'gradient-warning',   keywords: ['free','pricing','cost','plans','subscription'] },
    { id: 5,  category: 'interviews',    question: 'How does the AI interview simulation work?',    answer: 'Our platform uses advanced AI technology to create realistic interview experiences. The AI evaluates your responses in real-time, providing detailed feedback on technical accuracy, communication skills, problem-solving approach, and behavioral responses using the STAR method.', icon: Video,        gradient: 'gradient-accent',    keywords: ['interview','AI','simulation','how it works','practice'] },
    { id: 6,  category: 'interviews',    question: 'What interview types are supported?',           answer: 'We support Technical interviews (coding, algorithms, data structures), Behavioral interviews (STAR method, situational questions), System Design interviews (architecture, scalability), and Mixed interviews combining multiple formats. Each type includes relevant questions crafted by experienced recruiters from top tech companies.', icon: MessageSquare, gradient: 'gradient-primary',  keywords: ['interview types','technical','behavioral','system design'] },
    { id: 7,  category: 'interviews',    question: 'Can I practice for specific companies?',        answer: "Yes! When creating an interview, specify your target company. Our AI adapts questions to match that company's known interview style, culture, technical focus areas, and difficulty level based on real interview data collected from industry recruiters at companies like Google, Amazon, Microsoft, and Meta.", icon: Building2,    gradient: 'gradient-accent',    keywords: ['company specific','target company','FAANG','Google','Amazon'] },
    { id: 8,  category: 'interviews',    question: 'How long does each interview session last?',    answer: 'Interview sessions typically last 15-45 minutes depending on the type and difficulty level you select. Technical interviews tend to be longer (30-45 min), while behavioral ones are shorter (15-30 min). You can pause and resume sessions anytime, and all progress is automatically saved.', icon: Clock,        gradient: 'gradient-warning',   keywords: ['duration','time','length','how long'] },
    { id: 9,  category: 'interviews',    question: 'How accurate is the interview feedback?',       answer: 'Our AI evaluation system uses multiple specialized models trained on thousands of real interviews conducted by top recruiters. Feedback includes detailed scoring on technical accuracy, communication clarity, problem-solving approach, and areas for improvement with specific examples.', icon: Target,       gradient: 'gradient-success',   keywords: ['feedback','accuracy','evaluation','scoring','assessment'] },
    { id: 10, category: 'interviews',    question: 'Can I review my past interview performances?',  answer: 'Yes! All your interview sessions are saved in your dashboard with complete transcripts, feedback, scores, and performance metrics. You can compare sessions over time, track improvement trends, identify weak areas, and review specific questions and answers to learn from past experiences.', icon: BarChart3,    gradient: 'gradient-primary',   keywords: ['review','history','past interviews','transcripts','recordings'] },
    { id: 11, category: 'interviews',    question: 'Does the platform support voice-based interviews?', answer: 'Yes! We offer realistic voice-powered interview simulations. You can speak your answers naturally, and the AI interviewer responds with follow-up questions just like a real human interviewer. This helps you practice articulation, pacing, and handling interruptions or follow-ups.', icon: Video,        gradient: 'gradient-accent',    keywords: ['voice','audio','speaking','microphone','verbal'] },
    { id: 12, category: 'interviews',    question: 'What happens if I make a mistake during an interview?', answer: "Don't worry! Mistakes are learning opportunities. The AI provides constructive feedback on errors, explains correct approaches, and offers improvement suggestions. You can pause, restart, or practice the same question again. All sessions are private and used only for your personal development.", icon: RefreshCw,    gradient: 'gradient-warning',   keywords: ['mistakes','errors','wrong answer','redo','retry'] },
    { id: 13, category: 'resume',        question: 'What does the ATS score mean?',                 answer: 'The ATS (Applicant Tracking System) score measures how well your resume performs with automated screening systems used by 98% of Fortune 500 companies. A score above 80% indicates excellent optimization, 70-80% is good, 60-70% needs improvement, and below 60% requires significant changes. We analyze keywords, formatting, structure, and content relevance.', icon: FileText,     gradient: 'gradient-success',   keywords: ['ATS','score','applicant tracking','resume score','optimization'] },
    { id: 14, category: 'resume',        question: 'Can I analyze multiple resumes?',               answer: 'Yes! You can upload and analyze multiple resume versions to compare performance. This is essential for tailoring resumes to different industries, roles, or companies. Each analysis is saved in your dashboard with complete feedback, allowing easy comparison of ATS scores, keyword optimization, and formatting effectiveness.', icon: FileText,     gradient: 'gradient-secondary', keywords: ['multiple resumes','versions','compare','different'] },
    { id: 15, category: 'resume',        question: 'What file formats are supported for resume upload?', answer: 'We currently support PDF files for resume uploads. PDFs are the industry standard format and ensure your formatting remains consistent across all systems and platforms. Maximum file size is 5MB. We recommend using a clean, ATS-friendly template without excessive graphics or unusual fonts.', icon: FileText,     gradient: 'gradient-accent',    keywords: ['file format','PDF','upload','supported formats'] },
    { id: 16, category: 'resume',        question: 'How does the Recruiter Eye Simulation work?',   answer: 'Our AI conducts background research on your target company and role, analyzing the personality, work culture, and preferences of people in similar positions. It then simulates how recruiters from that specific company would review your resume, providing insights on what catches their attention, what they skip, and actionable feedback based on their hiring preferences.', icon: Eye,          gradient: 'gradient-primary',   keywords: ['recruiter eye','simulation','recruiter view','perspective'] },
    { id: 17, category: 'resume',        question: 'Does the AI improve my resume automatically?',  answer: 'The AI provides detailed suggestions and highlights improvement areas, but you maintain full control. The Resume Writer feature can help implement changes with AI-assisted rewriting. You can accept, modify, or reject suggestions. This ensures your resume stays authentic while benefiting from expert-level optimization guidance.', icon: Edit3,        gradient: 'gradient-success',   keywords: ['automatic','AI editing','auto improve','suggestions'] },
    { id: 18, category: 'resume',        question: 'How often should I update my resume analysis?', answer: 'We recommend analyzing your resume after making significant changes or when targeting different industries. Most users maintain 2-3 versions: a general version, and tailored versions for specific roles or companies. Re-analyze quarterly or before major applications to ensure optimal ATS performance and keyword relevance.', icon: TrendingUp,   gradient: 'gradient-accent',    keywords: ['update frequency','how often','when to update'] },
    { id: 19, category: 'resume',        question: 'Can I download my analyzed resume?',            answer: 'Yes! After analysis, you can download your resume with suggested improvements in PDF format. You can also export the detailed analysis report including ATS scores, keyword suggestions, and improvement recommendations.', icon: Download,     gradient: 'gradient-primary',   keywords: ['download','export','save','PDF'] },
    { id: 20, category: 'cover-letter',  question: 'How does the AI Cover Letter Generator work?',  answer: 'Our AI conducts comprehensive real-time background research on the target company, analyzing their latest projects, news articles, press releases, and company culture. It then combines this research with your resume and the job description to craft a highly personalized cover letter that demonstrates genuine interest and relevant company knowledge.', icon: Pen,          gradient: 'gradient-primary',   keywords: ['cover letter','generator','AI writing','how it works'] },
    { id: 21, category: 'cover-letter',  question: 'What information does the AI use to write my cover letter?', answer: 'The AI analyzes three key inputs: (1) Your resume and profile for experience and skills, (2) The job description for required qualifications and responsibilities, and (3) Real-time company research including recent news, projects, culture, values, and industry position. This creates a letter that connects your background to their specific needs.', icon: Sparkles,     gradient: 'gradient-secondary', keywords: ['inputs','data sources','information used','what does it use'] },
    { id: 22, category: 'cover-letter',  question: 'Can I customize the tone of my cover letter?',  answer: 'Yes! You can choose from multiple tone options: Professional (formal and structured), Enthusiastic (energetic and passionate), Formal (traditional corporate), Friendly (warm and personable), or Confident (assertive and direct). The AI adapts the writing style while maintaining the researched company insights and personalization.', icon: PenTool,      gradient: 'gradient-accent',    keywords: ['tone','style','customize','personalize','format'] },
    { id: 23, category: 'cover-letter',  question: 'How long does it take to generate a cover letter?', answer: 'Cover letter generation typically takes 10-30 seconds. The AI performs real-time company research (5-10 sec), analyzes the job description and your resume (3-5 sec), then crafts the personalized letter (5-10 sec). You can immediately save, edit, copy, or download the result in multiple formats.', icon: Zap,          gradient: 'gradient-success',   keywords: ['speed','time','how long','duration','fast'] },
    { id: 24, category: 'cover-letter',  question: 'Does the cover letter use my resume information?', answer: 'Yes! If you have a resume uploaded, the AI automatically incorporates your specific experience, skills, projects, and achievements into the cover letter. This ensures consistency between your application materials and highlights your most relevant qualifications with actual examples and metrics from your resume.', icon: CheckCircle2, gradient: 'gradient-primary',   keywords: ['resume integration','uses resume','consistency'] },
    { id: 25, category: 'cover-letter',  question: 'Can I edit the generated cover letter?',        answer: 'Absolutely! After generation, you can copy the text to edit in your preferred word processor, or use our built-in editor to make changes. The AI provides a strong foundation with company research and proper structure, which you can then personalize further to match your unique voice and style.', icon: Edit3,        gradient: 'gradient-accent',    keywords: ['edit','modify','change','customize'] },
    { id: 26, category: 'cover-letter',  question: 'How many cover letters can I generate?',        answer: 'Free plan users can generate up to 5 cover letters per month. Pro users get 50 per month, and Premium users have unlimited cover letter generation. All generated letters are saved in your dashboard for future reference and editing.', icon: FileText,     gradient: 'gradient-warning',   keywords: ['limit','how many','count','quota'] },
    { id: 27, category: 'planner',       question: 'How do I create an effective study plan?',      answer: 'Navigate to the Planner section and click "Create New Plan". Enter your interview date, target role (e.g., Software Engineer), current skill level (beginner/intermediate/advanced), and daily time commitment. Our AI generates a personalized day-by-day schedule with specific tasks, curated resources, practice problems, and progress tracking.', icon: Target,       gradient: 'gradient-primary',   keywords: ['study plan','create plan','planner','schedule'] },
    { id: 28, category: 'planner',       question: 'Can I customize my study plan?',               answer: 'Yes! While our AI generates an initial plan optimized for your timeline and skill level, you have full control to add, remove, or reorder tasks. You can adjust daily time commitments, set custom deadlines, add your own resources, mark tasks as complete, and the AI will automatically rebalance your schedule to keep you on track.', icon: Calendar,     gradient: 'gradient-accent',    keywords: ['customize','modify','adjust','personalize'] },
    { id: 29, category: 'planner',       question: 'What happens if I miss a day in my plan?',     answer: "No worries! Your plan adapts to your actual pace. Missed tasks automatically roll over to the next available day, and you can adjust deadlines as needed. The AI intelligently re-calculates your daily workload distribution to keep you on track for your target interview date without overwhelming you.", icon: Calendar,     gradient: 'gradient-warning',   keywords: ['miss day','skip','behind schedule','late'] },
    { id: 30, category: 'planner',       question: 'What happens when I complete all tasks?',      answer: 'Upon completing all tasks in your study plan, you unlock an AI-generated personalized quiz based on all your study material and practice areas. This final assessment quiz evaluates your readiness with tailored questions across different difficulty levels, providing a comprehensive readiness score and identifying any remaining weak spots.', icon: Award,        gradient: 'gradient-success',   keywords: ['complete','finish','done','final quiz','assessment'] },
    { id: 33, category: 'subscription',  question: 'What are the subscription plans and limits?',  answer: 'Free Plan: 10 interview sessions and 5 resume analyses per month. Pro Plan: 50 interview sessions, 20 resume analyses, unlimited cover letters, and advanced planner features. Premium Plan: Unlimited access to all features including interviews, resume analyses, cover letters, priority support, and early access to new features.', icon: Award,        gradient: 'gradient-warning',   keywords: ['plans','pricing','limits','subscription','tiers'] },
    { id: 34, category: 'subscription',  question: 'Is there a student discount?',                 answer: "Yes! University students can get significant discounts on Pro and Premium plans. Verify your student status through your university email address (.edu domain) in Settings. The discount is automatically applied upon verification and remains valid while you're enrolled.", icon: Award,        gradient: 'gradient-accent',    keywords: ['student','discount','education','university'] },
    { id: 35, category: 'subscription',  question: 'Can I cancel my subscription anytime?',        answer: "Yes, you can cancel your subscription at any time from the Settings page. You'll retain access to all paid features until the end of your current billing period. After cancellation, your account reverts to the Free plan. All your data, analyses, and interview history remain accessible.", icon: Shield,       gradient: 'gradient-warning',   keywords: ['cancel','unsubscribe','stop','downgrade'] },
    { id: 36, category: 'subscription',  question: 'When do usage limits reset?',                  answer: 'For Free and Pro users, monthly usage limits reset on the same date each month as your subscription start date. For example, if you subscribed on the 15th, your limits reset on the 15th of every month. Premium users have unlimited access to all features.', icon: Calendar,     gradient: 'gradient-primary',   keywords: ['reset','limits','renewal','monthly'] },
    { id: 39, category: 'technical',     question: 'Can I use Preciprocal on mobile devices?',     answer: 'Yes! Preciprocal is fully responsive and works on all devices including smartphones and tablets. However, for the best interview simulation experience (especially voice-based interviews), we strongly recommend using a desktop or laptop with a quality microphone and stable internet connection.', icon: Smartphone,   gradient: 'gradient-secondary', keywords: ['mobile','phone','tablet','responsive','device'] },
    { id: 40, category: 'technical',     question: 'Is my data secure and private?',               answer: 'Absolutely. All data is encrypted in transit and at rest. Your resumes, interview responses, and personal information are never shared with third parties. We use enterprise-grade security, comply with GDPR and CCPA regulations, and conduct regular security audits. You can delete your data anytime.', icon: Lock,         gradient: 'gradient-accent',    keywords: ['security','privacy','safe','encrypted','data protection'] },
    { id: 41, category: 'technical',     question: 'What browsers are supported?',                 answer: 'Preciprocal works best on modern browsers including Google Chrome (recommended), Mozilla Firefox, Microsoft Edge, Safari, and Brave. We recommend using the latest version of your browser for optimal performance and access to all features. Mobile browsers are also supported.', icon: Globe,        gradient: 'gradient-primary',   keywords: ['browser','Chrome','Firefox','Safari','Edge','compatibility'] },
    { id: 42, category: 'technical',     question: 'Do I need a webcam or microphone?',            answer: 'A microphone is required only for voice-based interview simulations. A webcam is optional but can enhance the practice experience. For text-based interviews, resume analysis, cover letter generation, and study planning, neither webcam nor microphone is needed.', icon: Video,        gradient: 'gradient-accent',    keywords: ['webcam','microphone','camera','audio','requirements'] },
    { id: 45, category: 'account',       question: 'How do I update my profile information?',      answer: 'Go to Settings > Profile to update your personal information including name, email, location, target role, experience level, preferred technologies, LinkedIn, GitHub, and career goals. This information helps personalize your interview questions and cover letters.', icon: SettingsIcon, gradient: 'gradient-primary',   keywords: ['profile','update','edit','settings'] },
    { id: 46, category: 'account',       question: 'Can I change my email address?',              answer: "Yes, you can update your email address in Settings > Profile. After changing, you'll receive a verification email to confirm the new address. Your subscription, data, and progress remain intact.", icon: Mail,         gradient: 'gradient-accent',    keywords: ['email','change email','update email'] },
    { id: 47, category: 'account',       question: 'How do I delete my account?',                  answer: 'To delete your account, go to Settings > Account > Delete Account. This permanently removes all your data including interviews, resumes, cover letters, and study plans. This action cannot be undone. If you have an active subscription, it will be automatically canceled.', icon: AlertCircle,  gradient: 'gradient-warning',   keywords: ['delete','remove','close account','deactivate'] },
    { id: 55, category: 'support',       question: 'How do I contact support?',                    answer: 'Contact support through Help & Support > Contact > Submit Ticket. Choose your issue category, set priority, and describe your issue. We respond within 24 hours. You can track your ticket status and view all communication history in the Tickets section.', icon: MessageSquare, gradient: 'gradient-accent',   keywords: ['contact','support','help','customer service'] },
    { id: 56, category: 'support',       question: 'What is your response time for support tickets?', answer: "We aim to respond to all support tickets within 24 hours. High-priority issues are addressed within 12 hours, and critical issues receive immediate attention. Premium users get priority support with faster response times. You'll receive email notifications when we reply.", icon: Clock,        gradient: 'gradient-primary',   keywords: ['response time','support speed','how long','wait time'] },
    { id: 57, category: 'support',       question: 'What is your refund policy?',                  answer: "We offer a 7-day money-back guarantee for new Pro and Premium subscriptions. If you're not satisfied, request a refund within 7 days of purchase. Contact support with your subscription details. Refunds are processed within 5-7 business days.", icon: Shield,       gradient: 'gradient-warning',   keywords: ['refund','money back','return','guarantee'] },
  ];

  const categories = [
    { value: 'all',          label: 'All',          icon: BookOpen      },
    { value: 'general',      label: 'General',      icon: HelpCircle    },
    { value: 'interviews',   label: 'Interviews',   icon: Video         },
    { value: 'resume',       label: 'Resume',       icon: FileText      },
    { value: 'cover-letter', label: 'Cover Letter', icon: Pen           },
    { value: 'planner',      label: 'Planner',      icon: Target        },
    { value: 'subscription', label: 'Subscription', icon: CreditCard    },
    { value: 'technical',    label: 'Technical',    icon: SettingsIcon  },
    { value: 'account',      label: 'Account',      icon: Users         },
    { value: 'support',      label: 'Support',      icon: MessageSquare },
  ];

  const ticketCategories = [
    { value: 'general',   label: 'General Question' },
    { value: 'technical', label: 'Technical Issue'  },
    { value: 'billing',   label: 'Billing'          },
    { value: 'feature',   label: 'Feature Request'  },
    { value: 'bug',       label: 'Bug Report'       },
  ];

  const openTicketsCount = userTickets.filter(t => t.status !== 'resolved').length;
  const tabs: TabItem[] = [
    { id: 'faq',     label: 'FAQs',    icon: BookOpen     },
    { id: 'contact', label: 'Contact', icon: MessageSquare },
    { id: 'tickets', label: 'Tickets', icon: FileText, badge: openTicketsCount },
  ];

  useEffect(() => {
    const loadTickets = async () => {
      if (!user) return;
      try {
        setLoadingTickets(true);
        const ticketsRef = collection(db, 'supportTickets');
        const q = query(ticketsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setUserTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupportTicket[]);
      } catch (error) {
        console.error('Error loading tickets:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (msg.includes('Firebase') || msg.includes('permission')) {
          setCriticalError({ code: 'DATABASE', title: 'Database Connection Error', message: 'Unable to load support tickets', details: msg });
        }
      } finally { setLoadingTickets(false); }
    };
    if (activeSection === 'tickets' && user) loadTickets();
  }, [user, activeSection]);

  const loadTicketReplies = async (ticketId: string) => {
    setLoadingReplies(true);
    try {
      const repliesRef = collection(db, 'supportTickets', ticketId, 'replies');
      const q = query(repliesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      setTicketReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TicketReply[]);
    } catch (error) { console.error('Error loading replies:', error); toast.error('Failed to load conversation'); }
    finally { setLoadingReplies(false); }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setSubmitError('Please log in to submit a ticket'); return; }
    if (!subject.trim() || !message.trim()) { setSubmitError('Please fill in all fields'); return; }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const ticketsRef = collection(db, 'supportTickets');
      const ticketData = {
        userId:    user.uid,
        userEmail: user.email,
        userName:  user.displayName || 'User',
        subject:   subject.trim(),
        message:   message.trim(),
        category,
        priority,
        status:    'open' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(ticketsRef, ticketData);

      try {
        await fetch('/api/firebase/emails', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: docRef.id, ticket: { ...ticketData, userEmail: user.email, userName: user.displayName || 'User' } }),
        });
      } catch (emailError) { console.error('Error sending email:', emailError); }

      await NotificationService.createNotification(
        user.uid,
        'system',
        'Support Ticket Submitted 🎫',
        `Your ticket "${subject.trim()}" has been received. We'll respond within 24 hours. Track it in Help & Support > Tickets.`,
        { actionUrl: '/help?section=tickets', actionLabel: 'View Ticket' }
      );

      setSubmitSuccess(true);
      setSubject('');
      setMessage('');

      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveSection('tickets');
      }, 2000);
    } catch (error) {
      console.error('Error submitting ticket:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('Firebase')) { setCriticalError({ code: 'DATABASE', title: 'Submission Error', message: 'Unable to submit ticket', details: msg }); }
      else { setSubmitError('Failed to submit. Please try again.'); }
    } finally { setIsSubmitting(false); }
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const sl = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(sl) ||
      faq.answer.toLowerCase().includes(sl) ||
      faq.keywords?.some(kw => kw.toLowerCase().includes(sl));
    return matchesCategory && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':    return 'bg-green-500/20 text-green-400';
      case 'in-progress': return 'bg-blue-500/20 text-blue-400';
      default:            return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  if (criticalError) {
    return <ErrorPage errorCode={criticalError.code} errorTitle={criticalError.title} errorMessage={criticalError.message} errorDetails={criticalError.details} onRetry={() => setCriticalError(null)} />;
  }
  if (loading) return <AnimatedLoader isVisible={true} loadingText="Loading help center..." />;

  return (
    <div className="min-h-screen bg-slate-950 py-6 sm:py-8 lg:py-12">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="glass-card animate-fade-in-up">
          <div className="p-4 sm:p-6 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-primary rounded-lg sm:rounded-xl flex items-center justify-center shadow-glass">
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Help & Support</h1>
                <p className="text-xs sm:text-sm text-slate-400">Get answers and assistance</p>
              </div>
            </div>

            {/* ── Conditional: Home (logged in) or Sign In (logged out) ── */}
            {user ? (
              <Link
                href="/"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg glass-morphism border border-white/10 text-slate-300 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all text-xs sm:text-sm font-medium group"
              >
                <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-white transition-colors" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            ) : (
  <Link
    href="/sign-in"
    className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg glass-morphism border border-white/10 text-slate-300 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all text-xs sm:text-sm font-medium group"
  >
    <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180 text-slate-400 group-hover:text-white transition-colors" />
    <span className="hidden sm:inline">Login</span>
  </Link>
)}
          </div>
        </div>

        {/* Tabs */}
        <div className="glass-morphism rounded-xl p-1 sm:p-1.5 animate-fade-in-up">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveSection(tab.id); if (tab.id !== 'tickets') { setSelectedTicket(null); setTicketReplies([]); } }}
                className={`relative flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${activeSection === tab.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glass' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ */}
        {activeSection === 'faq' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
            <div className="glass-card">
              <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search FAQs..."
                    className="glass-input w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 text-sm" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button key={cat.value} onClick={() => setSelectedCategory(cat.value)}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-all ${selectedCategory === cat.value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                      <cat.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2.5 sm:space-y-3">
              {filteredFaqs.map(faq => {
                const Icon = faq.icon;
                return (
                  <div key={faq.id} className="glass-card hover-lift">
                    <div className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 ${faq.gradient} rounded-lg flex items-center justify-center flex-shrink-0 shadow-glass`}>
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-white mb-1.5 sm:mb-2">{faq.question}</h3>
                        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredFaqs.length === 0 && (
                <div className="glass-card">
                  <div className="text-center py-12 sm:py-16 px-4">
                    <Search className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500 mx-auto mb-2 sm:mb-3" />
                    <h3 className="text-sm sm:text-base font-semibold text-white mb-1">No results found</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">Try different search terms</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact */}
        {activeSection === 'contact' && (
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 animate-fade-in-up">
            <div className="glass-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-accent rounded-lg flex items-center justify-center shadow-glass">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">Submit Ticket</h3>
                </div>

                {submitSuccess ? (
                  <div className="glass-morphism p-6 sm:p-8 rounded-xl border border-green-500/30 text-center">
                    <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto mb-2 sm:mb-3" />
                    <h4 className="text-sm sm:text-base font-semibold text-white mb-1">Ticket Submitted</h4>
                    <p className="text-slate-400 text-xs sm:text-sm">We&apos;ll respond via email within 24 hours</p>
                  </div>
                ) : !user ? (
                  /* ── Not logged in — prompt to sign in ── */
                  <div className="glass-morphism p-6 sm:p-8 rounded-xl border border-white/10 text-center space-y-4">
                    <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mx-auto shadow-glass">
                      <LogOut className="w-6 h-6 text-white rotate-180" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold text-white mb-1">Sign in to submit a ticket</h4>
                      <p className="text-slate-400 text-xs sm:text-sm">You need to be logged in to contact support and track your tickets.</p>
                    </div>
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      <LogOut className="w-4 h-4 rotate-180" />
                      Sign In
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTicket} className="space-y-3 sm:space-y-4">
                    {submitError && (
                      <div className="glass-morphism p-2.5 sm:p-3 rounded-lg border border-red-500/30 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-400 text-xs sm:text-sm flex-1">{submitError}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 sm:mb-2">Category</label>
                      <select value={category} onChange={e => setCategory(e.target.value)}
                        className="glass-input w-full px-3 py-2 sm:py-2.5 rounded-lg text-white text-xs sm:text-sm bg-slate-900/50" required>
                        {ticketCategories.map(cat => <option key={cat.value} value={cat.value} className="bg-slate-900 text-white">{cat.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 sm:mb-2">Priority</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map(p => (
                          <button key={p} type="button" onClick={() => setPriority(p)}
                            className={`flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all ${priority === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 sm:mb-2">Subject</label>
                      <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description"
                        className="glass-input w-full px-3 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 text-xs sm:text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 sm:mb-2">Message</label>
                      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue..." rows={4}
                        className="glass-input w-full px-3 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 resize-none glass-scrollbar text-xs sm:text-sm" required />
                    </div>
                    <button type="submit" disabled={isSubmitting}
                      className="w-full glass-button-primary hover-lift px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm">
                      {isSubmitting
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                        : <><Send className="w-4 h-4" />Submit</>}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="glass-card">
                <div className="p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-3 sm:mb-4">Contact Information</h3>
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="glass-morphism p-2.5 sm:p-3 rounded-lg border border-white/5 flex items-center gap-2 sm:gap-3">
                      <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="text-white font-medium text-xs sm:text-sm truncate">support@preciprocal.com</p>
                      </div>
                    </div>
                    <div className="glass-morphism p-2.5 sm:p-3 rounded-lg border border-white/5 flex items-center gap-2 sm:gap-3">
                      <Clock className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Response Time</p>
                        <p className="text-white font-medium text-xs sm:text-sm">Within 24 hours</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="glass-card">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white mb-1">Email Updates</p>
                      <p className="text-xs text-slate-400 leading-relaxed">We&apos;ll send updates about your ticket to your registered email. You can reply directly to our emails to continue the conversation.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tickets */}
        {activeSection === 'tickets' && (
          <div className="space-y-3 sm:space-y-4 animate-fade-in-up">
            {!user ? (
              /* ── Not logged in — prompt to sign in ── */
              <div className="glass-card">
                <div className="text-center py-12 sm:py-16 px-4 space-y-4">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mx-auto shadow-glass">
                    <LogOut className="w-6 h-6 text-white rotate-180" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Sign in to view tickets</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">You need to be logged in to view and manage your support tickets.</p>
                  </div>
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
                  >
                    <LogOut className="w-4 h-4 rotate-180" />
                    Sign In
                  </Link>
                </div>
              </div>
            ) : loadingTickets ? (
              <div className="glass-card">
                <div className="text-center py-12 sm:py-16 px-4">
                  <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-purple-500 animate-spin mx-auto mb-2 sm:mb-3" />
                  <p className="text-slate-400 text-xs sm:text-sm">Loading tickets...</p>
                </div>
              </div>
            ) : selectedTicket ? (
              <div className="space-y-3 sm:space-y-4">
                <button onClick={() => { setSelectedTicket(null); setTicketReplies([]); }}
                  className="glass-button hover-lift inline-flex items-center px-3 py-2 rounded-lg text-sm text-slate-300">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to all tickets
                </button>
                {(() => {
                  const ticket = userTickets.find(t => t.id === selectedTicket);
                  if (!ticket) return null;
                  return (
                    <div className="glass-card">
                      <div className="p-4 sm:p-6 border-b border-white/5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h2 className="text-lg sm:text-xl font-bold text-white">{ticket.subject}</h2>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(ticket.status)}`}>{ticket.status.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                              <span>Ticket #{ticket.id.slice(0, 8)}</span><span>•</span>
                              <span>{ticket.createdAt?.toDate?.().toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="glass-morphism p-4 rounded-lg border border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{ticket.userName?.charAt(0) || 'U'}</span>
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">{ticket.userName || 'You'}</p>
                              <p className="text-slate-500 text-xs">{ticket.createdAt?.toDate?.().toLocaleString()}</p>
                            </div>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed mt-2 whitespace-pre-wrap">{ticket.message}</p>
                        </div>
                      </div>
                      <div className="p-4 sm:p-6 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Conversation</h3>
                        {loadingReplies ? (
                          <div className="text-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto" /></div>
                        ) : ticketReplies.length > 0 ? (
                          <div className="space-y-3">
                            {ticketReplies.map(reply => (
                              <div key={reply.id} className={`glass-morphism p-4 rounded-lg border ${reply.isStaff ? 'border-green-500/20 bg-green-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reply.isStaff ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-purple-600 to-blue-600'}`}>
                                    <span className="text-white text-xs font-bold">{reply.isStaff ? 'S' : 'U'}</span>
                                  </div>
                                  <div>
                                    <p className="text-white font-medium text-sm">{reply.isStaff ? 'Support Team' : 'You'}</p>
                                    <p className="text-slate-500 text-xs">{reply.createdAt?.toDate?.().toLocaleString()}</p>
                                  </div>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-slate-500 text-sm py-4">No replies yet. We&apos;ll respond via email within 24 hours.</p>
                        )}
                        <div className="mt-4 glass-morphism p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                          <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-white mb-1">Reply via Email</p>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {ticket.status === 'resolved'
                                  ? 'This ticket has been resolved. If you need further assistance, please create a new ticket.'
                                  : "We'll send updates to your email. You can reply directly to our emails to continue the conversation, and your replies will appear here automatically."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : userTickets.length > 0 ? (
              <div className="space-y-2.5 sm:space-y-3">
                {userTickets.map(ticket => (
                  <div key={ticket.id} onClick={() => { setSelectedTicket(ticket.id); loadTicketReplies(ticket.id); }}
                    className="glass-card hover-lift cursor-pointer">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 sm:mb-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-semibold text-white line-clamp-1">{ticket.subject}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusBadge(ticket.status)}`}>{ticket.status.toUpperCase()}</span>
                          </div>
                          <p className="text-slate-400 text-xs sm:text-sm mb-1.5 sm:mb-2 line-clamp-2">{ticket.message}</p>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 flex-wrap">
                            <span className="capitalize">{ticket.category}</span><span>•</span>
                            <span>{ticket.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}</span>
                            {ticket.lastReplyAt && (<><span>•</span><span className="text-green-400">Last reply: {ticket.lastReplyAt.toDate?.().toLocaleDateString()}</span></>)}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card">
                <div className="text-center py-12 sm:py-16 px-4">
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500 mx-auto mb-2 sm:mb-3" />
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-1 sm:mb-2">No tickets</h3>
                  <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">You haven&apos;t submitted any tickets yet</p>
                  <button onClick={() => setActiveSection('contact')}
                    className="glass-button-primary hover-lift inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm">
                    <MessageSquare className="w-4 h-4 mr-2" /> Create Ticket
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}