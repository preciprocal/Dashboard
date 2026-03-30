// components/ServiceExampleModal/examples/interview/InterviewPreview.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Volume2, Settings, PhoneOff,
  Users, Clock, CheckCircle2, Crown, Camera, ArrowRight,
  Loader2, Headphones, Target, AlertCircle, BarChart3,
  MessageSquare, Star, TrendingUp, Zap,
} from 'lucide-react';
import { FadeIn, ScoreRing, AnimatedBar, TypingText } from '../../primitives';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PANEL = [
  { id: 'hr',   name: 'Rachel Kim',    initials: 'RK', role: 'HR Manager',               gradient: 'from-pink-500 to-rose-600',     exp: '8+ years',  isLead: false },
  { id: 'lead', name: 'Marcus Rivera', initials: 'MR', role: 'Frontend Lead',             gradient: 'from-blue-500 to-indigo-600',   exp: '12+ years', isLead: true  },
  { id: 'jr',   name: 'Emma Collins',  initials: 'EC', role: 'Junior Frontend Developer', gradient: 'from-green-500 to-emerald-600', exp: '2 years',   isLead: false },
];

const TECH_STACK = ['React', 'TypeScript', 'Next.js', 'TailwindCSS', 'GraphQL'];

const CATEGORIES = [
  { name: 'Communication Skills',  score: 82, color: '#10b981' },
  { name: 'Technical Knowledge',   score: 74, color: '#f59e0b' },
  { name: 'Problem Solving',       score: 78, color: '#8b5cf6' },
  { name: 'Cultural & Role Fit',   score: 88, color: '#3b82f6' },
  { name: 'Confidence & Clarity',  score: 71, color: '#f59e0b' },
];

const STRENGTHS = [
  'Clear, structured communication using the STAR method throughout responses',
  'Strong React and component architecture knowledge with real-world examples',
  'Demonstrated leadership and initiative in cross-team collaboration projects',
];

const IMPROVEMENTS = [
  { text: 'Deepen system design knowledge — practice designing scalable frontend architectures', priority: 'High' },
  { text: 'Add more quantified metrics and measurable outcomes to behavioral examples', priority: 'Medium' },
  { text: 'Practice articulating trade-offs in technical decisions more clearly', priority: 'Medium' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelAvatar({ initials, gradient, isSpeaking, size = 'lg' }: {
  initials: string; gradient: string; isSpeaking?: boolean; size?: 'sm' | 'md' | 'lg';
}) {
  const sz = size === 'sm' ? 'w-8 h-8 text-[9px]' : size === 'md' ? 'w-16 h-16 text-lg' : 'w-12 h-12 text-sm';
  return (
    <div className="relative">
      <div className={`${sz} bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 ${isSpeaking ? 'border-blue-400 scale-105' : 'border-slate-700'} transition-all duration-300`}>
        <span className="text-white font-bold">{initials}</span>
      </div>
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-50" />
      )}
    </div>
  );
}

// ─── Phase 1: Waiting Room ────────────────────────────────────────────────────

function WaitingRoom({ step }: { step: number }) {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      {/* Left — Main area */}
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <FadeIn delay={0}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-white">Frontend Developer</p>
                <p className="text-[9px] text-slate-500">Panel Interview · 8 Questions · 24 min</p>
              </div>
            </div>
            <div className="flex gap-1.5 mb-2.5">
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[8px] text-blue-400 font-medium">technical</span>
              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] text-amber-400 font-medium">Mid</span>
            </div>
            <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[8px] text-slate-500">Technologies:</span>
                {TECH_STACK.map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[7px] border border-blue-500/20">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200} className="flex-1 flex flex-col">
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-1 flex flex-col">
            <p className="text-[10px] font-medium text-white flex items-center gap-1.5 mb-2">
              <Camera className="w-3.5 h-3.5 text-blue-400" /> Camera Preview
            </p>
            <div className="relative bg-slate-950 rounded-lg overflow-hidden flex-1 min-h-[200px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-lg font-bold">J</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Camera is off</p>
                </div>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {[
                  { icon: <VideoOff className="w-3 h-3" />, red: true },
                  { icon: <Mic className="w-3 h-3" />, red: false },
                  { icon: <Volume2 className="w-3 h-3" />, red: false },
                  { icon: <Settings className="w-3 h-3" />, red: false },
                ].map((btn, i) => (
                  <div key={i} className={`p-2 rounded-full ${btn.red ? 'bg-red-600/80' : 'bg-slate-800/80'} text-white`}>{btn.icon}</div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {['Camera', 'Mic', 'Speaker'].map(d => (
                <div key={d} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-[8px] text-white">{d}</span>
                  </div>
                  <p className="text-[7px] text-slate-500">Ready</p>
                </div>
              ))}
            </div>

            {step >= 1 && (
              <FadeIn delay={400}>
                <div className="mt-2.5 w-full py-2.5 rounded-lg text-center text-[10px] font-semibold bg-gradient-to-r from-emerald-600 to-green-600 text-white flex items-center justify-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5" /> Join Interview
                </div>
              </FadeIn>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Right — Sidebar */}
      <div className="w-[38%] flex-shrink-0 flex flex-col gap-2.5">
        <FadeIn delay={100}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[10px] font-medium text-white flex items-center gap-1.5 mb-2.5">
              <Users className="w-3.5 h-3.5 text-purple-400" /> Interview Panel
            </p>
            <div className="space-y-2.5">
              {PANEL.map((p, i) => (
                <FadeIn key={p.id} delay={200 + i * 100}>
                  <div className="flex items-center gap-2.5">
                    <PanelAvatar initials={p.initials} gradient={p.gradient} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-[9px] font-medium text-white truncate">{p.name}</p>
                        {p.isLead && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[7px] text-slate-500 truncate">{p.role}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      <span className="text-[7px] text-amber-400">Waiting</span>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={500} className="flex-1">
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg h-full">
            <p className="text-[10px] font-medium text-white flex items-center gap-1.5 mb-2.5">
              <Headphones className="w-3.5 h-3.5 text-emerald-400" /> Interview Tips
            </p>
            <div className="space-y-1.5">
              {['Quiet, well-lit environment', 'Test audio and video before joining', 'Have your resume ready', 'Make eye contact with camera', 'Prepare questions for the panel'].map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className="w-1 h-1 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />
                  <p className="text-[8px] text-slate-400 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={600}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[10px] font-medium text-white flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-blue-400" /> Session Details
            </p>
            <div className="space-y-1.5 text-[8px]">
              {[
                { l: 'Duration', v: '24 min' },
                { l: 'Questions', v: '8' },
                { l: 'Panel Size', v: '4' },
                { l: 'Format', v: 'Panel Interview' },
              ].map(r => (
                <div key={r.l} className="flex justify-between text-slate-400">
                  <span>{r.l}:</span>
                  <span className="text-white font-medium">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

// ─── Phase 2: Live Interview (2×2 Grid) ───────────────────────────────────────

function LiveInterview({ step }: { step: number }) {
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [question, setQuestion] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  // Cycle: interviewer asks → candidate responds → next interviewer
  useEffect(() => {
    const sequence = [
      'lead', 'you',
      'hr',   'you',
      'jr',   'you',
      'lead', 'you',
      null,
    ];
    let idx = 0;
    const t = setInterval(() => {
      const who = sequence[idx % sequence.length];
      setSpeakerId(who);

      if (who && transcripts[who]) {
        const lines = transcripts[who];
        setCurrentTranscript(lines[transcriptIdx[who] % lines.length]);
        setTranscriptIdx(prev => ({
          ...prev,
          [who]: prev[who] + 1,
        }));
      }

      // Advance question counter when an interviewer starts asking
      if (who && who !== 'you' && who !== null) {
        setQuestion(q => Math.min(q + 1, 8));
      }

      idx++;
    }, 1400);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const participants = [
    ...PANEL.map(p => ({ ...p, isUser: false })),
    { id: 'you', name: 'Jordan Lee', initials: 'JL', role: 'Interviewee', gradient: 'from-indigo-500 to-purple-600', exp: 'Applying for: Frontend Dev', isLead: false, isUser: true },
  ];

  const transcripts: Record<string, string[]> = {
    lead: [
      "Tell me about a time you optimized a React application's performance. What tools did you use?",
      "How would you architect a micro-frontend system for a large e-commerce platform?",
      "Describe your experience with GraphQL. How does it compare to REST in your workflow?",
      "What's your approach to managing state in a large-scale React application?",
    ],
    hr: [
      "Tell me about a challenging team conflict you resolved. What was your approach?",
      "How do you handle tight deadlines when priorities shift mid-sprint?",
    ],
    jr: [
      "What's your process for reviewing a junior developer's pull request?",
      "How do you decide between building a custom component vs using a library?",
    ],
    you: [
      "At my previous role, I used React Profiler and Lighthouse to identify render bottlenecks — we reduced bundle size by 40% and cut LCP from 3.2s to 1.1s.",
      "I'd propose a module federation approach with shared design tokens, independent deployments per team, and a thin shell app handling routing and auth.",
      "I migrated our REST endpoints to GraphQL which reduced over-fetching by 60%. The trade-off was added complexity in caching, which we solved with Apollo Client.",
      "I've used a combination of React Context for global state and Zustand for feature-level stores — it keeps things modular without prop drilling.",
    ],
  };

  const [transcriptIdx, setTranscriptIdx] = useState<Record<string, number>>({
    lead: 0, hr: 0, jr: 0, you: 0,
  });
  const [currentTranscript, setCurrentTranscript] = useState('Interview session ready...');

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 520 }}>
      {/* Header bar */}
      <FadeIn delay={0}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">AI</span>
            </div>
            <div>
              <p className="text-[10px] font-medium text-white">Interview Conference</p>
              <p className="text-[8px] text-slate-500">Frontend Developer · Technical</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[8px] text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" />Excellent</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(elapsed)}</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Recording</span>
          </div>
        </div>
      </FadeIn>

      {/* 2×2 Grid — flex-1 to fill all available space */}
      <FadeIn delay={200} className="flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-2 gap-3 flex-1">
                      {participants.map(p => {
            const isSpeaking = speakerId === p.id;
            const isCurrentSpeaker = isSpeaking;
            return (
              <div
                key={p.id}
                className={`bg-white/[0.02] border rounded-xl flex flex-col items-center justify-center text-center relative transition-all duration-300 ${
                  p.isLead ? 'border-blue-500/30' : p.isUser ? 'border-purple-500/30' : 'border-white/[0.06]'
                } ${
                  isCurrentSpeaker
                    ? p.isUser
                      ? 'ring-1 ring-purple-500/50 scale-[1.01] shadow-lg shadow-purple-500/10'
                      : 'ring-1 ring-blue-500/50 scale-[1.01] shadow-lg shadow-blue-500/10'
                    : ''
                }`}
              >
                {p.isLead && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 text-white text-[7px] rounded-full font-medium">Lead</span>
                )}
                {p.isUser && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-purple-600 text-white text-[7px] rounded-full font-medium">You</span>
                )}
                <PanelAvatar initials={p.initials} gradient={p.gradient} isSpeaking={isSpeaking} size="md" />
                <p className={`text-[11px] font-semibold mt-2 ${isSpeaking ? 'text-blue-300' : 'text-white'}`}>{p.name}</p>
                <p className="text-[9px] text-slate-500 mb-2">{p.role}</p>
                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-medium border ${
                  isSpeaking
                    ? p.isUser
                      ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                      : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  {isSpeaking ? (p.isUser ? 'Responding' : 'Asking') : 'Listening'}
                </span>
                <p className="text-[8px] text-slate-600 mt-1.5">{p.exp}</p>
              </div>
            );
          })}
        </div>
      </FadeIn>

      {/* Controls — compact at bottom */}
      <FadeIn delay={400}>
        <div className="mt-1.5 p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[8px]">
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-white font-medium">Active</span></span>
              <span className="text-slate-500">Q {Math.min(question, 8)}/8</span>
              {speakerId && (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                  speakerId === 'you'
                    ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300'
                    : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                }`}>
                  <div className={`w-1 h-1 rounded-full animate-pulse ${speakerId === 'you' ? 'bg-purple-400' : 'bg-blue-400'}`} />
                  {speakerId === 'you' ? 'Jordan Lee responding' : `${participants.find(p => p.id === speakerId)?.name} asking`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { icon: <Mic className="w-3 h-3" />, bg: 'bg-slate-800' },
                { icon: <Video className="w-3 h-3" />, bg: 'bg-slate-800' },
                { icon: <PhoneOff className="w-3 h-3" />, bg: 'bg-red-600' },
                { icon: <Volume2 className="w-3 h-3" />, bg: 'bg-slate-800' },
              ].map((b, i) => (
                <div key={i} className={`p-1.5 rounded-full ${b.bg} text-white`}>{b.icon}</div>
              ))}
            </div>
          </div>
          <div className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[7px] text-slate-400 font-medium">
                Live Transcript {speakerId && speakerId !== 'you' ? `— ${participants.find(p => p.id === speakerId)?.name}` : speakerId === 'you' ? '— Jordan Lee' : ''}
              </span>
            </div>
            <p className="text-[9px] text-white leading-relaxed">{currentTranscript}</p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Phase 3: Feedback Report (larger text, scrollable) ───────────────────────

function FeedbackReport() {
  const total = 79;
  return (
    <div
      className="flex flex-col gap-3 overflow-y-auto pr-1 feedback-scrollbar"
      style={{ minHeight: 520, maxHeight: 520 }}
    >
      {/* Custom scrollbar styles */}
      <style>{`
        .feedback-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .feedback-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
        }
        .feedback-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.4));
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .feedback-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.6), rgba(99, 102, 241, 0.6));
        }
        .feedback-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(139, 92, 246, 0.4) rgba(255, 255, 255, 0.03);
        }
      `}</style>
      {/* Header */}
      <FadeIn delay={0}>
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Analysis Complete
            </span>
            <span className="text-[10px] text-slate-500">3/29/2026</span>
          </div>
          <p className="text-[15px] font-bold text-white">Interview Performance Report</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Analysis for <span className="text-blue-400 font-medium">Frontend Developer</span></p>
        </div>
      </FadeIn>

      {/* Score + Stats */}
      <FadeIn delay={200}>
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-5">
            <div className="text-center flex-shrink-0">
              <ScoreRing score={total} size={72} color="#10b981" delay={300} />
              <span className="mt-2 inline-block px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 font-semibold">Good</span>
              <p className="text-[10px] text-slate-500 mt-1">Frontend Developer</p>
              <p className="text-[9px] text-slate-600">technical Interview</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2">
              {[
                { icon: MessageSquare, label: 'Questions', value: '8' },
                { icon: Clock,         label: 'Duration',  value: '22m' },
                { icon: Star,          label: 'Score',     value: '79' },
                { icon: BarChart3,     label: 'Categories', value: '5' },
                { icon: TrendingUp,    label: 'Strengths', value: '3' },
                { icon: CheckCircle2,  label: 'Complete',  value: '100%' },
              ].map(s => (
                <div key={s.label} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded text-center">
                  <div className="flex items-center gap-1 justify-center mb-1">
                    <s.icon className="w-3 h-3 text-blue-400" />
                    <span className="text-[8px] text-slate-500">{s.label}</span>
                  </div>
                  <p className="text-[13px] font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Performance Benchmark */}
      <FadeIn delay={400}>
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <p className="text-[12px] font-bold text-white">Performance Benchmark</p>
            <span className="text-[9px] text-slate-500 ml-auto">Industry comparison</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Your Score',        value: 79, color: 'bg-blue-500',    w: '79%' },
              { label: 'Industry Average',  value: 60, color: 'bg-slate-500',   w: '60%' },
              { label: 'Company Average',   value: 65, color: 'bg-amber-500',   w: '65%' },
              { label: 'Top 10%',           value: 92, color: 'bg-emerald-500', w: '92%' },
            ].map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">{b.label}</span>
                  <span className="text-white font-semibold">{b.value}</span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.color}`} style={{ width: b.w, transition: 'width 0.7s ease-out' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Category Breakdown */}
      <FadeIn delay={600}>
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <p className="text-[12px] font-bold text-white">Detailed Performance Analysis</p>
            <span className="text-[9px] text-slate-500 ml-auto">Breakdown across 5 categories</span>
          </div>
          <div className="space-y-2.5">
            {CATEGORIES.map((cat, i) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-300">{cat.name}</span>
                  <span className="text-[11px] font-bold" style={{ color: cat.color }}>{cat.score}/100</span>
                </div>
                <AnimatedBar value={cat.score} color={cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 70 ? 'bg-amber-500' : 'bg-red-500'} delay={700 + i * 100} />
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Strengths + Improvements */}
      <div className="grid grid-cols-2 gap-3">
        <FadeIn delay={1000}>
          <div className="p-3.5 bg-emerald-500/[0.04] border-l-2 border-emerald-500/40 rounded-lg h-full">
            <div className="flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-[11px] font-bold text-emerald-400">Key Strengths</p>
            </div>
            <div className="space-y-2">
              {STRENGTHS.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />
                  <p className="text-[10px] text-slate-300 leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={1100}>
          <div className="p-3.5 bg-amber-500/[0.04] border-l-2 border-amber-500/40 rounded-lg h-full">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-[11px] font-bold text-amber-400">Growth Areas</p>
            </div>
            <div className="space-y-2.5">
              {IMPROVEMENTS.map((imp, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">{imp.text}</p>
                    <span className={`mt-0.5 inline-block text-[8px] px-1.5 py-0.5 rounded font-semibold ${imp.priority === 'High' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>{imp.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>

      {/* AI Summary */}
      <FadeIn delay={1300}>
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-[12px] font-bold text-white">AI Assessment Summary</p>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
            Strong frontend candidate with solid React fundamentals and excellent communication skills. Technical depth in system design and performance optimization needs strengthening before targeting senior-level roles. With 2–3 weeks of targeted preparation on architecture patterns and quantified storytelling, this candidate would be very competitive for mid-level frontend positions at top-tier companies.
          </p>
          <div className="flex items-center gap-2.5">
            {[
              { label: 'Nearly Ready', sub: 'Readiness Level', icon: <ArrowRight className="w-4 h-4 text-emerald-400" />, bg: 'border-emerald-500/20' },
              { label: 'Top Tier', sub: 'Competitive Edge', icon: <Star className="w-4 h-4 text-amber-400" />, bg: 'border-amber-500/20' },
              { label: 'Strong', sub: 'Growth Trajectory', icon: <TrendingUp className="w-4 h-4 text-indigo-400" />, bg: 'border-indigo-500/20' },
            ].map(b => (
              <div key={b.label} className={`flex-1 p-2.5 bg-white/[0.02] border ${b.bg} rounded-lg text-center`}>
                <div className="flex justify-center mb-1">{b.icon}</div>
                <p className="text-[10px] font-bold text-white">{b.label}</p>
                <p className="text-[8px] text-slate-500">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export function InterviewExamplePreview({ step }: { step: number }) {
  return (
    <div className="h-full" style={{ minHeight: 520 }}>
      {step <= 1 && <WaitingRoom step={step} />}
      {step >= 2 && step <= 4 && <LiveInterview step={step} />}
      {step >= 5 && <FeedbackReport />}
    </div>
  );
}