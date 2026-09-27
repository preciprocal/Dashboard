// app/(root)/help/page.tsx
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  Search, MessageSquare, BookOpen, Video, FileText, Send, Mail, Clock,
  CheckCircle2, AlertCircle, HelpCircle, Target, Award, ChevronRight,
  Loader2, Pen, Edit3, Sparkles, PenTool, Shield, Building2, Eye,
  Calendar, TrendingUp, Zap, BarChart3, Users, Globe, Smartphone,
  CreditCard, Lock, Settings as SettingsIcon, Download,
  RefreshCw, ArrowLeft, ArrowRight, Home, LogOut, Paperclip, X, Image as ImageIcon, File,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { formatDistanceToNow } from 'date-fns';
import { hasUnreadSupportReply } from '@/lib/support/unread';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { USAGE_LIMITS } from '@/lib/config/usage-limits';
import { PLAN_PRICE_CENTS } from '@/lib/config/plan-prices';
import { SITE } from '@/lib/seo';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttachmentMeta { name: string; url: string; size: number; type: string; }

interface SupportTicket {
  id: string; userId: string; userEmail?: string; userName?: string;
  subject: string; message: string; category: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string | null; updatedAt: string | null;
  lastReplyBy?: 'user' | 'support'; lastReplyAt?: string | null;
  userLastReadAt?: string | null;
  /** Maintained by sync_ticket_on_reply (migration 0036), never by a client. */
  replyCount?: number;
  attachments?: AttachmentMeta[];
}

interface TicketReply {
  id: string; ticketId: string; message: string; from: 'user' | 'support';
  fromEmail?: string; createdAt: string; isStaff: boolean;
}

interface SupportTicketRow {
  id: string; user_id: string; user_email: string | null; user_name: string | null;
  subject: string | null; message: string | null; category: string | null;
  status: string; priority: string | null;
  created_at: string; updated_at: string;
  last_reply_by: string | null; last_reply_at: string | null;
  user_last_read_at: string | null;
  reply_count: number | null;
  attachments: AttachmentMeta[] | null;
}

function toSupportTicket(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email ?? undefined,
    userName: row.user_name ?? undefined,
    subject: row.subject ?? '',
    message: row.message ?? '',
    category: row.category ?? 'general',
    status: (row.status as SupportTicket['status']) ?? 'open',
    priority: (row.priority as SupportTicket['priority']) ?? 'medium',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastReplyBy: (row.last_reply_by as SupportTicket['lastReplyBy']) ?? undefined,
    lastReplyAt: row.last_reply_at,
    userLastReadAt: row.user_last_read_at,
    replyCount: row.reply_count ?? 0,
    attachments: row.attachments ?? undefined,
  };
}

interface TicketReplyRow {
  id: string; ticket_id: string; body: string; author_user_id: string | null;
  from_email: string | null; is_staff: boolean; created_at: string;
}

function toTicketReply(row: TicketReplyRow): TicketReply {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    message: row.body,
    from: row.is_staff ? 'support' : 'user',
    fromEmail: row.from_email ?? undefined,
    createdAt: row.created_at,
    isStaff: row.is_staff,
  };
}

// ─── Ticket presentation helpers ──────────────────────────────────────────────

/**
 * Status as a dot plus a word, rather than a filled uppercase pill.
 *
 * 'resolved' is included because the 0036 trigger can set it even though the
 * SupportTicket union predates that; the fallback keeps an unknown status
 * rendering as something rather than blank.
 */
function statusMeta(status: string): { label: string; dot: string; text: string } {
  switch (status) {
    case 'open':        return { label: 'Open',        dot: 'bg-emerald-400', text: 'text-emerald-300/90' };
    case 'in-progress': return { label: 'In progress', dot: 'bg-amber-400',   text: 'text-amber-300/90'   };
    case 'resolved':    return { label: 'Resolved',    dot: 'bg-slate-500',   text: 'text-slate-400'      };
    case 'closed':      return { label: 'Closed',      dot: 'bg-slate-600',   text: 'text-slate-500'      };
    default:            return { label: status,        dot: 'bg-slate-500',   text: 'text-slate-400'      };
  }
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

/** One turn in the thread. Same shape for the opening message and every reply. */
function Message({
  author, at, body, isStaff = false, attachments, onOpenAttachment,
}: {
  author: string;
  at: string | null;
  body: string;
  isStaff?: boolean;
  attachments?: AttachmentMeta[];
  onOpenAttachment?: (a: AttachmentMeta) => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`text-sm font-semibold ${isStaff ? 'text-purple-300' : 'text-slate-300'}`}>{author}</span>
        <span className="text-xs text-slate-600">{at ? new Date(at).toLocaleString() : ''}</span>
      </div>
      <p className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap">{body}</p>
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {attachments.map((att, i) => (
            <button key={i} type="button" onClick={() => onOpenAttachment?.(att)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                         bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.16]
                         text-sm text-slate-400 hover:text-slate-200 transition-colors">
              <FileTypeIcon type={att.type} />
              <span className="truncate max-w-[160px]">{att.name}</span>
              <span className="text-slate-600">{formatBytes(att.size)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CriticalError { code: string; title: string; message: string; details?: string; }
interface TabItem { id: 'faq' | 'contact' | 'tickets'; label: string; icon: LucideIcon; badge?: number; }
interface FAQ {
  id: number; category: string; question: string; answer: string;
  icon: LucideIcon; gradient: string; keywords?: string[];
}

// ─── Attachment helpers ───────────────────────────────────────────────────────

const MAX_FILES     = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg','image/png','image/gif','image/webp',
  'application/pdf','text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function formatBytes(b: number) {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: string }) {
  // Aliased on import: lucide's icon is named Image, which shadows next/image
  // and makes jsx-a11y/alt-text flag it as an <img> with no alt.
  if (type.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5 text-blue-400" />;
  return <File className="w-3.5 h-3.5 text-purple-400" />;
}

// ─── Inner component ──────────────────────────────────────────────────────────

function HelpSupportContent() {
  const [user, loading] = useSupabaseUser();
  const searchParams    = useSearchParams();

  const [searchQuery,      setSearchQuery]      = useState('');
  const [activeSection,    setActiveSection]    = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // FAQ is an accordion now. Collapsed by default so the list is scannable -
  // 55 always-open answers is a wall of text, not a help centre.
  const [openFaq,          setOpenFaq]          = useState<number | null>(null);

  // form
  const [subject,       setSubject]       = useState('');
  const [message,       setMessage]       = useState('');
  const [category,      setCategory]      = useState('general');
  const [priority,      setPriority]      = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError,   setSubmitError]   = useState('');

  // attachments
  const [attachments,     setAttachments]     = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tickets
  const [userTickets,    setUserTickets]    = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [criticalError,  setCriticalError]  = useState<CriticalError | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [ticketReplies,  setTicketReplies]  = useState<TicketReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText,      setReplyText]      = useState('');
  const [isReplying,     setIsReplying]     = useState(false);

  useEffect(() => {
    const q   = searchParams.get('q');
    const cat = searchParams.get('category');
    const sec = searchParams.get('section');
    if (q)   { setSearchQuery(decodeURIComponent(q)); setActiveSection('faq'); }
    if (cat && cat !== 'all') setSelectedCategory(cat);
    if (sec === 'tickets') setActiveSection('tickets');

    // Deep link from the in-app notification a staff reply creates
    // (app/api/support/inbound-email). Opening the thread is what marks it
    // read, so landing here from the bell clears the badge too.
    if (searchParams.get('tab') === 'tickets') setActiveSection('tickets');
    const ticket = searchParams.get('ticket');
    if (ticket) { setActiveSection('tickets'); setSelectedTicket(ticket); }
  }, [searchParams]);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError('');
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    const errors: string[] = [];
    const valid: File[]    = [];

    for (const f of picked) {
      if (!ALLOWED_TYPES.includes(f.type)) { errors.push(`"${f.name}" - unsupported type`); continue; }
      if (f.size > MAX_FILE_SIZE)          { errors.push(`"${f.name}" - exceeds 10 MB`);    continue; }
      valid.push(f);
    }

    const combined = [...attachments, ...valid];
    if (combined.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files allowed`);
      setAttachments(combined.slice(0, MAX_FILES));
    } else {
      setAttachments(combined);
    }

    if (errors.length) setAttachmentError(errors.join(' • '));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    setAttachmentError('');
  };

  // ── Open an attachment (resolves a signed URL for bare Supabase paths) ─────
  const openAttachment = async (att: AttachmentMeta) => {
    if (/^https?:\/\//i.test(att.url)) { window.open(att.url, '_blank'); return; }
    try {
      // No Authorization header needed - the Supabase session cookie is
      // sent automatically for this same-origin request.
      const res = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: att.url }),
      });
      if (!res.ok) throw new Error('Failed to resolve attachment URL');
      const { url } = await res.json() as { url: string };
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to open attachment');
    }
  };

  // ── Upload to Supabase Storage (proxied through an authenticated API route -
  //    the bucket is private and client uploads aren't RLS-scoped yet) ──────
  const uploadAttachments = async (ticketId: string): Promise<AttachmentMeta[]> => {
    const results: AttachmentMeta[] = [];

    for (const file of attachments) {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'support-attachment');
      form.append('ticketId', ticketId);
      form.append('fileName', file.name);

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('Failed to upload attachment');
      // Bare Supabase Storage path - resolved to a signed URL on click.
      const { path } = await res.json() as { path: string };
      results.push({ name: file.name, url: path, size: file.size, type: file.type });
    }
    return results;
  };

  // ── FAQs ────────────────────────────────────────────────────────────────────
  //
  // Anything quoting a quota or a price is interpolated from the same tables
  // the app enforces - lib/config/usage-limits.ts and lib/config/plan-prices.ts
  // - rather than typed into the copy. These answers were wrong before: they
  // promised 10 interview sessions and 5 resume analyses on Free (really 1 and
  // 3), 50 cover letters on Pro (really 30), and "unlimited access to all
  // features" on Premium, which is capped on every one of them. A support page
  // that contradicts the paywall is worse than no support page.
  const L = USAGE_LIMITS;
  const price = (k: 'pro' | 'premium') => `$${(PLAN_PRICE_CENTS[k] / 100).toFixed(2)}`;
  const plan = (k: 'free' | 'pro' | 'premium') =>
    `${L[k].interviews} mock interview${L[k].interviews === 1 ? '' : 's'}, ` +
    `${L[k].resumes} resume analyses, ${L[k].coverLetters} cover letters and ` +
    `${L[k].studyPlans} study plans a month`;

  const faqs: FAQ[] = [
    { id: 1,  category: 'general',      question: 'What is Preciprocal?',                               answer: 'Preciprocal is an AI-powered career preparation platform that helps you ace your job interviews. We offer realistic interview simulations, comprehensive resume analysis with ATS scoring, intelligent cover letter generation with company research, and personalized study planning to maximize your interview readiness.', icon: HelpCircle,    gradient: 'gradient-primary',   keywords: ['about','platform','what is','introduction','overview'] },
    { id: 2,  category: 'general',      question: 'How do I get started?',                              answer: 'Sign up with your email, complete your profile in Settings (add your name, experience level, target role, skills), and optionally upload your resume. Then you can start with interview practice, resume analysis, cover letter generation, or create a study plan. We recommend starting with a resume analysis to understand your baseline.', icon: Target,        gradient: 'gradient-success',   keywords: ['getting started','begin','start','first steps','onboarding','setup'] },
    { id: 3,  category: 'general',      question: 'Do I need to upload my resume to use the platform?', answer: 'While not mandatory, uploading your resume significantly enhances the experience. It enables personalized cover letters that incorporate your actual experience, more accurate recruiter eye simulations, and better-tailored interview questions. You can still use most features without a resume by completing your profile.', icon: FileText,      gradient: 'gradient-accent',    keywords: ['resume upload','required','mandatory','optional'] },
    { id: 4,  category: 'general',      question: 'Is Preciprocal free to use?',                        answer: `Yes. The Free plan includes ${plan('free')}, plus ${L.free.jobTracker} tracked job applications. Pro (${price('pro')}/month) and Premium (${price('premium')}/month) raise every limit and add unlimited job tracking. No card is needed to start.`, icon: CreditCard,    gradient: 'gradient-warning',   keywords: ['free','pricing','cost','plans','subscription'] },
    { id: 5,  category: 'interviews',   question: 'How does the AI interview simulation work?',         answer: 'Our platform uses advanced AI technology to create realistic interview experiences. The AI evaluates your responses in real-time, providing detailed feedback on technical accuracy, communication skills, problem-solving approach, and behavioral responses using the STAR method.', icon: Video,         gradient: 'gradient-accent',    keywords: ['interview','AI','simulation','how it works','practice'] },
    { id: 6,  category: 'interviews',   question: 'What interview types are supported?',                answer: 'We support Technical interviews (coding, algorithms, data structures), Behavioral interviews (STAR method, situational questions), System Design interviews (architecture, scalability), and Mixed interviews combining multiple formats. Each type includes relevant questions crafted by experienced recruiters from top tech companies.', icon: MessageSquare, gradient: 'gradient-primary',   keywords: ['interview types','technical','behavioral','system design'] },
    { id: 7,  category: 'interviews',   question: 'Can I practice for specific companies?',             answer: "Yes! When creating an interview, specify your target company. Our AI adapts questions to match that company's known interview style, culture, technical focus areas, and difficulty level based on real interview data collected from industry recruiters at companies like Google, Amazon, Microsoft, and Meta.", icon: Building2,     gradient: 'gradient-accent',    keywords: ['company specific','target company','FAANG','Google','Amazon'] },
    { id: 8,  category: 'interviews',   question: 'How long does each interview session last?',         answer: 'Interview sessions typically last 15-45 minutes depending on the type and difficulty level you select. Technical interviews tend to be longer (30-45 min), while behavioral ones are shorter (15-30 min). You can pause and resume sessions anytime, and all progress is automatically saved.', icon: Clock,         gradient: 'gradient-warning',   keywords: ['duration','time','length','how long'] },
    { id: 9,  category: 'interviews',   question: 'How accurate is the interview feedback?',            answer: 'Our AI evaluation system uses multiple specialized models trained on thousands of real interviews conducted by top recruiters. Feedback includes detailed scoring on technical accuracy, communication clarity, problem-solving approach, and areas for improvement with specific examples.', icon: Target,        gradient: 'gradient-success',   keywords: ['feedback','accuracy','evaluation','scoring','assessment'] },
    { id: 10, category: 'interviews',   question: 'Can I review my past interview performances?',       answer: 'Yes! All your interview sessions are saved in your dashboard with complete transcripts, feedback, scores, and performance metrics. You can compare sessions over time, track improvement trends, identify weak areas, and review specific questions and answers to learn from past experiences.', icon: BarChart3,     gradient: 'gradient-primary',   keywords: ['review','history','past interviews','transcripts','recordings'] },
    { id: 11, category: 'interviews',   question: 'Does the platform support voice-based interviews?',  answer: 'Yes! We offer realistic voice-powered interview simulations. You can speak your answers naturally, and the AI interviewer responds with follow-up questions just like a real human interviewer. This helps you practice articulation, pacing, and handling interruptions or follow-ups.', icon: Video,         gradient: 'gradient-accent',    keywords: ['voice','audio','speaking','microphone','verbal'] },
    { id: 12, category: 'interviews',   question: 'What happens if I make a mistake during an interview?', answer: "Don't worry! Mistakes are learning opportunities. The AI provides constructive feedback on errors, explains correct approaches, and offers improvement suggestions. You can pause, restart, or practice the same question again. All sessions are private and used only for your personal development.", icon: RefreshCw,     gradient: 'gradient-warning',   keywords: ['mistakes','errors','wrong answer','redo','retry'] },
    { id: 13, category: 'resume',       question: 'What does the ATS score mean?',                      answer: 'The ATS (Applicant Tracking System) score measures how well your resume performs with automated screening systems used by 98% of Fortune 500 companies. A score above 80% indicates excellent optimization, 70-80% is good, 60-70% needs improvement, and below 60% requires significant changes. We analyze keywords, formatting, structure, and content relevance.', icon: FileText,      gradient: 'gradient-success',   keywords: ['ATS','score','applicant tracking','resume score','optimization'] },
    { id: 14, category: 'resume',       question: 'Can I analyze multiple resumes?',                    answer: 'Yes! You can upload and analyze multiple resume versions to compare performance. This is essential for tailoring resumes to different industries, roles, or companies. Each analysis is saved in your dashboard with complete feedback, allowing easy comparison of ATS scores, keyword optimization, and formatting effectiveness.', icon: FileText,      gradient: 'gradient-secondary', keywords: ['multiple resumes','versions','compare','different'] },
    { id: 15, category: 'resume',       question: 'What file formats are supported for resume upload?', answer: 'We currently support PDF files for resume uploads. PDFs are the industry standard format and ensure your formatting remains consistent across all systems and platforms. Maximum file size is 5MB. We recommend using a clean, ATS-friendly template without excessive graphics or unusual fonts.', icon: FileText,      gradient: 'gradient-accent',    keywords: ['file format','PDF','upload','supported formats'] },
    { id: 16, category: 'resume',       question: 'How does the Recruiter Eye Simulation work?',        answer: 'Our AI conducts background research on your target company and role, analyzing the personality, work culture, and preferences of people in similar positions. It then simulates how recruiters from that specific company would review your resume, providing insights on what catches their attention, what they skip, and actionable feedback based on their hiring preferences.', icon: Eye,           gradient: 'gradient-primary',   keywords: ['recruiter eye','simulation','recruiter view','perspective'] },
    { id: 17, category: 'resume',       question: 'Does the AI improve my resume automatically?',       answer: 'The AI provides detailed suggestions and highlights improvement areas, but you maintain full control. The Resume Writer feature can help implement changes with AI-assisted rewriting. You can accept, modify, or reject suggestions. This ensures your resume stays authentic while benefiting from expert-level optimization guidance.', icon: Edit3,         gradient: 'gradient-success',   keywords: ['automatic','AI editing','auto improve','suggestions'] },
    { id: 18, category: 'resume',       question: 'How often should I update my resume analysis?',      answer: 'We recommend analyzing your resume after making significant changes or when targeting different industries. Most users maintain 2-3 versions: a general version, and tailored versions for specific roles or companies. Re-analyze quarterly or before major applications to ensure optimal ATS performance and keyword relevance.', icon: TrendingUp,    gradient: 'gradient-accent',    keywords: ['update frequency','how often','when to update'] },
    { id: 19, category: 'resume',       question: 'Can I download my analyzed resume?',                 answer: 'Yes! After analysis, you can download your resume with suggested improvements in PDF format. You can also export the detailed analysis report including ATS scores, keyword suggestions, and improvement recommendations.', icon: Download,      gradient: 'gradient-primary',   keywords: ['download','export','save','PDF'] },
    { id: 20, category: 'cover-letter', question: 'How does the AI Cover Letter Generator work?',       answer: 'Our AI conducts comprehensive real-time background research on the target company, analyzing their latest projects, news articles, press releases, and company culture. It then combines this research with your resume and the job description to craft a highly personalized cover letter that demonstrates genuine interest and relevant company knowledge.', icon: Pen,           gradient: 'gradient-primary',   keywords: ['cover letter','generator','AI writing','how it works'] },
    { id: 21, category: 'cover-letter', question: 'What information does the AI use to write my cover letter?', answer: 'The AI analyzes three key inputs: (1) Your resume and profile for experience and skills, (2) The job description for required qualifications and responsibilities, and (3) Real-time company research including recent news, projects, culture, values, and industry position. This creates a letter that connects your background to their specific needs.', icon: Sparkles,      gradient: 'gradient-secondary', keywords: ['inputs','data sources','information used','what does it use'] },
    { id: 22, category: 'cover-letter', question: 'Can I customize the tone of my cover letter?',       answer: 'Yes! You can choose from multiple tone options: Professional (formal and structured), Enthusiastic (energetic and passionate), Formal (traditional corporate), Friendly (warm and personable), or Confident (assertive and direct). The AI adapts the writing style while maintaining the researched company insights and personalization.', icon: PenTool,       gradient: 'gradient-accent',    keywords: ['tone','style','customize','personalize','format'] },
    { id: 23, category: 'cover-letter', question: 'How long does it take to generate a cover letter?',  answer: 'Cover letter generation typically takes 10-30 seconds. The AI performs real-time company research (5-10 sec), analyzes the job description and your resume (3-5 sec), then crafts the personalized letter (5-10 sec). You can immediately save, edit, copy, or download the result in multiple formats.', icon: Zap,           gradient: 'gradient-success',   keywords: ['speed','time','how long','duration','fast'] },
    { id: 24, category: 'cover-letter', question: 'Does the cover letter use my resume information?',   answer: 'Yes! If you have a resume uploaded, the AI automatically incorporates your specific experience, skills, projects, and achievements into the cover letter. This ensures consistency between your application materials and highlights your most relevant qualifications with actual examples and metrics from your resume.', icon: CheckCircle2,  gradient: 'gradient-primary',   keywords: ['resume integration','uses resume','consistency'] },
    { id: 25, category: 'cover-letter', question: 'Can I edit the generated cover letter?',             answer: 'Absolutely! After generation, you can copy the text to edit in your preferred word processor, or use our built-in editor to make changes. The AI provides a strong foundation with company research and proper structure, which you can then personalize further to match your unique voice and style.', icon: Edit3,         gradient: 'gradient-accent',    keywords: ['edit','modify','change','customize'] },
    { id: 26, category: 'cover-letter', question: 'How many cover letters can I generate?',             answer: `${L.free.coverLetters} a month on Free, ${L.pro.coverLetters} on Pro and ${L.premium.coverLetters} on Premium. Every letter is saved to your dashboard, where you can edit, download or reuse it. The count resets on your billing date.`, icon: FileText,      gradient: 'gradient-warning',   keywords: ['limit','how many','count','quota'] },
    { id: 27, category: 'planner',      question: 'How do I create an effective study plan?',           answer: 'Navigate to the Planner section and click "Create New Plan". Enter your interview date, target role (e.g., Software Engineer), current skill level (beginner/intermediate/advanced), and daily time commitment. Our AI generates a personalized day-by-day schedule with specific tasks, curated resources, practice problems, and progress tracking.', icon: Target,        gradient: 'gradient-primary',   keywords: ['study plan','create plan','planner','schedule'] },
    { id: 28, category: 'planner',      question: 'Can I customize my study plan?',                     answer: 'Yes! While our AI generates an initial plan optimized for your timeline and skill level, you have full control to add, remove, or reorder tasks. You can adjust daily time commitments, set custom deadlines, add your own resources, mark tasks as complete, and the AI will automatically rebalance your schedule to keep you on track.', icon: Calendar,      gradient: 'gradient-accent',    keywords: ['customize','modify','adjust','personalize'] },
    { id: 29, category: 'planner',      question: 'What happens if I miss a day in my plan?',           answer: "No worries! Your plan adapts to your actual pace. Missed tasks automatically roll over to the next available day, and you can adjust deadlines as needed. The AI intelligently re-calculates your daily workload distribution to keep you on track for your target interview date without overwhelming you.", icon: Calendar,      gradient: 'gradient-warning',   keywords: ['miss day','skip','behind schedule','late'] },
    { id: 30, category: 'planner',      question: 'What happens when I complete all tasks?',            answer: 'Upon completing all tasks in your study plan, you unlock an AI-generated personalized quiz based on all your study material and practice areas. This final assessment quiz evaluates your readiness with tailored questions across different difficulty levels, providing a comprehensive readiness score and identifying any remaining weak spots.', icon: Award,         gradient: 'gradient-success',   keywords: ['complete','finish','done','final quiz','assessment'] },
    { id: 33, category: 'subscription', question: 'What are the subscription plans and limits?',        answer: `Free: ${plan('free')}. Pro (${price('pro')}/month): ${plan('pro')}, plus unlimited job tracking and longer interview sessions. Premium (${price('premium')}/month): ${plan('premium')}, plus the longest sessions, the highest AI-analysis allowance and priority support. Every plan has a monthly allowance rather than unlimited use, so the numbers above are what you get.`, icon: Award,         gradient: 'gradient-warning',   keywords: ['plans','pricing','limits','subscription','tiers'] },
    { id: 34, category: 'subscription', question: 'Is there a student discount?',                       answer: "Yes! University students can get significant discounts on Pro and Premium plans. Verify your student status through your university email address (.edu domain) in Settings. The discount is automatically applied upon verification and remains valid while you're enrolled.", icon: Award,         gradient: 'gradient-accent',    keywords: ['student','discount','education','university'] },
    { id: 35, category: 'subscription', question: 'Can I cancel my subscription anytime?',              answer: "Yes, you can cancel your subscription at any time from the Settings page. You'll retain access to all paid features until the end of your current billing period. After cancellation, your account reverts to the Free plan. All your data, analyses, and interview history remain accessible.", icon: Shield,        gradient: 'gradient-warning',   keywords: ['cancel','unsubscribe','stop','downgrade'] },
    { id: 36, category: 'subscription', question: 'When do usage limits reset?',                        answer: 'Limits reset monthly on your billing date, whichever plan you are on. If you subscribed on the 15th, they reset on the 15th. Free accounts reset on the date you signed up. Paid plans have higher allowances than Free, but they are still monthly allowances rather than unlimited use - you can see exactly what you have left in Settings.', icon: Calendar,      gradient: 'gradient-primary',   keywords: ['reset','limits','renewal','monthly'] },
    { id: 39, category: 'technical',    question: 'Can I use Preciprocal on mobile devices?',           answer: 'Yes! Preciprocal is fully responsive and works on all devices including smartphones and tablets. However, for the best interview simulation experience (especially voice-based interviews), we strongly recommend using a desktop or laptop with a quality microphone and stable internet connection.', icon: Smartphone,    gradient: 'gradient-secondary', keywords: ['mobile','phone','tablet','responsive','device'] },
    { id: 40, category: 'technical',    question: 'Is my data secure and private?',                     answer: `Absolutely. All data is encrypted in transit and at rest. Your resumes, interview responses, and personal information are never shared with third parties. We use enterprise-grade security, comply with GDPR and CCPA regulations, and conduct regular security audits. You can delete your data anytime, and our full privacy policy is at ${SITE.marketing}/privacy.`, icon: Lock,          gradient: 'gradient-accent',    keywords: ['security','privacy','safe','encrypted','data protection'] },
    { id: 41, category: 'technical',    question: 'What browsers are supported?',                       answer: 'Preciprocal works best on modern browsers including Google Chrome (recommended), Mozilla Firefox, Microsoft Edge, Safari, and Brave. We recommend using the latest version of your browser for optimal performance and access to all features. Mobile browsers are also supported.', icon: Globe,         gradient: 'gradient-primary',   keywords: ['browser','Chrome','Firefox','Safari','Edge','compatibility'] },
    { id: 42, category: 'technical',    question: 'Do I need a webcam or microphone?',                  answer: 'A microphone is required only for voice-based interview simulations. A webcam is optional but can enhance the practice experience. For text-based interviews, resume analysis, cover letter generation, and study planning, neither webcam nor microphone is needed.', icon: Video,         gradient: 'gradient-accent',    keywords: ['webcam','microphone','camera','audio','requirements'] },
    { id: 45, category: 'account',      question: 'How do I update my profile information?',            answer: 'Go to Settings > Profile to update your personal information including name, email, location, target role, experience level, preferred technologies, LinkedIn, GitHub, and career goals. This information helps personalize your interview questions and cover letters.', icon: SettingsIcon,  gradient: 'gradient-primary',   keywords: ['profile','update','edit','settings'] },
    { id: 46, category: 'account',      question: 'Can I change my email address?',                     answer: "Yes, you can update your email address in Settings > Profile. After changing, you'll receive a verification email to confirm the new address. Your subscription, data, and progress remain intact.", icon: Mail,          gradient: 'gradient-accent',    keywords: ['email','change email','update email'] },
    { id: 47, category: 'account',      question: 'How do I delete my account?',                        answer: 'To delete your account, go to Settings > Account > Delete Account. This permanently removes all your data including interviews, resumes, cover letters, and study plans. This action cannot be undone. If you have an active subscription, it will be automatically canceled.', icon: AlertCircle,   gradient: 'gradient-warning',   keywords: ['delete','remove','close account','deactivate'] },
    { id: 55, category: 'support',      question: 'How do I contact support?',                          answer: 'Contact support through Help & Support > Contact > Submit Ticket. Choose your issue category, set priority, and describe your issue. We respond within 24 hours. You can track your ticket status and view all communication history in the Tickets section.', icon: MessageSquare, gradient: 'gradient-accent',    keywords: ['contact','support','help','customer service'] },
    { id: 56, category: 'support',      question: 'What is your response time for support tickets?',    answer: "We aim to respond to all support tickets within 24 hours. High-priority issues are addressed within 12 hours, and critical issues receive immediate attention. Premium users get priority support with faster response times. You'll receive email notifications when we reply.", icon: Clock,         gradient: 'gradient-primary',   keywords: ['response time','support speed','how long','wait time'] },
    { id: 57, category: 'support',      question: 'What is your refund policy?',                        answer: "We offer a 30-day money-back guarantee for new Pro and Premium subscriptions. If you're not satisfied, request a refund within 30 days of purchase. Contact support with your subscription details. Refunds are processed within 5-7 business days.", icon: Shield,        gradient: 'gradient-warning',   keywords: ['refund','money back','return','guarantee'] },
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

  // Counts threads with an unread support reply, not open tickets. See
  // hasUnreadSupportReply() and migration 0041.
  const unreadTicketCount = userTickets.filter(hasUnreadSupportReply).length;
  const tabs: TabItem[] = [
    { id: 'faq',     label: 'FAQs',    icon: BookOpen      },
    { id: 'contact', label: 'Contact', icon: MessageSquare },
    { id: 'tickets', label: 'Tickets', icon: FileText, badge: unreadTicketCount },
  ];

  // ── Live tickets ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setUserTickets([]); return; }
    setLoadingTickets(true);

    const fetchTickets = async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading tickets:', error);
        setLoadingTickets(false);
        setCriticalError({ code: 'DATABASE', title: 'Database Connection Error', message: 'Unable to load support tickets', details: error.message });
        return;
      }
      setUserTickets((data as SupportTicketRow[]).map(toSupportTicket));
      setLoadingTickets(false);
    };

    fetchTickets();

    const channel: RealtimeChannel = supabase
      .channel(`support_tickets:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${user.id}` }, fetchTickets)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Live replies for the selected ticket ────────────────────────────────────
  useEffect(() => {
    if (!selectedTicket) { setTicketReplies([]); return; }
    setLoadingReplies(true);

    const fetchReplies = async () => {
      const { data, error } = await supabase
        .from('support_ticket_replies')
        .select('*')
        .eq('ticket_id', selectedTicket)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error loading replies:', error);
        setLoadingReplies(false);
        toast.error('Failed to load conversation');
        return;
      }
      setTicketReplies((data as TicketReplyRow[]).map(toTicketReply));
      setLoadingReplies(false);
    };

    fetchReplies();

    // Opening the thread is the read receipt.
    //
    // Through an RPC so the timestamp comes from the DATABASE clock. Writing
    // `new Date()` from here compares a browser clock against the server
    // clock that stamped last_reply_at, and this project's database measured
    // 334ms ahead of a dev machine - enough that opening a thread failed to
    // clear the badge. See migration 0042.
    void supabase
      .rpc('mark_ticket_read', { p_ticket_id: selectedTicket })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('Could not mark ticket read:', error.message);
      });

    const channel: RealtimeChannel = supabase
      .channel(`support_ticket_replies:${selectedTicket}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_replies', filter: `ticket_id=eq.${selectedTicket}` }, fetchReplies)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket]);

  // ── User reply from app ─────────────────────────────────────────────────────
  const handleUserReply = async () => {
    if (!user || !selectedTicket || !replyText.trim()) return;
    setIsReplying(true);
    try {
      const ticket = userTickets.find(t => t.id === selectedTicket);
      if (!ticket) return;


      const { error: replyError } = await supabase.from('support_ticket_replies').insert({
        ticket_id: selectedTicket,
        body: replyText.trim(),
        author_user_id: user.id,
        from_email: user.email,
        is_staff: false,
      });
      if (replyError) throw replyError;

      // No ticket update here any more. A trigger on support_ticket_replies
      // (migration 0036) maintains reply_count, last_reply_by, last_reply_at,
      // updated_at and status.
      //
      // This used to write `reply_count: ticketReplies.length + 1` - the
      // number of replies THIS BROWSER had loaded - which a stale tab gets
      // wrong and two simultaneous replies race over. The inbound-email route
      // computed the same column from the database, so the two writers
      // disagreed by construction.
      //
      // It also did not touch status, so replying to a ticket support had
      // marked resolved left it resolved: out of the support queue, while the
      // user waited for an answer to a message nobody would see. The trigger
      // reopens it.

      fetch('/api/support/notify-admin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId:      selectedTicket,
          ticketSubject: ticket.subject,
          userName:      (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || 'User',
          userEmail:     user.email,
          message:       replyText.trim(),
        }),
      }).catch(err => console.error('Failed to notify admin:', err));

      setReplyText('');
      toast.success('Reply sent');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setIsReplying(false);
    }
  };

  // ── Submit ticket ───────────────────────────────────────────────────────────
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user)                            { setSubmitError('Please log in to submit a ticket'); return; }
    if (!subject.trim() || !message.trim()) { setSubmitError('Please fill in all fields');        return; }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const userName = (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || 'User';
      const ticketData = {
        userId:      user.id,
        userEmail:   user.email,
        userName,
        subject:     subject.trim(),
        message:     message.trim(),
        category,
        priority,
        status:      'open' as const,
        replyCount:  0,
        lastReplyBy: null,
        lastReplyAt: null,
      };

      const { data: created, error: insertError } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        user_email: user.email,
        user_name: userName,
        subject: ticketData.subject,
        message: ticketData.message,
        category: ticketData.category,
        priority: ticketData.priority,
        status: 'open',
      }).select('id').single();
      if (insertError) throw insertError;
      const ticketId = created.id as string;

      // Upload attachments after we have the ticket ID
      let uploadedAttachments: AttachmentMeta[] = [];
      if (attachments.length > 0) {
        try {
          uploadedAttachments = await uploadAttachments(ticketId);
          const { error: attachError } = await supabase.from('support_tickets').update({
            attachments: uploadedAttachments,
          }).eq('id', ticketId);
          if (attachError) throw attachError;
        } catch (uploadErr) {
          console.error('Attachment upload error:', uploadErr);
          toast.error('Ticket submitted, but some attachments failed to upload.');
        }
      }

      // Fire-and-forget email - log response so failures are visible in console
      fetch('/api/firebase/emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ticketId,
          ticket:   { ...ticketData, userEmail: user.email, userName, attachments: uploadedAttachments },
        }),
      })
        .then(r => r.json().then(d => {
          if (!r.ok) console.error('❌ Email route error:', d);
          else        console.log('✅ Ticket emails sent:', d);
        }))
        .catch(err => console.error('❌ Email fetch failed:', err));

      // Non-critical in-app notification
      try {
        await NotificationService.createNotification(
          user.id, 'system', 'Support Ticket Submitted 🎫',
          `Your ticket "${subject.trim()}" has been received. We'll respond within 24 hours. Track it in Help & Support > Tickets.`,
          { actionUrl: '/help?section=tickets', actionLabel: 'View Ticket' }
        );
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }

      setSubmitSuccess(true);
      setSubject('');
      setMessage('');
      setAttachments([]);
      setAttachmentError('');

      setTimeout(() => { setSubmitSuccess(false); setActiveSection('tickets'); }, 2000);

    } catch (error) {
      console.error('Error submitting ticket:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('Firebase')) {
        setCriticalError({ code: 'DATABASE', title: 'Submission Error', message: 'Unable to submit ticket', details: msg });
      } else {
        setSubmitError('Failed to submit. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const sl              = searchQuery.toLowerCase();
    const matchesSearch   = searchQuery === '' ||
      faq.question.toLowerCase().includes(sl) ||
      faq.answer.toLowerCase().includes(sl)   ||
      faq.keywords?.some(kw => kw.toLowerCase().includes(sl));
    return matchesCategory && matchesSearch;
  });


  if (criticalError) return (
    <ErrorPage errorCode={criticalError.code} errorTitle={criticalError.title}
      errorMessage={criticalError.message} errorDetails={criticalError.details}
      onRetry={() => setCriticalError(null)} />
  );
  if (loading) return <AnimatedLoader isVisible loadingText="Loading help center..." />;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">

      {/* Masthead - full bleed, so the page reads as a section of the product
          rather than a card floating in the middle of a very wide screen. */}
      <header className="border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20">
        {/* Title and tabs are one column so the Dashboard button can centre
            against the masthead as a whole. It used to live inside the title
            row, which centred it on that row only and left it sitting high
            against the two-row header. */}
        <div className="px-4 sm:px-6 lg:px-10 xl:px-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 h-16">
              <HelpCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <h1 className="text-base font-semibold text-white tracking-tight truncate">Help &amp; Support</h1>
            </div>

            {/* Underline tabs. A filled gradient pill reads as a call to action;
                these are navigation, and should sit quietly until chosen. */}
            <nav className="flex gap-6 -mb-px" aria-label="Help sections">
              {tabs.map(tab => {
                const on = activeSection === tab.id;
                return (
                  <button key={tab.id}
                    onClick={() => {
                      setActiveSection(tab.id);
                      if (tab.id !== 'tickets') { setSelectedTicket(null); setTicketReplies([]); }
                    }}
                    aria-current={on ? 'page' : undefined}
                    className={`relative flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors
                      focus:outline-none focus-visible:text-white
                      ${on ? 'border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="ml-0.5 min-w-[18px] h-[18px] px-1.5 rounded-full bg-purple-500/20
                                       border border-purple-500/30 text-purple-300 text-xs font-semibold
                                       leading-none flex items-center justify-center">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <Link href={user ? '/' : '/sign-in'}
            className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08]
                       text-sm text-slate-400 hover:text-white hover:border-white/[0.16] transition-colors">
            {user
              ? <><Home className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span></>
              : <><LogOut className="w-4 h-4 rotate-180" /><span className="hidden sm:inline">Sign in</span></>}
          </Link>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-10 xl:px-16 py-8">

        {/* ── FAQ ── */}
        {activeSection === 'faq' && (() => {
          // Browsing = the landing state: hero plus the category grid.
          // Searching or picking a category switches to the article list.
          const browsing = selectedCategory === 'all' && searchQuery === '';
          const countFor = (value: string) =>
            value === 'all' ? faqs.length : faqs.filter(f => f.category === value).length;
          const current = categories.find(c => c.value === selectedCategory);

          return (
            <div className="animate-fade-in-up">

              {/* Hero. One focal point: the search field. No card, no icon,
                  no subtitle stack - the question is the heading. */}
              <div className={`text-center ${browsing ? 'pt-16 pb-14' : 'pt-10 pb-8'}`}>
                <h2 className={`font-semibold text-white tracking-tight ${browsing ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>
                  How can we help?
                </h2>

                <div className={`relative mx-auto ${browsing ? 'mt-8 max-w-2xl' : 'mt-6 max-w-xl'}`}>
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setOpenFaq(null); }}
                    placeholder="Search for an answer"
                    className={`w-full pl-14 pr-5 rounded-2xl text-white placeholder-slate-600
                                bg-white/[0.04] border border-white/[0.08]
                                focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06]
                                transition-all ${browsing ? 'py-4 text-lg' : 'py-3 text-base'}`}
                  />
                </div>

                {browsing && (
                  <p className="mt-5 text-sm text-slate-600">
                    Popular:{' '}
                    {['billing', 'interviews', 'resume', 'cancel'].map((term, i) => (
                      <span key={term}>
                        {i > 0 && <span className="text-slate-700"> · </span>}
                        <button onClick={() => { setSearchQuery(term); setOpenFaq(null); }}
                          className="text-slate-400 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white/60 transition-colors">
                          {term}
                        </button>
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {browsing ? (
                <>
                  {/* Category grid. The whole point of the width. */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {categories.filter(c => c.value !== 'all').map(cat => {
                      const n = countFor(cat.value);
                      if (n === 0) return null;
                      return (
                        <button key={cat.value} onClick={() => setSelectedCategory(cat.value)}
                          className="group text-left p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                                     hover:bg-white/[0.04] hover:border-white/[0.12] transition-all">
                          <cat.icon className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                          <h3 className="text-base font-semibold text-white mt-4">{cat.label}</h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {n} {n === 1 ? 'article' : 'articles'}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Closing CTA, the way a real help centre ends a page. */}
                  <div className="mt-16 py-12 text-center border-t border-white/[0.06]">
                    <h3 className="text-xl font-semibold text-white">Still stuck?</h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Send us a ticket and we will reply by email, usually within 24 hours.
                    </p>
                    <button onClick={() => setActiveSection('contact')}
                      className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                                 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors">
                      Contact support <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <button onClick={() => { setSelectedCategory('all'); setSearchQuery(''); setOpenFaq(null); }}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> All topics
                    </button>
                    <span className="text-sm text-slate-600">
                      {searchQuery
                        ? `${filteredFaqs.length} ${filteredFaqs.length === 1 ? 'result' : 'results'}`
                        : `${filteredFaqs.length} in ${current?.label ?? ''}`}
                    </span>
                  </div>

                  {filteredFaqs.length > 0 ? (
                    <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
                      {filteredFaqs.map(faq => {
                        const open = openFaq === faq.id;
                        return (
                          <div key={faq.id}>
                            <button onClick={() => setOpenFaq(open ? null : faq.id)} aria-expanded={open}
                              className="w-full flex items-start justify-between gap-6 text-left py-5 group">
                              <h3 className={`text-base transition-colors ${open ? 'text-white font-semibold' : 'text-slate-300 font-medium group-hover:text-white'}`}>
                                {faq.question}
                              </h3>
                              <ChevronRight className={`w-4 h-4 mt-1 flex-shrink-0 transition-transform duration-200
                                ${open ? 'rotate-90 text-purple-400' : 'text-slate-700 group-hover:text-slate-500'}`} />
                            </button>
                            {open && (
                              <p className="text-base text-slate-400 leading-relaxed pb-6 pr-10">{faq.answer}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-base text-slate-400">
                        No answers for &ldquo;{searchQuery}&rdquo;.
                      </p>
                      <button onClick={() => setActiveSection('contact')}
                        className="mt-4 text-sm text-purple-400 hover:text-purple-300 transition-colors">
                        Ask support instead
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Contact ── */}
        {activeSection === 'contact' && (
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 xl:gap-10 animate-fade-in-up">
            <div className="glass-card">
              <div className="p-4 sm:p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Submit a ticket</h3>
                  <p className="text-sm text-slate-500 mt-1">We reply by email, usually within 24 hours.</p>
                </div>

                {submitSuccess ? (
                  <div className="glass-morphism p-6 sm:p-8 rounded-xl border border-green-500/30 text-center">
                    <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto mb-2 sm:mb-3" />
                    <h4 className="text-sm sm:text-base font-semibold text-white mb-1">Ticket Submitted</h4>
                    <p className="text-slate-400 text-xs sm:text-sm">We&apos;ll respond via email within 24 hours</p>
                  </div>
                ) : !user ? (
                  <div className="glass-morphism p-6 sm:p-8 rounded-xl border border-white/10 text-center space-y-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto">
                      <LogOut className="w-4 h-4 text-slate-400 rotate-180" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-white mb-1">Sign in to submit a ticket</h4>
                      <p className="text-slate-500 text-sm">You need to be signed in to contact support and track your tickets.</p>
                    </div>
                    <Link href="/sign-in" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all">
                      <LogOut className="w-4 h-4 rotate-180" />Sign In
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

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
                      {/* Radix, not <select>. A native option list is drawn by
                          the OS and cannot be themed - on this dark page it
                          renders a bright blue highlight bar. */}
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger aria-label="Category">
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {ticketCategories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Priority</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map(p => (
                          <button key={p} type="button" onClick={() => setPriority(p)}
                            className={`flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all ${priority === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Subject</label>
                      <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                        placeholder="Brief description"
                        className="glass-input w-full px-3 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 text-xs sm:text-sm" required />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Message</label>
                      <textarea value={message} onChange={e => setMessage(e.target.value)}
                        placeholder="Describe your issue..." rows={4}
                        className="glass-input w-full px-3 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 resize-none glass-scrollbar text-xs sm:text-sm" required />
                    </div>

                    {/* Attachments */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Attachments{' '}
                        <span className="text-slate-600 font-normal">(optional · up to {MAX_FILES} files · 10 MB each)</span>
                      </label>

                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-white/15 hover:border-white/30 hover:bg-white/5 transition-all text-slate-400 hover:text-slate-300 text-xs sm:text-sm">
                        <Paperclip className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {attachments.length > 0
                            ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} selected - click to add more`
                            : 'Attach images, PDFs, or documents'}
                        </span>
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ALLOWED_TYPES.join(',')}
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      {attachmentError && (
                        <p className="mt-1.5 text-xs text-red-400 flex items-start gap-1">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{attachmentError}
                        </p>
                      )}

                      {attachments.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {attachments.map((file, idx) => (
                            <li key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass-morphism border border-white/8">
                              <FileTypeIcon type={file.type} />
                              <span className="flex-1 text-xs text-slate-300 truncate min-w-0">{file.name}</span>
                              <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(file.size)}</span>
                              <button type="button" onClick={() => removeAttachment(idx)}
                                className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors ml-0.5"
                                aria-label={`Remove ${file.name}`}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={isSubmitting}
                      className="w-full glass-button-primary hover-lift px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm">
                      {isSubmitting
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{attachments.length > 0 ? 'Uploading & Submitting...' : 'Submitting...'}</>
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

        {/* ── Tickets ── */}
        {activeSection === 'tickets' && (
          <div className="animate-fade-in-up">
            {!user ? (
              <div className="glass-card">
                <div className="text-center py-14 px-6">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">Sign in to view tickets</h3>
                  <p className="text-slate-500 text-sm mb-5">Your support history is tied to your account.</p>
                  <Link href="/sign-in"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors">
                    Sign in
                  </Link>
                </div>
              </div>
            ) : loadingTickets ? (
              <div className="glass-card">
                <div className="text-center py-14 px-6">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Loading tickets</p>
                </div>
              </div>
            ) : selectedTicket ? (
              (() => {
                const ticket = userTickets.find(t => t.id === selectedTicket);
                if (!ticket) return null;
                const st = statusMeta(ticket.status);
                const canReply = ticket.status !== 'closed';
                return (
                  <div className="space-y-4">
                    <button onClick={() => { setSelectedTicket(null); setTicketReplies([]); }}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> All tickets
                    </button>

                    <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-6 xl:gap-8 items-start">
                    <div className="glass-card overflow-hidden">
                      {/* Thread header. Ticket metadata lives in the rail, not
                          crammed into a subtitle under the subject. */}
                      <div className="px-5 py-4 border-b border-white/[0.06]">
                        <h2 className="text-lg font-semibold text-white leading-snug">{ticket.subject}</h2>
                      </div>

                      {/* Transcript */}
                      <div className="divide-y divide-white/[0.05]">
                        <Message
                          author="You"
                          at={ticket.createdAt}
                          body={ticket.message}
                          attachments={ticket.attachments}
                          onOpenAttachment={openAttachment}
                        />
                        {loadingReplies ? (
                          <div className="px-5 py-8 text-center">
                            <Loader2 className="w-4 h-4 text-slate-600 animate-spin mx-auto" />
                          </div>
                        ) : (
                          ticketReplies.map(reply => (
                            <Message
                              key={reply.id}
                              author={reply.isStaff ? 'Support' : 'You'}
                              isStaff={reply.isStaff}
                              at={reply.createdAt}
                              body={reply.message}
                            />
                          ))
                        )}
                      </div>

                      {/* Composer */}
                      <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.015]">
                        {canReply ? (
                          <>
                            <textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Write a reply…"
                              rows={3}
                              className="w-full px-3 py-2.5 rounded-lg text-base text-white placeholder-slate-600
                                         bg-white/[0.03] border border-white/[0.08] resize-none
                                         focus:outline-none focus:border-purple-500/40 transition-colors glass-scrollbar"
                            />
                            <div className="flex items-center justify-between mt-2.5">
                              <p className="text-sm text-slate-600">We typically reply within 24 hours.</p>
                              <button
                                onClick={handleUserReply}
                                disabled={isReplying || !replyText.trim()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                                           bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.06]
                                           disabled:text-slate-600 text-white text-sm font-semibold
                                           transition-colors disabled:cursor-not-allowed">
                                {isReplying
                                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending</>
                                  : <><Send className="w-3.5 h-3.5" />Send reply</>}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2.5 text-sm text-slate-500">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                            This ticket is closed. Start a new one if you still need help.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata rail */}
                    <aside className="glass-card p-5 lg:sticky lg:top-32">
                      <dl className="space-y-4">
                        {[
                          { k: 'Status',   v: (
                              <span className={`inline-flex items-center gap-1.5 ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                              </span>) },
                          { k: 'Ticket',   v: <span className="font-mono text-slate-400">#{ticket.id.slice(0, 8)}</span> },
                          { k: 'Category', v: <span className="capitalize text-slate-400">{ticket.category}</span> },
                          { k: 'Priority', v: <span className="capitalize text-slate-400">{ticket.priority}</span> },
                          { k: 'Opened',   v: <span className="text-slate-400">{relTime(ticket.createdAt)}</span> },
                          { k: 'Replies',  v: <span className="text-slate-400">{ticket.replyCount ?? 0}</span> },
                        ].map(row => (
                          <div key={row.k} className="flex items-center justify-between gap-3">
                            <dt className="text-sm text-slate-600">{row.k}</dt>
                            <dd className="text-sm">{row.v}</dd>
                          </div>
                        ))}
                      </dl>
                    </aside>
                    </div>
                  </div>
                );
              })()
            ) : userTickets.length > 0 ? (
              /* A table, not a stack of cards. At full width a card list just
                 grows one very wide column; columns let status, activity and
                 volume line up so the list can be scanned down rather than
                 read across - which is what every support console does. */
              <div className="glass-card overflow-hidden">
                <div className="hidden md:grid grid-cols-[minmax(0,1fr)_120px_100px_150px_32px] gap-4
                                px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                  {['Subject', 'Status', 'Replies', 'Last activity', ''].map((h, i) => (
                    <span key={i} className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</span>
                  ))}
                </div>

                <div className="divide-y divide-white/[0.05]">
                  {userTickets.map(ticket => {
                    const st     = statusMeta(ticket.status);
                    const unread = hasUnreadSupportReply(ticket);
                    return (
                      <button key={ticket.id} onClick={() => setSelectedTicket(ticket.id)}
                        className="w-full text-left px-5 py-3.5 hover:bg-white/[0.02] transition-colors group
                                   md:grid md:grid-cols-[minmax(0,1fr)_120px_100px_150px_32px] md:gap-4 md:items-center">
                        {/* Subject */}
                        <div className="min-w-0 flex items-start md:items-center gap-2.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 md:mt-0
                                            ${unread ? 'bg-purple-400' : 'bg-transparent'}`} />
                          <div className="min-w-0">
                            <div className={`text-base truncate ${unread ? 'text-white font-semibold' : 'text-slate-200 font-medium'}`}>
                              {ticket.subject}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 mt-0.5">
                              <span className="font-mono">#{ticket.id.slice(0, 8)}</span>
                              <span>·</span>
                              <span className="capitalize">{ticket.category}</span>
                              {ticket.attachments && ticket.attachments.length > 0 && (
                                <><span>·</span><span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{ticket.attachments.length}</span></>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className={`flex items-center gap-1.5 text-sm mt-2 md:mt-0 ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />{st.label}
                        </div>

                        {/* Replies - labelled on mobile, where the header is hidden */}
                        <div className="text-sm text-slate-500 mt-1 md:mt-0">
                          <span className="md:hidden text-slate-600">Replies: </span>
                          {ticket.replyCount ?? 0}
                        </div>

                        {/* Last activity */}
                        <div className="text-sm text-slate-500 mt-1 md:mt-0">
                          {relTime(ticket.lastReplyAt ?? ticket.createdAt)}
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-700 group-hover:text-slate-500 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="glass-card">
                <div className="text-center py-14 px-6">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">No tickets yet</h3>
                  <p className="text-slate-500 text-sm mb-5">When you contact support, the conversation appears here.</p>
                  <button onClick={() => setActiveSection('contact')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" /> Contact support
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Terms and Privacy live on the marketing site, not here - /terms and
          /privacy have no route in this app and 404. Linked absolutely off
          SITE.marketing so they keep working wherever the app is deployed. */}
      <footer className="border-t border-white/[0.06] mt-8">
        <div className="px-4 sm:px-6 lg:px-10 xl:px-16 py-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-sm text-slate-600">
            &copy; {new Date().getFullYear()} {SITE.name}
          </span>
          <a href={`${SITE.marketing}/terms`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Terms of Service
          </a>
          <a href={`${SITE.marketing}/privacy`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Privacy Policy
          </a>
          <a href={SITE.marketing} target="_blank" rel="noopener noreferrer"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            preciprocal.com
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── Fallback ─────────────────────────────────────────────────────────────────
function HelpSupportFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <HelpCircle className="w-4 h-4 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">Loading</p>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function HelpSupportPage() {
  return (
    <Suspense fallback={<HelpSupportFallback />}>
      <HelpSupportContent />
    </Suspense>
  );
}