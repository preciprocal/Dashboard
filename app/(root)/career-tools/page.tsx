'use client';
// app/(root)/career-tools/page.tsx
//
// Career Tools: two writing tools on one page. Pick a tool from the two cards
// at the top; the form sits on the left and its results on the right. Before
// anything is run, the right side says what the tool gives back.
import PageHeader from '@/components/PageHeader';

import React, { useState, useEffect } from 'react';
import AutoTextarea from '@/components/ui/auto-textarea';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import {
  Loader2, Copy, Check, RefreshCw, XCircle, Zap, Star, AlertTriangle, CheckCircle2,
  ChevronDown, Sparkles, TrendingUp, Search, MessageSquare, Target, Info, ArrowRight,
  Users, Edit3, Send, Gauge, ListChecks, Mail,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { isUnlimited } from '@/lib/config/usage-limits';
import { SeeExampleButton } from '@/components/ServiceModal';
import { AppSelect } from '@/components/ui/select';
import { Field } from '@/components/profile/FormKit';
import { LinkedInIcon, OutlookIcon } from '@/components/icons/BrandIcons';
import { OUTREACH_TEMPLATES } from '@/lib/outreach/templates';
import NextStepPrompt from '@/components/NextStepPrompt';

// Types

interface LinkedInResult {
  overallScore: number; overallVerdict: string;
  headline: { currentScore: number; problem: string; rewritten: string; alternatives: string[]; whyItWorks: string };
  about: { currentScore: number; problems: string[]; rewritten: string; keywordsAdded: string[]; whyItWorks: string };
  seoScore: { current: number; potential: number; missingKeywords: string[]; explanation: string };
  quickWins: Array<{ action: string; impact: 'high' | 'medium'; timeRequired: string; reason: string }>;
  sectionRecommendations: { featuredSection: string; skills: string[]; openToWork: string; profilePhoto: string };
}

interface OutreachVersion { subject: string | null; body: string; approach: string; bestFor?: string; openingHook?: string }
interface OutreachResult {
  primaryMessage: OutreachVersion & { openingHook: string };
  alternativeVersions: (OutreachVersion & { bestFor: string })[];
  followUpTemplate: { timing: string; subject: string; body: string };
  personalizationTips: string[]; doNotDo: string[]; responseRateAdvice: string;
}

type Tool = 'linkedin' | 'outreach';

// Small parts

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success('Copied to clipboard'); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium text-[var(--text-3)] hover:text-white bg-white/[0.03] hover:bg-white/[0.07] ring-1 ring-inset ring-white/[0.07] transition-colors flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

const scoreTone = (s: number) => (s >= 75 ? { c: '#34d399', t: 'Strong' } : s >= 50 ? { c: '#fbbf24', t: 'Needs work' } : { c: '#f87171', t: 'Weak' });

function ScoreRing({ score }: { score: number }) {
  const r = 30; const circ = 2 * Math.PI * r; const { c } = scoreTone(score);
  return (
    <div className="relative w-[76px] h-[76px] flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={c} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[19px] font-semibold text-white tabular-nums leading-none">{score}</span>
        <span className="text-[10px] text-[var(--text-5)] mt-0.5">of 100</span>
      </div>
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const { c } = scoreTone(score);
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] tabular-nums">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{score}/100
    </span>
  );
}

function Collapsible({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 h-12 hover:bg-white/[0.02] transition-colors">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-white">{title}</span>
          {badge && <span className="text-[11px] tabular-nums text-[var(--text-4)]">{badge}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-4)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

/** A result block: a titled card with an optional right-side detail. */
function Card({ icon: Icon, title, aside, children }: { icon?: React.ElementType; title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5">
      {title && (
        <header className="flex items-center justify-between gap-3 mb-4">
          <h3 className="flex items-center gap-2.5 text-[14px] font-semibold text-white">
            {Icon && <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]"><Icon className="w-3.5 h-3.5 text-[var(--text-2)]" /></span>}
            {title}
          </h3>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]';

/** A block of text to use, with its label and a copy button. */
function TextBlock({ label, text, copyLabel, strong }: { label: string; text: string; copyLabel?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.07]">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span className={eyebrow}>{label}</span>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <p className={`px-4 pb-4 pt-2 leading-relaxed whitespace-pre-wrap ${strong ? 'text-[14.5px] text-white font-medium' : 'text-[13.5px] text-[var(--text-1)]'}`}>{text}</p>
    </div>
  );
}

// LinkedIn results

function LinkedInResults({ data }: { data: LinkedInResult }) {
  const tone = scoreTone(data.overallScore);
  return (
    <div className="space-y-4">
      <section className="glass-card p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <ScoreRing score={data.overallScore} />
          <div className="flex-1 min-w-0">
            <p className={eyebrow}>Profile strength</p>
            <p className="font-display text-[20px] font-semibold tracking-[-0.01em] text-white mt-1">{tone.t}</p>
            <p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed line-clamp-2">{data.overallVerdict}</p>
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] text-[var(--text-3)] flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Search visibility</span>
            <span className="text-[12.5px] text-white tabular-nums">{data.seoScore.current}<span className="text-[var(--text-5)] mx-1.5">to</span><span className="text-emerald-300">{data.seoScore.potential}</span></span>
          </div>
          <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-emerald-400/30 rounded-full" style={{ width: `${data.seoScore.potential}%` }} />
            <div className="absolute inset-y-0 left-0 bg-white/60 rounded-full" style={{ width: `${data.seoScore.current}%` }} />
          </div>
          <p className="text-[12.5px] text-[var(--text-4)] mt-2.5 leading-relaxed">{data.seoScore.explanation}</p>
        </div>
      </section>

      <Card icon={Edit3} title="Headline" aside={<ScoreChip score={data.headline.currentScore} />}>
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-500/[0.05] ring-1 ring-inset ring-rose-500/15">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-300 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{data.headline.problem}</p>
          </div>
          <TextBlock label="Rewritten" text={data.headline.rewritten} strong />
          {data.headline.whyItWorks && <p className="text-[12.5px] text-[var(--text-4)] leading-relaxed px-1">{data.headline.whyItWorks}</p>}
        </div>
        {data.headline.alternatives?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className={`${eyebrow} mb-2.5`}>Other options</p>
            <ul className="space-y-2">
              {data.headline.alternatives.map((alt, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.06]">
                  <p className="text-[13px] text-[var(--text-1)] flex-1 leading-relaxed">{alt}</p>
                  <CopyButton text={alt} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card icon={Users} title="About section" aside={<ScoreChip score={data.about.currentScore} />}>
        {data.about.problems?.length > 0 && (
          <ul className="space-y-2 mb-3">
            {data.about.problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-rose-500/[0.05] ring-1 ring-inset ring-rose-500/15">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-300 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{p}</p>
              </li>
            ))}
          </ul>
        )}
        <TextBlock label="Rewritten" text={data.about.rewritten} copyLabel="Copy all" />
        {data.about.keywordsAdded?.length > 0 && (
          <div className="mt-4">
            <p className={`${eyebrow} mb-2`}>Keywords added</p>
            <div className="flex flex-wrap gap-1.5">
              {data.about.keywordsAdded.map((kw, i) => (
                <span key={i} className="text-[12px] h-6 inline-flex items-center px-2.5 bg-white/[0.04] text-[var(--text-2)] ring-1 ring-inset ring-white/[0.08] rounded-md">{kw}</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {data.quickWins?.length > 0 && (
        <Card icon={Zap} title="Quick wins">
          <ol className="divide-y divide-white/[0.05]">
            {data.quickWins.map((win, i) => (
              <li key={i} className="flex items-start gap-3.5 py-3 first:pt-0 last:pb-0">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11.5px] font-semibold tabular-nums flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] text-[var(--text-2)]">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13.5px] font-medium text-white">{win.action}</p>
                    {win.impact === 'high' && <span className="text-[10.5px] font-medium px-1.5 h-5 inline-flex items-center rounded bg-amber-400/10 text-amber-300">High impact</span>}
                    {win.timeRequired && <span className="text-[11.5px] text-[var(--text-5)]">{win.timeRequired}</span>}
                  </div>
                  <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed mt-0.5">{win.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Collapsible title="Missing keywords" badge={`${data.seoScore.missingKeywords?.length || 0}`}>
        <div className="flex flex-wrap gap-1.5 pt-3">
          {data.seoScore.missingKeywords?.map((kw, i) => (
            <span key={i} className="text-[12px] h-6 inline-flex items-center px-2.5 bg-white/[0.03] text-[var(--text-3)] ring-1 ring-inset ring-white/[0.08] rounded-md">{kw}</span>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Skills and sections" badge={`${data.sectionRecommendations?.skills?.length || 0}`}>
        <div className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {data.sectionRecommendations?.skills?.map((s, i) => (
              <span key={i} className="text-[12px] h-6 inline-flex items-center px-2.5 bg-white/[0.04] text-[var(--text-2)] ring-1 ring-inset ring-white/[0.08] rounded-md">{s}</span>
            ))}
          </div>
          {[
            { label: 'Open to work', val: data.sectionRecommendations?.openToWork },
            { label: 'Profile photo', val: data.sectionRecommendations?.profilePhoto },
            { label: 'Featured section', val: data.sectionRecommendations?.featuredSection },
          ].filter(x => x.val).map((x, i) => (
            <div key={i} className="px-4 py-3 rounded-xl bg-white/[0.02] ring-1 ring-inset ring-white/[0.06]">
              <p className={`${eyebrow} mb-1`}>{x.label}</p>
              <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{x.val}</p>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

// Outreach results

function OutreachResults({ data, platform }: { data: OutreachResult; platform: string }) {
  const [activeVersion, setActiveVersion] = useState<'primary' | 0 | 1>('primary');
  const activeMsg = activeVersion === 'primary' ? data.primaryMessage : data.alternativeVersions[activeVersion as 0 | 1];
  const versions = [
    { key: 'primary' as const, label: 'Recommended' },
    ...(data.alternativeVersions || []).map((_, i) => ({ key: i as 0 | 1, label: `Option ${i + 2}` })),
  ];

  return (
    <div className="space-y-4">
      <Card icon={MessageSquare} title={platform === 'linkedin' ? 'LinkedIn messages' : 'Cold emails'}
        aside={
          <div role="tablist" aria-label="Versions" className="inline-flex p-0.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
            {versions.map(tab => (
              <button key={String(tab.key)} type="button" role="tab" aria-selected={activeVersion === tab.key} onClick={() => setActiveVersion(tab.key)}
                className={`h-7 px-2.5 sm:px-3 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${activeVersion === tab.key ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        }>
        {activeMsg && (
          <div className="space-y-3">
            {(activeMsg.approach || ('bestFor' in activeMsg && activeMsg.bestFor)) && (
              <div className={`grid grid-cols-1 gap-2 ${activeMsg.approach && 'bestFor' in activeMsg && activeMsg.bestFor ? 'sm:grid-cols-2' : ''}`}>
                {activeMsg.approach && (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.06]">
                    <Info className="w-3.5 h-3.5 text-[var(--text-4)] flex-shrink-0 mt-0.5" />
                    <p className="text-[12.5px] text-[var(--text-2)] leading-relaxed"><span className="text-[var(--text-4)]">Approach: </span>{activeMsg.approach}</p>
                  </div>
                )}
                {'bestFor' in activeMsg && activeMsg.bestFor && (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.06]">
                    <Target className="w-3.5 h-3.5 text-[var(--text-4)] flex-shrink-0 mt-0.5" />
                    <p className="text-[12.5px] text-[var(--text-2)] leading-relaxed"><span className="text-[var(--text-4)]">Best when: </span>{activeMsg.bestFor}</p>
                  </div>
                )}
              </div>
            )}
            {platform === 'email' && activeMsg.subject && <TextBlock label="Subject line" text={activeMsg.subject} strong />}
            <TextBlock label="Message" text={activeMsg.body} copyLabel="Copy message" />
            {'openingHook' in activeMsg && activeMsg.openingHook && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-400/[0.05] ring-1 ring-inset ring-amber-400/15">
                <Star className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[var(--text-2)] leading-relaxed"><span className="text-amber-200">Opening hook: </span>&ldquo;{activeMsg.openingHook}&rdquo;</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {data.followUpTemplate && (
        <Card icon={RefreshCw} title="Follow-up" aside={data.followUpTemplate.timing ? <span className="text-[12px] text-[var(--text-4)] text-right max-w-[50%] truncate" title={data.followUpTemplate.timing}>{data.followUpTemplate.timing}</span> : undefined}>
          <div className="space-y-3">
            {platform === 'email' && data.followUpTemplate.subject && <TextBlock label="Subject" text={data.followUpTemplate.subject} />}
            <TextBlock label="Message" text={data.followUpTemplate.body} />
          </div>
        </Card>
      )}

      {(data.personalizationTips?.length > 0 || data.doNotDo?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.personalizationTips?.length > 0 && (
            <Card icon={CheckCircle2} title="Make it personal">
              <ul className="space-y-2.5">
                {data.personalizationTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-2)] leading-relaxed"><Check className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 mt-1" />{tip}</li>
                ))}
              </ul>
            </Card>
          )}
          {data.doNotDo?.length > 0 && (
            <Card icon={XCircle} title="Avoid">
              <ul className="space-y-2.5">
                {data.doNotDo.map((dont, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-2)] leading-relaxed"><XCircle className="w-3.5 h-3.5 text-rose-300 flex-shrink-0 mt-1" />{dont}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {data.responseRateAdvice && (
        <Card icon={TrendingUp} title="What to expect">
          <p className="text-[13.5px] text-[var(--text-2)] leading-relaxed">{data.responseRateAdvice}</p>
        </Card>
      )}
    </div>
  );
}

// States

function LoadingCard({ icon: Icon, message, sub }: { icon: React.ElementType; message: string; sub: string }) {
  return (
    <section className="glass-card flex flex-col items-center justify-center text-center py-20 px-6 h-full min-h-[420px]">
      <div className="relative w-14 h-14 rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--text-2)]" />
        <Loader2 className="absolute -right-1.5 -bottom-1.5 w-5 h-5 text-white animate-spin bg-[var(--bg-raised)] rounded-full p-0.5" />
      </div>
      <p className="text-[14.5px] font-medium text-white mt-5">{message}</p>
      <p className="text-[12.5px] text-[var(--text-4)] mt-1 max-w-sm">{sub}</p>
      <div className="w-48 h-1 rounded-full bg-white/[0.06] overflow-hidden mt-6"><div className="h-full w-1/3 rounded-full bg-white/60 animate-[ctSweep_1.4s_ease-in-out_infinite]" /><style>{'@keyframes ctSweep{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style></div>
    </section>
  );
}

/** Before a first run: what the tool gives back, as three numbered parts. */
function WhatYouGet({ tool }: { tool: Tool }) {
  const li = tool === 'linkedin';
  const items = li
    ? [
        { icon: Gauge, title: 'A profile score', text: 'How strong your headline and About read for your target role, and how visible they are in search.' },
        { icon: Edit3, title: 'Rewrites to copy', text: 'A new headline with other options, and a rewritten About section with the keywords it adds.' },
        { icon: ListChecks, title: 'Quick wins', text: 'Small changes to make next, plus missing keywords and skills to add.' },
      ]
    : [
        { icon: Mail, title: 'Messages to send', text: 'A recommended message and other versions, each written for the person and company you name.' },
        { icon: RefreshCw, title: 'A follow-up', text: 'A short follow-up for when you have not heard back, with when to send it.' },
        { icon: CheckCircle2, title: 'What to change', text: 'Ways to make it more personal, and what to avoid.' },
      ];
  return (
    <section className="glass-card h-full min-h-[420px] flex flex-col justify-center p-6 sm:p-10">
      <span className="w-11 h-11 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center">
        {li ? <LinkedInIcon className="w-5 h-5" /> : <Send className="w-5 h-5 text-[var(--text-2)]" />}
      </span>
      <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-white mt-5">{li ? 'Your results show up here' : 'Your messages show up here'}</h2>
      <p className="text-[13.5px] text-[var(--text-3)] mt-1.5 max-w-md leading-relaxed">
        {li ? 'Paste your current headline or About section and choose Optimise profile.' : 'Name the company or the person’s role, add what you know about them, and choose Write messages.'}
      </p>
      <ol className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-3">
        {items.map(({ icon: I, title, text }, i) => (
          <li key={title} className="rounded-xl p-4 bg-white/[0.02] ring-1 ring-inset ring-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]"><I className="w-4 h-4 text-[var(--text-2)]" /></span>
              <span className="text-[11px] font-medium tabular-nums text-[var(--text-5)]">0{i + 1}</span>
            </div>
            <p className="text-[13.5px] font-medium text-white mt-3">{title}</p>
            <p className="text-[12.5px] text-[var(--text-4)] mt-1 leading-relaxed">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function UpgradeGate({ feature, used, limit }: { feature: Tool; used: number; limit: number }) {
  const isLI = feature === 'linkedin';
  return (
    <section className="glass-card p-6 sm:p-10 h-full min-h-[420px] flex flex-col justify-center animate-fade-in-up">
      <span className="self-start inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />{used} of {limit} {isLI ? 'optimisations' : 'messages'} used this month
      </span>
      <h2 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-white mt-4">
        {isLI ? "You have used this month's LinkedIn optimisations" : "You have used this month's outreach messages"}
      </h2>
      <p className="text-[13.5px] text-[var(--text-3)] mt-2 max-w-lg">Your limit resets on your billing date. Upgrade for more now.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <Link href="/pricing" className="btn-primary">See plans <ArrowRight className="w-4 h-4" /></Link>
        {!isLI && <Link href="/templates/outreach" className="btn-secondary">Browse outreach templates</Link>}
      </div>
    </section>
  );
}

// Tool picker: two cards, each with what it does and what is left this month.

function ToolPicker({ active, setActive, usage }: { active: Tool; setActive: (v: Tool) => void; usage: Record<Tool, React.ReactNode> }) {
  const tools = [
    { id: 'linkedin' as const, title: 'LinkedIn profile', desc: 'Score your headline and About section, and get rewrites to paste in.', icon: <LinkedInIcon className="w-5 h-5" /> },
    { id: 'outreach' as const, title: 'Cold outreach', desc: 'Write an email or LinkedIn message to a recruiter, hiring manager or alum.', icon: <Send className="w-[18px] h-[18px] text-[var(--text-2)]" /> },
  ];
  return (
    <div role="tablist" aria-label="Tool" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {tools.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setActive(t.id)}
            className={`group relative text-left flex items-start gap-4 p-4 sm:p-5 rounded-2xl transition-all ${on
              ? 'bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),0_8px_24px_-12px_rgba(0,0,0,0.6)]'
              : 'bg-white/[0.015] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'}`}>
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset transition-colors ${on ? 'bg-white/[0.08] ring-white/[0.14]' : 'bg-white/[0.03] ring-white/[0.07]'}`}>{t.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between gap-3">
                <span className={`text-[14.5px] font-semibold ${on ? 'text-white' : 'text-[var(--text-2)]'}`}>{t.title}</span>
                <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-white text-black' : 'ring-1 ring-inset ring-white/[0.15]'}`}>
                  {on && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
              </span>
              <span className="block text-[12.5px] text-[var(--text-4)] mt-1 leading-relaxed">{t.desc}</span>
              <span className="block text-[11.5px] text-[var(--text-5)] mt-2.5 tabular-nums">{usage[t.id]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Form parts

const inp = 'field w-full';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 pt-5 first:pt-0 border-t border-white/[0.06] first:border-t-0">
      <legend className={`${eyebrow} float-left w-full mb-4`}>{title}</legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-rose-500/[0.06] ring-1 ring-inset ring-rose-500/20">
      <AlertTriangle className="w-3.5 h-3.5 text-rose-300 flex-shrink-0 mt-0.5" />
      <p className="text-[12.5px] text-rose-200 leading-relaxed">{message}</p>
    </div>
  );
}

function SubmitButton({ onClick, loading, disabled, loadingLabel, label }: { onClick: () => void; loading: boolean; disabled: boolean; loadingLabel: string; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled} className="btn-primary w-full !h-11 justify-center">
      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}</> : <><Sparkles className="w-4 h-4" /> {label}</>}
    </button>
  );
}

// LinkedIn form

interface LIFormProps { headline: string; setHeadline: (v: string) => void; about: string; setAbout: (v: string) => void; experience: string; setExperience: (v: string) => void; targetRole: string; setTargetRole: (v: string) => void; industry: string; setIndustry: (v: string) => void; onSubmit: () => void; loading: boolean; error: string; ready: boolean }

function LinkedInForm({ headline, setHeadline, about, setAbout, experience, setExperience, targetRole, setTargetRole, industry, setIndustry, onSubmit, loading, error, ready }: LIFormProps) {
  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} />}
      <Group title="Your profile now">
        <Field label="Headline" htmlFor="li-headline"><input id="li-headline" type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Data analyst | SQL, Python, Tableau" className={inp} /></Field>
        <Field label="About" hint="Leave blank if you have none" htmlFor="li-about"><AutoTextarea id="li-about" rows={5} value={about} onChange={e => setAbout(e.target.value)} placeholder="Paste your current About section" className={inp} /></Field>
        <Field label="Most recent role" hint="Optional" htmlFor="li-exp"><AutoTextarea id="li-exp" rows={2} value={experience} onChange={e => setExperience(e.target.value)} placeholder="e.g. Built dashboards for the sales team as a data intern" className={inp} /></Field>
      </Group>
      <Group title="What you are aiming for">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Target role" htmlFor="li-role"><input id="li-role" type="text" value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Data analyst" className={inp} /></Field>
          <Field label="Industry" htmlFor="li-ind"><input id="li-ind" type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Fintech" className={inp} /></Field>
        </div>
      </Group>
      <SubmitButton onClick={onSubmit} loading={loading} disabled={!ready} loadingLabel="Analysing..." label="Optimise profile" />
      {!ready && <p className="text-[11.5px] text-[var(--text-5)] text-center -mt-2">Add your headline or About section to start.</p>}
    </div>
  );
}

// Outreach form

interface ORFormProps { type: string; setType: (v: string) => void; recipName: string; setRecipName: (v: string) => void; recipRole: string; setRecipRole: (v: string) => void; company: string; setCompany: (v: string) => void; context: string; setContext: (v: string) => void; background: string; setBackground: (v: string) => void; jobTitle: string; setJobTitle: (v: string) => void; jobDesc: string; setJobDesc: (v: string) => void; platform: string; setPlatform: (v: string) => void; tone: string; setTone: (v: string) => void; onSubmit: () => void; loading: boolean; error: string; ready: boolean }

function Segmented({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string; icon?: React.ElementType }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex p-0.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
      {options.map(o => {
        const on = value === o.id; const I = o.icon;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
            className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-md text-[12.5px] font-medium transition-colors ${on ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`}>
            {I && <I className="w-4 h-4 flex-shrink-0" />}<span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function OutreachForm({ type, setType, recipName, setRecipName, recipRole, setRecipRole, company, setCompany, context, setContext, background, setBackground, jobTitle, setJobTitle, jobDesc, setJobDesc, platform, setPlatform, tone, setTone, onSubmit, loading, error, ready }: ORFormProps) {
  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} />}
      <Group title="The message">
        <Field label="Send by"><Segmented label="Platform" value={platform} onChange={setPlatform} options={[{ id: 'email', label: 'Email', icon: OutlookIcon }, { id: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon }]} /></Field>
        <Field label="Purpose">
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'job-inquiry', label: 'Job inquiry' }, { id: 'referral-request', label: 'Referral request' }, { id: 'networking', label: 'Networking' }, { id: 'follow-up', label: 'After applying' }].map(t => (
              <button key={t.id} type="button" onClick={() => setType(t.id)} aria-pressed={type === t.id}
                className={`h-9 px-3 rounded-lg text-[12.5px] font-medium text-left transition-colors ring-1 ring-inset ${type === t.id ? 'bg-white/[0.08] text-white ring-white/[0.16]' : 'text-[var(--text-3)] ring-white/[0.07] hover:text-white hover:bg-white/[0.03]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tone">
          <AppSelect value={tone} onValueChange={setTone} aria-label="Tone" options={[
            { value: 'professional', label: 'Professional' },
            { value: 'casual', label: 'Casual' },
            { value: 'bold', label: 'Bold and direct' },
          ]} />
        </Field>
      </Group>
      <Group title="Who it is for">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name" hint="Optional" htmlFor="or-name"><input id="or-name" type="text" value={recipName} onChange={e => setRecipName(e.target.value)} placeholder="Sarah Chen" className={inp} /></Field>
          <Field label="Their role" htmlFor="or-role"><input id="or-role" type="text" value={recipRole} onChange={e => setRecipRole(e.target.value)} placeholder="Engineering manager" className={inp} /></Field>
        </div>
        <Field label="Company" htmlFor="or-company"><input id="or-company" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Stripe" className={inp} /></Field>
        <Field label="What you know about them" hint="Makes it personal" htmlFor="or-ctx">
          <AutoTextarea id="or-ctx" rows={2} value={context} onChange={e => setContext(e.target.value)} placeholder="A recent post, a mutual connection, a shared school or project" className={inp} />
        </Field>
      </Group>
      {(type === 'job-inquiry' || type === 'follow-up') && (
        <Group title="The job">
          <Field label="Job title" htmlFor="or-job"><input id="or-job" type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Data analyst" className={inp} /></Field>
          <Field label="Job description" hint="Optional" htmlFor="or-jd"><AutoTextarea id="or-jd" rows={3} value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste the key requirements" className={inp} /></Field>
        </Group>
      )}
      <Group title="About you">
        <Field label="Your background" hint="Uses your profile if blank" htmlFor="or-bg"><AutoTextarea id="or-bg" rows={2} value={background} onChange={e => setBackground(e.target.value)} placeholder="e.g. MS in Business Analytics, interned on a pricing team" className={inp} /></Field>
      </Group>
      <SubmitButton onClick={onSubmit} loading={loading} disabled={!ready} loadingLabel="Writing..." label="Write messages" />
      {!ready && <p className="text-[11.5px] text-[var(--text-5)] text-center -mt-2">Add the company or their role to start.</p>}
      <Link href="/templates/outreach" className="flex items-center justify-between gap-3 px-3.5 h-10 rounded-lg text-[12.5px] text-[var(--text-3)] hover:text-white ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.03] transition-colors">
        <span className="truncate">Or start from one of {OUTREACH_TEMPLATES.length} templates</span>
        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
      </Link>
    </div>
  );
}

// Page

export default function CareerToolsPage() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();

  const {
    canUseFeature, getRemainingCount, getUsedCount,
    getLimit, refetch: refetchUsage, loading: usageLoading,
  } = useUsageTracking();
  const liUsed  = getUsedCount('linkedinOptimisations');
  const liLimit = getLimit('linkedinOptimisations');
  const liLeft  = getRemainingCount('linkedinOptimisations');
  const orUsed  = getUsedCount('coldOutreach');
  const orLimit = getLimit('coldOutreach');
  const orLeft  = getRemainingCount('coldOutreach');
  // Read "unlimited" off the quota table rather than off the plan name, and do
  // it per feature: these two are capped independently.
  const liUnlimited = isUnlimited(liLimit);
  const orUnlimited = isUnlimited(orLimit);

  const [activeTool, setActiveTool] = useState<Tool>('linkedin');
  // ?tool=outreach opens Cold Outreach directly (the outreach template
  // library links here). Read after mount so the server render matches.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tool') === 'outreach') setActiveTool('outreach');
  }, []);

  const [liHeadline, setLiHeadline] = useState('');
  const [liAbout, setLiAbout] = useState('');
  const [liExperience, setLiExperience] = useState('');
  const [liTargetRole, setLiTargetRole] = useState('');
  const [liIndustry, setLiIndustry] = useState('');
  const [liLoading, setLiLoading] = useState(false);
  const [liError, setLiError] = useState('');
  const [liResult, setLiResult] = useState<LinkedInResult | null>(null);
  const [liNextStep, setLiNextStep] = useState(false);

  const [orType, setOrType] = useState('job-inquiry');
  const [orRecipName, setOrRecipName] = useState('');
  const [orRecipRole, setOrRecipRole] = useState('');
  const [orCompany, setOrCompany] = useState('');
  const [orContext, setOrContext] = useState('');
  const [orBackground, setOrBackground] = useState('');
  const [orJobTitle, setOrJobTitle] = useState('');
  const [orJobDesc, setOrJobDesc] = useState('');
  const [orPlatform, setOrPlatform] = useState('email');
  const [orTone, setOrTone] = useState('professional');
  const [orLoading, setOrLoading] = useState(false);
  const [orError, setOrError] = useState('');
  const [orResult, setOrResult] = useState<OutreachResult | null>(null);
  const [orNextStep, setOrNextStep] = useState(false);

  // "Write a message" on the Contacts page links here with the recipient as
  // ?name=&role=&company=&platform=. Read-only and optional: links without
  // them (the template library's) behave exactly as before.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tool') !== 'outreach') return;
    const name = p.get('name'), role = p.get('role'), company = p.get('company'), platform = p.get('platform');
    if (name) setOrRecipName(name.slice(0, 120));
    if (role) setOrRecipRole(role.slice(0, 160));
    if (company) setOrCompany(company.slice(0, 160));
    if (platform === 'email' || platform === 'linkedin') setOrPlatform(platform);
  }, []);

  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/sign-in'); }, [user, loading, router]);

  // Switching tools hides the other tool's next-step prompt.
  const handleToolChange = (v: Tool) => {
    setActiveTool(v);
    setLiNextStep(false);
    setOrNextStep(false);
  };

  const handleLinkedIn = async () => {
    if (!canUseFeature('linkedinOptimisations')) {
      setLiError(`You've used all ${liLimit} LinkedIn optimisations in your plan this month. Upgrade for a higher limit.`);
      return;
    }
    if (!liHeadline.trim() && !liAbout.trim()) { setLiError('Enter at least your headline or about section'); return; }
    setLiLoading(true); setLiError(''); setLiResult(null); setLiNextStep(false);
    try {
      const res = await fetch('/api/career-tools/linkedin-optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: liHeadline, about: liAbout, experience: liExperience, targetRole: liTargetRole, targetIndustry: liIndustry }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(e.error || `HTTP ${res.status}`); }
      const result = (await res.json()).data as LinkedInResult;
      setLiResult(result);
      await refetchUsage();
      setShowFeedback(true);
      setLiNextStep(true);
      if (user?.id) {
        const label = result.overallScore >= 75 ? 'Strong' : result.overallScore >= 50 ? 'Needs Work' : 'Needs Improvement';
        await NotificationService.createNotification(user.id, 'system', 'LinkedIn profile optimised', `Your profile scored ${result.overallScore}/100 (${label}).`, { actionUrl: '/career-tools', actionLabel: 'View Results' });
      }
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : 'Something went wrong.';
      setLiError(reason);
      if (user?.id) {
        NotificationService.notify(user.id, 'error', 'LinkedIn optimisation failed',
          reason, { actionUrl: '/career-tools', actionLabel: 'Try again' });
      }
    }
    finally { setLiLoading(false); }
  };

  const handleOutreach = async () => {
    if (!canUseFeature('coldOutreach')) {
      setOrError(`You've used all ${orLimit} outreach messages in your plan this month. Upgrade for a higher limit.`);
      return;
    }
    if (!orCompany.trim() && !orRecipRole.trim()) { setOrError('Enter at least the recipient company or role'); return; }
    setOrLoading(true); setOrError(''); setOrResult(null); setOrNextStep(false);
    try {
      const res = await fetch('/api/career-tools/cold-outreach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreachType: orType, recipientName: orRecipName, recipientRole: orRecipRole, recipientCompany: orCompany, recipientContext: orContext, senderBackground: orBackground, jobTitle: orJobTitle, jobDescription: orJobDesc, platform: orPlatform, tone: orTone }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(e.error || `HTTP ${res.status}`); }
      const result = (await res.json()).data as OutreachResult;
      setOrResult(result);
      await refetchUsage();
      setShowFeedback(true);
      setOrNextStep(true);
      if (user?.id) {
        const target = orRecipName ? `${orRecipName}${orCompany ? ` at ${orCompany}` : ''}` : orCompany || orRecipRole || 'your target';
        await NotificationService.createNotification(user.id, 'system', `${orPlatform === 'linkedin' ? 'LinkedIn' : 'Email'} outreach ready`, `Your messages for ${target} are ready.`, { actionUrl: '/career-tools', actionLabel: 'View Messages' });
      }
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : 'Something went wrong.';
      setOrError(reason);
      if (user?.id) {
        NotificationService.notify(user.id, 'error', 'Outreach generation failed',
          reason, { actionUrl: '/career-tools', actionLabel: 'Try again' });
      }
    }
    finally { setOrLoading(false); }
  };

  const isLI = activeTool === 'linkedin';

  const liFormProps: LIFormProps = { headline: liHeadline, setHeadline: setLiHeadline, about: liAbout, setAbout: setLiAbout, experience: liExperience, setExperience: setLiExperience, targetRole: liTargetRole, setTargetRole: setLiTargetRole, industry: liIndustry, setIndustry: setLiIndustry, onSubmit: handleLinkedIn, loading: liLoading, error: liError, ready: !!(liHeadline.trim() || liAbout.trim()) };
  const orFormProps: ORFormProps = { type: orType, setType: setOrType, recipName: orRecipName, setRecipName: setOrRecipName, recipRole: orRecipRole, setRecipRole: setOrRecipRole, company: orCompany, setCompany: setOrCompany, context: orContext, setContext: setOrContext, background: orBackground, setBackground: setOrBackground, jobTitle: orJobTitle, setJobTitle: setOrJobTitle, jobDesc: orJobDesc, setJobDesc: setOrJobDesc, platform: orPlatform, setPlatform: setOrPlatform, tone: orTone, setTone: setOrTone, onSubmit: handleOutreach, loading: orLoading, error: orError, ready: !!(orCompany.trim() || orRecipRole.trim()) };

  if (loading) {
    return <AnimatedLoader isVisible={true} mode="steps" steps={[{ name: 'Authenticating...', weight: 1 }, { name: 'Loading your profile...', weight: 2 }, { name: 'Preparing tools...', weight: 2 }, { name: 'Ready', weight: 1 }]} currentStep={0} loadingText="Loading Career Tools..." showNavigation={true} />;
  }

  const left = (used: number, limit: number, rem: number, unlimited: boolean) =>
    usageLoading ? <span aria-hidden="true" className="inline-block w-20 h-2.5 rounded bg-white/[0.08] animate-pulse align-middle" />
      : unlimited ? 'Unlimited on your plan' : `${rem} of ${limit} left this month`;
  const usage: Record<Tool, React.ReactNode> = {
    linkedin: left(liUsed, liLimit, liLeft, liUnlimited),
    outreach: left(orUsed, orLimit, orLeft, orUnlimited),
  };

  const results = (() => {
    if (isLI) {
      if (!canUseFeature('linkedinOptimisations') && !liResult) return <UpgradeGate feature="linkedin" used={liUsed} limit={liLimit} />;
      if (liLoading) return <LoadingCard icon={LinkedInIcon} message="Reading your LinkedIn profile" sub="Scoring it for search and rewriting your headline and About section." />;
      if (liResult) return (
        <>
          <LinkedInResults data={liResult} />
          {liNextStep && <NextStepPrompt trigger="linkedin_optimised" context={{}} delay={800} className="mt-4" />}
        </>
      );
      return <WhatYouGet tool="linkedin" />;
    }
    if (!canUseFeature('coldOutreach') && !orResult) return <UpgradeGate feature="outreach" used={orUsed} limit={orLimit} />;
    if (orLoading) return <LoadingCard icon={Send} message="Writing your messages" sub="A recommended version, other options and a follow-up." />;
    if (orResult) return (
      <>
        <OutreachResults data={orResult} platform={orPlatform} />
        {orNextStep && <NextStepPrompt trigger="outreach_generated" context={{ company: orCompany.trim() || undefined }} delay={800} className="mt-4" />}
      </>
    );
    return <WhatYouGet tool="outreach" />;
  })();

  return (
    <div className="py-4 sm:py-2 space-y-5">
      <PageHeader title="Career Tools" description="Polish your LinkedIn profile and write outreach that gets read" icon={Sparkles}
        actions={<SeeExampleButton serviceId="career-tools" />} />

      <ToolPicker active={activeTool} setActive={handleToolChange} usage={usage} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-5 items-start">
        <aside className="glass-card p-5 sm:p-6 lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-112px)] lg:overflow-y-auto glass-scrollbar">
          <div key={activeTool} className="prc-fade">
            {isLI ? <LinkedInForm {...liFormProps} /> : <OutreachForm {...orFormProps} />}
          </div>
        </aside>
        <div key={`r-${activeTool}`} className="min-w-0 prc-fade">
          {results}
        </div>
      </div>

      {showFeedback && <UsersFeedback page="career-tools" forceOpen onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
