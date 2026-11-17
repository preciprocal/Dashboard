'use client';
import PageHeader from '@/components/PageHeader';
import { Field } from '@/components/profile/FormKit';
import AutoTextarea from '@/components/ui/auto-textarea';
import { Pen as HeaderIcon } from 'lucide-react';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, Copy, Check, AlertCircle,
  Wand2, Loader2, ArrowRight,
  CheckCircle2, RefreshCw, ChevronDown,
  Save, History, FileDown, ExternalLink, Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { isUnlimited } from '@/lib/config/usage-limits';
import { SeeExampleButton } from '@/components/ServiceModal';
import NextStepPrompt from '@/components/NextStepPrompt';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoverLetterMetadata {
  usedResume: boolean;
  responseTime: number;
  usedWritingSample?: boolean;
}

/** lib/ai/writing-check.ts, as returned with every letter. */
interface Authenticity {
  aiTells: { phrase: string; suggestion: string }[];
  unsupported: { text: string; kind: 'number' | 'tool' }[];
  companyMentions: number;
  verdict: 'ready' | 'review' | 'rework';
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

interface ProfileStatus {
  hasProfile: boolean;
  hasResume: boolean;
  loading: boolean;
  userName: string;
  resumeCount: number;
  missingFields: string[];
}

interface LinkedInJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  jobId: string | null;
}

// ─── Shared input style ───────────────────────────────────────────────────────

// Shared form-control size and style (globals.css .field), so every input,
// select and textarea on this page matches the rest of the app.
const inp = 'field';

// ─── Tips / facts ─────────────────────────────────────────────────────────────

const COVER_LETTER_FACTS = [
  "Open with why this company and this role, not with 'I am writing to apply'.",
  "A useful shape: a problem they have, what you did about something like it, and how it went.",
  "Use the numbers from your own resume. A specific result reads better than a general claim.",
  "Lead with verbs like built, led and created rather than 'responsible for'.",
  "Keep paragraphs short. Many people read letters on a phone.",
  "Match the company's tone: plainer for a startup, more formal for a large firm.",
  "Three paragraphs is enough: why them, why you, and what happens next.",
  "Their About page or a recent post often gives you one specific line to mention.",
  "Address the hiring manager by name when you can find it.",
];

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ used, limit }: { used: number; limit: number }) {
  return (
    <section className="glass-card p-6 sm:p-8 animate-fade-in-up">
      <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />{used} of {limit} cover letters used this month
      </span>
      <h2 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-white mt-4">You have used this month&apos;s cover letters</h2>
      <p className="text-[13.5px] text-[var(--text-3)] mt-2 max-w-lg">Your limit resets on your billing date. Upgrade for more now, or buy a pack. Letters written in the Apply flow use your tailored applications instead.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <Link href="/pricing" className="btn-primary">See plans <ArrowRight className="w-4 h-4" /></Link>
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AuthenticityPanel({ a, companyName }: { a: Authenticity; companyName: string }) {
  const head = {
    ready:  { text: 'Reads like you, and every claim is in your resume', cls: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.05]' },
    review: { text: 'Worth a quick read before you send it', cls: 'text-amber-300 border-amber-500/25 bg-amber-500/[0.05]' },
    rework: { text: 'Fix these before sending', cls: 'text-red-300 border-red-500/25 bg-red-500/[0.05]' },
  }[a.verdict];
  const numbers = a.unsupported.filter(u => u.kind === 'number');
  const tools = a.unsupported.filter(u => u.kind === 'tool');
  return (
    <div className={`rounded-xl border p-3 ${head.cls}`}>
      <p className="text-xs font-semibold">{head.text}</p>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-300 leading-relaxed">
        {numbers.length > 0 && (
          <li><span className="font-semibold text-red-300">Not in your resume: </span>{numbers.map(n => n.text).join(', ')}. Remove these numbers or add them to your resume if they are true. A recruiter will ask.</li>
        )}
        {tools.length > 0 && (
          <li><span className="font-semibold text-amber-300">Check these tools: </span>{tools.map(t => t.text).join(', ')} {tools.length === 1 ? 'is' : 'are'} not in your resume. Fine if the letter says you want to learn {tools.length === 1 ? 'it' : 'them'}, not if it claims experience.</li>
        )}
        {a.aiTells.map(t => (
          <li key={t.phrase}><span className="font-semibold text-amber-300">Sounds like AI: </span>&ldquo;{t.phrase}&rdquo;. {t.suggestion}</li>
        ))}
        {companyName && a.companyMentions === 0 && (
          <li><span className="font-semibold text-amber-300">Generic: </span>the letter never names {companyName}. Add one line on why this company.</li>
        )}
        {a.verdict === 'ready' && (
          <li>No stock AI phrases, every number and tool is in your own material, and it names the company.</li>
        )}
      </ul>
    </div>
  );
}

// ─── Form parts ───────────────────────────────────────────────────────────────

function Part({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="[&+&]:mt-7 [&+&]:pt-6 [&+&]:border-t [&+&]:border-white/[0.06]">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">{n}</span>
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold text-white leading-6">{title}</h2>
          <p className="text-[12.5px] text-[var(--text-4)]">{desc}</p>
        </div>
      </div>
      <div className="space-y-4 sm:pl-9">{children}</div>
    </section>
  );
}

function ReadyChip({ ok, label, neutral }: { ok: boolean; label: string; neutral?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--text-2)]">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : neutral ? 'bg-white/[0.2]' : 'bg-amber-400'}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function CoverLetterGeneratorPage() {
  const [user, loading] = useSupabaseUser();
  const searchParams = useSearchParams();

  const {
    canUseFeature, getRemainingCount, getUsedCount,
    getLimit, refetch: refetchUsage, loading: usageLoading,
  } = useUsageTracking();
  const clUsed  = getUsedCount('coverLetters');
  const clLimit = getLimit('coverLetters');
  const clLeft  = getRemainingCount('coverLetters');
  // Read "unlimited" off the quota table rather than off the plan name: only
  // some features are uncapped on paid plans, and admin is uncapped on all of
  // them without being called 'pro' or 'premium'.
  const clUnlimited = isUnlimited(clLimit);

  const [jobRole,        setJobRole]        = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyName,    setCompanyName]    = useState('');
  const [tone,           setTone]           = useState('professional');

  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [isSaved,         setIsSaved]         = useState(false);
  const [error,           setError]           = useState('');
  const [metadata,        setMetadata]        = useState<CoverLetterMetadata | null>(null);
  const [authenticity,    setAuthenticity]    = useState<Authenticity | null>(null);
  // "Write like me": a sample of the user's own writing, kept on their profile.
  const [writingSample,   setWritingSample]   = useState('');
  const [savedSample,     setSavedSample]     = useState('');
  const [showVoice,       setShowVoice]       = useState(false);
  const [savingSample,    setSavingSample]    = useState(false);

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({
    hasProfile: false, hasResume: false, loading: true,
    userName: '', resumeCount: 0, missingFields: [],
  });

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showToneMenu,     setShowToneMenu]     = useState(false);
  const [showFeedback,     setShowFeedback]     = useState(false);
  const [showNextStep,     setShowNextStep]     = useState(false);  // ← NEW
  const [factIdx,          setFactIdx]          = useState(0);

  const [linkedInJobData, setLinkedInJobData] = useState<LinkedInJobData | null>(null);
  const [autoGenerated,   setAutoGenerated]   = useState(false);

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => setFactIdx(i => (i + 1) % COVER_LETTER_FACTS.length), 4000);
    return () => clearInterval(t);
  }, [isGenerating]);

  useEffect(() => {
    const role        = searchParams.get('role');
    const company     = searchParams.get('company');
    const description = searchParams.get('jobDescription');
    const source      = searchParams.get('source');

    if (role || company || description) {
      if (role)        setJobRole(decodeURIComponent(role));
      if (company)     setCompanyName(decodeURIComponent(company));
      if (description) setJobDescription(decodeURIComponent(description));
      if (source === 'linkedin') toast.success('Job loaded from LinkedIn');
      if (role && description) setAutoGenerated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data.type === 'LINKEDIN_JOB_DATA_RESPONSE' && e.data.data) {
        const job = e.data.data as LinkedInJobData;
        if (e.data.timestamp && Date.now() - e.data.timestamp < 60000) {
          setLinkedInJobData(job);
          setJobRole(job.title || '');
          setCompanyName(job.company || '');
          setJobDescription(job.description || '');
          toast.success(`Job loaded: ${job.title}${job.company ? ` at ${job.company}` : ''}`);
          if (job.title && job.description) setAutoGenerated(true);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    setTimeout(() => window.postMessage({ type: 'GET_LINKEDIN_JOB_DATA' }, window.location.origin), 500);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (autoGenerated && !profileStatus.loading && jobRole && jobDescription && !generatedLetter && !isGenerating) {
      const t = setTimeout(() => handleGenerate(), 500);
      setAutoGenerated(false);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerated, profileStatus.loading, jobRole, jobDescription, generatedLetter, isGenerating]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (showDownloadMenu && !t.closest('.download-dropdown')) setShowDownloadMenu(false);
      if (showToneMenu && !t.closest('.tone-dropdown')) setShowToneMenu(false);
    };
    if (showDownloadMenu || showToneMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDownloadMenu, showToneMenu]);

  const checkProfileStatus = useCallback(async () => {
    if (!user) return;
    try {
      setProfileStatus(p => ({ ...p, loading: true }));
      const res = await fetch('/api/profile');
      if (!res.ok) {
        setProfileStatus({ hasProfile: true, hasResume: false, loading: false,
          userName: (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User',
          resumeCount: 0, missingFields: [] });
        return;
      }
      const data = await res.json();
      const sample = data.user?.extendedData?.writingSample;
      if (typeof sample === 'string') { setWritingSample(sample); setSavedSample(sample); }
      let resumeCount = 0;
      try {
        const rRes = await fetch('/api/resume/list');
        if (rRes.ok) { const rData = await rRes.json(); resumeCount = rData.resumes?.length || 0; }
      } catch { /* ignore */ }

      const missing: string[] = [];
      const p = data.user;
      if (p) {
        if (!p.phone)                                               missing.push('Phone Number');
        if (!p.location)                                            missing.push('Location / Address');
        if (!p.linkedin && !p.github && !p.portfolio)              missing.push('Professional links (LinkedIn/GitHub/Portfolio)');
        if (!p.bio && !p.summary)                                   missing.push('Professional summary');
      }
      setProfileStatus({
        hasProfile: !!data.user, hasResume: resumeCount > 0, loading: false,
        userName: data.user?.name || (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || 'User',
        resumeCount, missingFields: missing,
      });
    } catch {
      setProfileStatus({ hasProfile: true, hasResume: false, loading: false,
        userName: (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User',
        resumeCount: 0, missingFields: [] });
    }
  }, [user]);

  useEffect(() => { checkProfileStatus(); }, [checkProfileStatus]);

  const handleGenerate = async () => {
    if (!jobRole.trim()) { setError('Please enter a job role'); return; }
    if (!canUseFeature('coverLetters')) {
      setError(`You've used all ${clLimit} cover letters in your plan this month. Upgrade for a higher limit.`);
      return;
    }
    setIsGenerating(true); setError(''); setGeneratedLetter(''); setMetadata(null); setAuthenticity(null); setIsSaved(false);
    setShowNextStep(false); // reset on regenerate
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobRole: jobRole.trim(), jobDescription: jobDescription.trim(), companyName: companyName.trim(), tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      if (data.success && data.coverLetter) {
        setGeneratedLetter(data.coverLetter.content);
        setMetadata(data.metadata || null);
        setAuthenticity(data.authenticity || null);
        toast.success('Cover letter generated!');
        await refetchUsage();
        setShowFeedback(true);
        setShowNextStep(true); // ← SHOW NEXT STEP
        if (user?.id) {
          const target = companyName.trim() ? `${jobRole.trim()} at ${companyName.trim()}` : jobRole.trim();
          await NotificationService.createNotification(user.id, 'cover_letter', 'Cover Letter Ready',
            `Your cover letter for ${target} has been generated.`,
            { actionUrl: '/cover-letter', actionLabel: 'View History' });
        }
      } else { throw new Error('Invalid response format'); }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to generate cover letter.';
      setError(reason);
      toast.error('Failed to generate cover letter');
      // Success here writes two notifications. Failure wrote none, so the
      // feed only ever told half the story.
      if (user?.id) {
        NotificationService.notify(
          user.id, 'error', 'Cover letter generation failed',
          `We could not generate your ${jobRole || 'cover'} letter. ${reason}`,
          { actionUrl: '/cover-letter/create', actionLabel: 'Try again' },
        );
      }
    } finally { setIsGenerating(false); }
  };

  const handleSave = async () => {
    if (!user || !generatedLetter) { toast.error('Please generate a cover letter first'); return; }
    setIsSaving(true);
    try {
      const wordCount = generatedLetter.split(/\s+/).filter(w => w.length > 0).length;
      const res = await fetch('/api/cover-letter/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: jobRole.trim(), companyName: companyName.trim() || undefined,
          jobDescription: jobDescription.trim() || undefined,
          tone, content: generatedLetter, wordCount,
          usedResume: metadata?.usedResume || false,
          linkedInJobUrl: linkedInJobData?.url || undefined,
          linkedInJobId:  linkedInJobData?.jobId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const { id } = await res.json();
      setIsSaved(true);
      toast.success('Saved to history!');
      if (user?.id) {
        const target = companyName.trim() ? `${jobRole.trim()} at ${companyName.trim()}` : jobRole.trim();
        await NotificationService.createNotification(user.id, 'cover_letter', 'Cover Letter Saved',
          `Your cover letter for ${target} has been saved.`,
          { actionUrl: `/cover-letter?open=${id}`, actionLabel: 'View Letter' });
      }
    } catch { toast.error('Failed to save cover letter'); }
    finally { setIsSaving(false); }
  };

  const handleCopy = async () => {
    try {
      const plain = generatedLetter.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');
      await navigator.clipboard.writeText(plain);
      setCopied(true); toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    try {
      const res = await fetch('/api/cover-letter/download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: generatedLetter, jobRole, companyName, format }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.${format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowDownloadMenu(false);
      toast.success(`${format.toUpperCase()} downloaded!`);
    } catch { toast.error(`Failed to download ${format.toUpperCase()}`); }
  };

  const handleReset = () => {
    setJobRole(''); setJobDescription(''); setCompanyName('');
    setTone('professional'); setGeneratedLetter(''); setError('');
    setMetadata(null); setIsSaved(false); setLinkedInJobData(null);
    setShowNextStep(false);
  };

  const saveWritingSample = async () => {
    setSavingSample(true);
    try {
      const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writingSample: writingSample.trim().slice(0, 2500) }) });
      if (!res.ok) throw new Error();
      setSavedSample(writingSample.trim().slice(0, 2500));
      toast.success(writingSample.trim() ? 'Saved. Your next letter will match this voice.' : 'Writing sample removed');
    } catch { toast.error('Could not save your writing sample'); } finally { setSavingSample(false); }
  };

  // The letter is model output shaped by a job description that can come from
  // any web page, so it is escaped before any HTML is added. Only http(s)
  // links become anchors; a "javascript:" href never does.
  const convertLinks = (raw: string) =>
    escapeHtml(raw)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>')
      .replace(/(?<!href="|>)(https?:\/\/(?:www\.)?(?:linkedin\.com|github\.com|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})[^\s<]*)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');

  if (loading) {
    return <AnimatedLoader isVisible={true} loadingText="Loading cover letter generator…" showNavigation={true} />;
  }
  if (!user) return null;

  return (
    <div className="space-y-4 pt-4">

      <PageHeader
        title="New Cover Letter" description="A personalised, professional letter for one role" icon={HeaderIcon}
        actions={<>
          <span className="btn-pill"><Shield /> {usageLoading ? <span aria-hidden="true" className="inline-block w-10 h-3 rounded bg-current opacity-25 animate-pulse" /> : clUnlimited ? 'Unlimited' : `${clLeft} left`}</span>
          <SeeExampleButton serviceId="cover-letter" />
          <Link href="/cover-letter" className="btn-secondary"><History /> History</Link>
        </>}
      />

      {/* Limit reached */}
      {!canUseFeature('coverLetters') ? (
        <UpgradeGate used={clUsed} limit={clLimit} />
      ) : (
        <>
          {/* Imported from LinkedIn */}
          {(linkedInJobData || (searchParams.get('source') === 'linkedin' && jobRole)) && (
            <div className="glass-card px-5 py-3.5 flex items-center gap-3 animate-fade-in-up">
              <ExternalLink className="w-4 h-4 text-sky-300 flex-shrink-0" />
              <p className="text-[13px] text-[var(--text-2)] min-w-0 truncate">
                <span className="text-[var(--text-4)]">Imported from LinkedIn: </span>
                <span className="text-white font-medium">{linkedInJobData?.title ?? jobRole}</span>
                {(linkedInJobData?.company ?? companyName) && <span className="text-[var(--text-3)]"> at {linkedInJobData?.company ?? companyName}</span>}
                {linkedInJobData?.location && <span className="text-[var(--text-4)]"> · {linkedInJobData.location}</span>}
              </p>
              {linkedInJobData?.url && (
                <a href={linkedInJobData.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex-shrink-0 text-[12.5px] text-[var(--text-3)] hover:text-white inline-flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></a>
              )}
            </div>
          )}

          {/* What the letter is written from */}
          <div className="glass-card px-5 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
            <span className="text-[var(--text-4)]">Written from</span>
            <ReadyChip ok={profileStatus.hasProfile} label={profileStatus.hasProfile ? `${profileStatus.userName || 'Your'} profile` : 'Profile not set up'} />
            <ReadyChip ok={profileStatus.hasResume} label={profileStatus.hasResume ? `${profileStatus.resumeCount} resume${profileStatus.resumeCount === 1 ? '' : 's'}` : 'No resume yet'} />
            <ReadyChip ok={!!savedSample} neutral label={savedSample ? 'Your writing voice' : 'No writing sample'} />
            {(!profileStatus.hasProfile || !profileStatus.hasResume || profileStatus.missingFields.length > 0) && (
              <Link href="/profile" className="ml-auto inline-flex items-center gap-1 text-[var(--text-2)] hover:text-white"
                title={profileStatus.missingFields.length ? `Missing: ${profileStatus.missingFields.join(', ')}` : undefined}>
                {profileStatus.hasResume ? `Add ${profileStatus.missingFields.length || ''} missing profile detail${profileStatus.missingFields.length === 1 ? '' : 's'}`.replace('  ', ' ') : 'Add your resume'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Form and letter */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

            {/* ── Left: the job and the style ── */}
            <div className="glass-card p-5 sm:p-6">
              <Part n={1} title="The job" desc="The full posting gives the closest match to what the employer asks for.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Role" htmlFor="cl-role">
                    <input id="cl-role" type="text" value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder="e.g. Data Analyst" className={inp} required />
                  </Field>
                  <Field label="Company" hint="optional" htmlFor="cl-company">
                    <input id="cl-company" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Stripe" className={inp} />
                  </Field>
                </div>
                <Field label="Job description" hint={jobDescription ? `${jobDescription.length.toLocaleString()} characters` : 'optional'} htmlFor="cl-jd">
                  <AutoTextarea id="cl-jd" value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={6}
                    placeholder="Paste the job description here..." className={`${inp} max-h-[420px] !overflow-y-auto`} />
                </Field>
                {jobDescription.length > 0 && (
                  <button onClick={() => setJobDescription('')} className="-mt-2 text-[12px] text-[var(--text-4)] hover:text-white transition-colors">Clear description</button>
                )}
              </Part>

              <Part n={2} title="The style" desc="How the letter should sound.">
                <Field label="Tone">
                  <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-1.5">
                    {['professional', 'enthusiastic', 'formal', 'friendly', 'confident'].map(t => (
                      <button key={t} type="button" role="radio" aria-checked={tone === t} onClick={() => setTone(t)}
                        className={`h-8 px-3.5 rounded-full text-[12.5px] font-medium capitalize transition-colors ${tone === t ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]' : 'text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] hover:text-white hover:bg-white/[0.04]'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Write like me: the letter copies the voice of something the user wrote. */}
                <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
                  <button type="button" onClick={() => setShowVoice(v => !v)} aria-expanded={showVoice}
                    className="w-full flex items-center justify-between gap-3 px-4 h-11 text-left">
                    <span className="text-[13px] text-[var(--text-1)] flex items-center gap-2">
                      Write like me
                      {savedSample && <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10.5px] text-emerald-200 bg-emerald-400/10">On</span>}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[var(--text-4)] transition-transform ${showVoice ? 'rotate-180' : ''}`} />
                  </button>
                  {showVoice && (
                    <div className="px-4 pb-4 space-y-2.5">
                      <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed">
                        Paste a few paragraphs you wrote yourself: an email, a post, a past cover letter. Letters will match how you sound. Only the voice is used, never the content.
                      </p>
                      <AutoTextarea value={writingSample} onChange={e => setWritingSample(e.target.value)} rows={5} maxLength={2500}
                        placeholder="Something you wrote, in your own words..." className={inp} />
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[var(--text-4)] tabular-nums">{writingSample.length}/2500</span>
                        <button type="button" onClick={saveWritingSample} disabled={savingSample || writingSample.trim() === savedSample.trim()}
                          className="btn-secondary !h-8 !text-[12.5px] disabled:opacity-40">
                          {savingSample ? 'Saving' : writingSample.trim() ? 'Save my voice' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Part>

              {error && (
                <div className="mt-5 flex items-start gap-2 rounded-xl px-4 py-3 bg-rose-500/[0.08] ring-1 ring-inset ring-rose-500/20">
                  <AlertCircle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-rose-200">{error}</p>
                </div>
              )}

              <div className="flex gap-2.5 mt-6 pt-5 border-t border-white/[0.06]">
                <button onClick={handleGenerate} disabled={isGenerating || !jobRole.trim()} className="btn-primary flex-1 justify-center">
                  {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing your letter</> : <><Wand2 className="w-4 h-4" /> {generatedLetter ? 'Write it again' : 'Write my letter'}</>}
                </button>
                {generatedLetter && (
                  <button onClick={handleReset} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /><span className="hidden sm:inline">Start over</span></button>
                )}
              </div>
            </div>

            {/* ── Right: the letter ── */}
            <div className="glass-card p-5 sm:p-6 xl:sticky xl:top-[88px] flex flex-col min-h-[460px]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="font-display text-[15px] font-semibold text-white">Your letter</h2>
                  <p className="text-[12px] text-[var(--text-4)] truncate">
                    {generatedLetter ? `${generatedLetter.split(/\s+/).filter(Boolean).length} words${metadata ? ` · ${metadata.usedResume ? 'written from your resume' : 'no resume used'} · ${(metadata.responseTime / 1000).toFixed(1)}s` : ''}` : 'It appears here, ready to edit and save'}
                  </p>
                </div>
                {generatedLetter && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={handleCopy} title="Copy" aria-label="Copy" className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06] transition-colors">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <div className="relative download-dropdown">
                      <button onClick={() => setShowDownloadMenu(v => !v)} title="Download" aria-label="Download" aria-expanded={showDownloadMenu}
                        className="h-9 px-2 rounded-lg flex items-center gap-1 text-[var(--text-3)] hover:text-white hover:bg-white/[0.06] transition-colors">
                        <Download className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                      </button>
                      {showDownloadMenu && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 z-20 rounded-xl bg-[#151618] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75),0_4px_12px_-4px_rgba(0,0,0,0.4)]">
                          <button onClick={() => handleDownload('pdf')} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-[var(--text-2)] hover:text-white hover:bg-white/[0.05]"><FileDown className="w-4 h-4" /> Download as PDF</button>
                          <button onClick={() => handleDownload('docx')} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-[var(--text-2)] hover:text-white hover:bg-white/[0.05]"><FileDown className="w-4 h-4" /> Download as Word</button>
                        </div>
                      )}
                    </div>
                    {!isSaved ? (
                      <button onClick={handleSave} disabled={isSaving} className="btn-primary !h-9 !text-[13px] disabled:opacity-50">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{isSaving ? 'Saving' : 'Save'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] text-[var(--text-1)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Saved</span>
                    )}
                  </div>
                )}
              </div>

              {isGenerating && (
                <div className="flex-1 flex flex-col justify-center rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] p-6">
                  <div className="space-y-2.5" aria-hidden="true">
                    {[92, 100, 85, 97, 60, 0, 95, 100, 88, 70].map((w, i) => w ? <span key={i} className="block h-2.5 rounded prc-skeleton" style={{ width: `${w}%` }} /> : <span key={i} className="block h-3" />)}
                  </div>
                  <p className="text-[12.5px] text-[var(--text-3)] mt-6 text-center min-h-[40px] animate-fade-in-up" key={factIdx}>{COVER_LETTER_FACTS[factIdx]}</p>
                </div>
              )}

              {!isGenerating && !generatedLetter && (
                <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] p-8 text-center">
                  <span className="w-11 h-11 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center"><FileText className="w-5 h-5 text-[var(--text-4)]" /></span>
                  <p className="text-[14px] text-white mt-4">No letter yet</p>
                  <p className="text-[12.5px] text-[var(--text-4)] mt-1 max-w-xs">Add the role, and the job description if you have it, then press Write my letter.</p>
                </div>
              )}

              {generatedLetter && !isGenerating && (
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <div className="flex-1 overflow-y-auto glass-scrollbar rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] p-5 max-h-[620px]">
                    <div className="text-[13.5px] text-[var(--text-1)] leading-[1.75] whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: convertLinks(generatedLetter) }} />
                  </div>
                  {authenticity && <AuthenticityPanel a={authenticity} companyName={companyName.trim()} />}
                </div>
              )}
            </div>
          </div>

          {/* ── NextStepPrompt - fires after letter is generated ── */}
          {showNextStep && (
            <NextStepPrompt
              trigger="cover_letter_generated"
              context={{ company: companyName.trim() || undefined, jobTitle: jobRole.trim() || undefined }}
              delay={800}
            />
          )}
        </>
      )}

      <UsersFeedback
        page="cover-letter"
        forceOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
    </div>
  );
}