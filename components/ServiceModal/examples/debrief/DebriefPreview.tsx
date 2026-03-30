// components/ServiceExampleModal/examples/debrief/DebriefPreview.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Building2, Calendar, Clock, Star,  Save,
  CheckCircle2, AlertTriangle, Brain, MessageSquare, Target,
  BarChart3, Lightbulb, Heart, Zap, Award, TrendingUp,
  Activity, Users, MapPin, Flame, ArrowRight, Loader2, 
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { FadeIn, TypingText } from '../../primitives';

// ─── Scrollbar ────────────────────────────────────────────────────────────────

const SCROLL_CSS = `
  .db-scroll::-webkit-scrollbar { width: 4px; }
  .db-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
  .db-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 10px; }
  .db-scroll { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.3) rgba(255,255,255,0.02); }
`;

// ─── Shared mini-components ───────────────────────────────────────────────────

function MiniCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg ${className}`}>{children}</div>;
}

function MiniStatCard({ icon: Icon, label, value, accentClass }: {
  icon: React.ElementType; label: string; value: string | number; accentClass: string;
}) {
  return (
    <MiniCard>
      <div className="flex items-center justify-between mb-1.5">
        <div className={`w-5 h-5 rounded flex items-center justify-center ${accentClass.replace('text-', 'bg-').replace('-400', '-500/10')}`}>
          <Icon className={`w-2.5 h-2.5 ${accentClass}`} />
        </div>
        <span className="text-[13px] font-bold text-white">{value}</span>
      </div>
      <p className="text-[7px] text-slate-600 uppercase tracking-wide font-semibold">{label}</p>
    </MiniCard>
  );
}

function MiniProgressBar({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] text-slate-400 truncate pr-2">{label}</span>
        <span className="text-[7px] text-slate-500 flex-shrink-0">{sub || `${value}%`}</span>
      </div>
      <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-[width] duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MiniReadinessGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  const angle = (score / 100) * 180;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-10 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.3} 141.3`}
            style={{ transition: 'stroke-dasharray 1.2s ease' }} />
          <line x1="50" y1="50"
            x2={50 + 35 * Math.cos(Math.PI - angle * Math.PI / 180)}
            y2={50 - 35 * Math.sin(Math.PI - angle * Math.PI / 180)}
            stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill="white" />
        </svg>
      </div>
      <p className="text-[14px] font-bold -mt-0.5" style={{ color }}>{score}</p>
      <p className="text-[8px] font-semibold" style={{ color }}>{label}</p>
    </div>
  );
}

function LoadingCard({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex-1 min-w-0 flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-3">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
        <p className="text-[11px] font-semibold text-white mb-1">{message}</p>
        <p className="text-[9px] text-slate-500 max-w-[220px] leading-relaxed mx-auto">{sub}</p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-500"
              style={{ animation: 'dbpulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s`, opacity: 0.3 }} />
          ))}
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes dbpulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        `}} />
      </div>
    </div>
  );
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ENTRIES = [
  { company: 'Stripe', role: 'Senior SWE', stage: 'System Design', outcome: 'Moved Forward', outcomeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', date: 'Mar 18, 2026', duration: '60m', score: 82, before: '🤩', after: '😎', difficulty: 4, questions: ['Design a payment processing system', 'How would you handle idempotency?', 'Walk me through your approach to rate limiting'], well: 'Nailed the high-level architecture and idempotency discussion. Interviewer was nodding along.', poorly: 'Got a bit hand-wavy on the database sharding strategy. Should have been more specific about partition keys.', surprises: 'They asked about my experience with event-driven architectures — wasn\'t expecting that for a system design round.', followUp: 'Study consistent hashing and Kafka partition strategies before final round.' },
  { company: 'Google', role: 'SWE III', stage: 'Technical', outcome: 'Rejected', outcomeColor: 'text-red-400 bg-red-400/10 border-red-400/20', date: 'Mar 10, 2026', duration: '45m', score: 55, before: '😟', after: '😓', difficulty: 5, questions: ['Implement LRU cache from scratch', 'Optimize for O(1) operations'], well: 'Got the basic implementation right and identified the doubly-linked list approach.', poorly: 'Ran out of time on the follow-up optimization. Panicked and forgot to discuss trade-offs.', surprises: 'The follow-up was harder than expected — they wanted multi-threaded LRU cache.', followUp: 'Practice timed coding problems. Work on staying calm under pressure.' },
  { company: 'Datadog', role: 'Backend Engineer', stage: 'Behavioral', outcome: 'Moved Forward', outcomeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', date: 'Mar 5, 2026', duration: '45m', score: 75, before: '😐', after: '😎', difficulty: 3, questions: ['Tell me about a time you disagreed with a teammate', 'Describe a project that failed'], well: 'STAR format was smooth. Great examples from the payment pipeline project.', poorly: 'Could have been more concise on the failure story — rambled a bit.', surprises: 'They seemed more interested in the failure story than the success one.', followUp: 'Prepare a tighter 2-minute version of each STAR story.' },
  { company: 'Coinbase', role: 'Senior SWE', stage: 'Phone Screen', outcome: 'Pending', outcomeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20', date: 'Mar 1, 2026', duration: '30m', score: 70, before: '😐', after: '😐', difficulty: 2, questions: ['Why Coinbase?', 'Walk me through your most impactful project'], well: 'Good energy, showed genuine interest in crypto infrastructure.', poorly: 'Could have quantified impact better — said "improved performance" instead of giving numbers.', surprises: 'Very casual vibe — felt more like a conversation than an interview.', followUp: 'Prepare 3 impact metrics for every project on resume.' },
];

// ─── Phase 1: Log Form ────────────────────────────────────────────────────────

function LogFormPhase({ onSave, isLoading }: { onSave: () => void; isLoading: boolean }) {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />
      {/* Left — Form */}
      <div className="w-[52%] flex-shrink-0 overflow-y-auto pr-0.5 db-scroll" style={{ maxHeight: 520 }}>
        <FadeIn delay={0}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white">Interview Debrief</p>
              <p className="text-[8px] text-slate-500">Log your real interview</p>
            </div>
          </div>
        </FadeIn>

        <div className="space-y-2">
          {/* Company + Role */}
          <FadeIn delay={200}>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Company *</p>
                <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                  <TypingText text="Stripe" speed={50} delay={400} className="text-[10px] text-white" />
                </div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Job Title *</p>
                <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                  <TypingText text="Senior SWE" speed={40} delay={800} className="text-[10px] text-white" />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Stage + Outcome */}
          <FadeIn delay={1200}>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Stage</p>
                <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] text-white">System Design</div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Outcome</p>
                <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] text-emerald-400">Moved Forward</div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Duration</p>
                <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] text-white">60 min</div>
              </div>
            </div>
          </FadeIn>

          {/* Emotions */}
          <FadeIn delay={1800}>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[8px] text-slate-500 mb-1">Feeling Before</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { emoji: '😎', label: 'confident', active: false },
                    { emoji: '😰', label: 'nervous', active: false },
                    { emoji: '🤩', label: 'excited', active: true },
                  ].map(e => (
                    <div key={e.label} className={`p-1 rounded-lg text-center text-[7px] ${e.active ? 'bg-violet-500/20 border border-violet-500/40 text-white' : 'bg-white/[0.03] border border-white/[0.07] text-slate-500'}`}>
                      <span className="block text-sm leading-none mb-0.5">{e.emoji}</span>
                      {e.label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-1">Feeling After</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { emoji: '😎', label: 'confident', active: true },
                    { emoji: '😐', label: 'neutral', active: false },
                    { emoji: '😓', label: 'exhausted', active: false },
                  ].map(e => (
                    <div key={e.label} className={`p-1 rounded-lg text-center text-[7px] ${e.active ? 'bg-violet-500/20 border border-violet-500/40 text-white' : 'bg-white/[0.03] border border-white/[0.07] text-slate-500'}`}>
                      <span className="block text-sm leading-none mb-0.5">{e.emoji}</span>
                      {e.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Self score + difficulty */}
          <FadeIn delay={2400}>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[8px] text-slate-500 mb-1">Self Score: <span className="text-white font-bold">82%</span></p>
                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-1">Difficulty: <span className="text-amber-400 font-bold">★★★★</span></p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} className={`text-sm ${n <= 4 ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Questions */}
          <FadeIn delay={2800}>
            <div>
              <p className="text-[8px] text-slate-500 mb-1">Questions They Asked</p>
              <div className="space-y-1">
                {['Design a payment processing system', 'How would you handle idempotency?'].map((q, i) => (
                  <div key={i} className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                    <TypingText text={q} speed={15} delay={3000 + i * 800} className="text-[8px] text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* What went well / poorly */}
          <FadeIn delay={4400}>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[8px] text-emerald-400 mb-0.5">What went well?</p>
                <div className="px-2 py-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg h-[32px] overflow-hidden">
                  <TypingText text="Nailed the high-level architecture and idempotency discussion." speed={10} delay={4600} className="text-[7px] text-slate-300 leading-snug" />
                </div>
              </div>
              <div>
                <p className="text-[8px] text-red-400 mb-0.5">What went poorly?</p>
                <div className="px-2 py-1.5 bg-red-500/[0.06] border border-red-500/15 rounded-lg h-[32px] overflow-hidden">
                  <TypingText text="Got hand-wavy on database sharding strategy." speed={10} delay={5200} className="text-[7px] text-slate-300 leading-snug" />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Save button */}
          <FadeIn delay={5800}>
            <button onClick={onSave} disabled={isLoading}
              className="w-full py-2 rounded-xl text-center text-[10px] font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center gap-1.5 hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60">
              {isLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : <><Save className="w-3 h-3" /> Save to Journal</>}
            </button>
          </FadeIn>
        </div>
      </div>

      {/* Right — Empty state or loading */}
      {isLoading ? (
        <LoadingCard message="Saving entry…" sub="Logging your interview debrief to the journal" />
      ) : (
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <FadeIn delay={500}>
            <div className="text-center px-6">
              <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mb-1">Your journal is empty</p>
              <p className="text-[9px] text-slate-600 max-w-[200px] leading-relaxed">Log your first real interview to start tracking patterns</p>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}

// ─── Phase 2: Journal Log ─────────────────────────────────────────────────────

function JournalLogPhase() {
  const [expandedIdx, setExpandedIdx] = useState(0);
  return (
    <div className="h-full overflow-y-auto db-scroll space-y-2" style={{ minHeight: 520, maxHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />
      {/* Stats row */}
      <FadeIn delay={0}>
        <div className="grid grid-cols-4 gap-1.5">
          <MiniStatCard icon={BookOpen} label="Total Logged" value={4} accentClass="text-violet-400" />
          <MiniStatCard icon={Star} label="Avg Score" value="71%" accentClass="text-amber-400" />
          <MiniStatCard icon={TrendingUp} label="Advance Rate" value="50%" accentClass="text-emerald-400" />
          <MiniStatCard icon={Award} label="Offers" value={0} accentClass="text-blue-400" />
        </div>
      </FadeIn>

      {/* Entries */}
      {MOCK_ENTRIES.map((entry, idx) => {
        const isExpanded = expandedIdx === idx;
        return (
          <FadeIn key={idx} delay={200 + idx * 200}>
            <MiniCard className="overflow-hidden">
              <div className="cursor-pointer" onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 bg-violet-500/[0.12] border border-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Building2 className="w-3 h-3 text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[10px] font-bold text-white">{entry.company}</p>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded-full border font-semibold ${entry.outcomeColor}`}>{entry.outcome}</span>
                      </div>
                      <p className="text-[8px] text-slate-500">{entry.role} · {entry.stage}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-0.5 text-[7px] text-slate-600"><Calendar className="w-2 h-2" />{entry.date}</span>
                        <span className="flex items-center gap-0.5 text-[7px] text-slate-600"><Clock className="w-2 h-2" />{entry.duration}</span>
                        <span className="flex items-center gap-0.5 text-[7px] text-slate-600"><Star className="w-2 h-2" />{entry.score}%</span>
                        <span className="text-[9px]">{entry.before} → {entry.after}</span>
                        <span className="text-amber-400 text-[7px]">{'★'.repeat(entry.difficulty)}</span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-600 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-white/[0.05] space-y-1.5">
                  <div>
                    <p className="text-[7px] text-slate-600 uppercase font-semibold mb-0.5 flex items-center gap-0.5"><MessageSquare className="w-2 h-2" /> Questions</p>
                    {entry.questions.map((q, i) => (
                      <p key={i} className="text-[8px] text-slate-300 flex items-start gap-1"><span className="text-violet-400 flex-shrink-0">›</span> {q}</p>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                      <p className="text-[7px] text-emerald-400 font-semibold uppercase mb-0.5 flex items-center gap-0.5"><CheckCircle2 className="w-2 h-2" /> Went Well</p>
                      <p className="text-[7px] text-slate-300 leading-snug">{entry.well}</p>
                    </div>
                    <div className="p-2 bg-red-500/[0.06] border border-red-500/15 rounded-lg">
                      <p className="text-[7px] text-red-400 font-semibold uppercase mb-0.5 flex items-center gap-0.5"><AlertTriangle className="w-2 h-2" /> Went Poorly</p>
                      <p className="text-[7px] text-slate-300 leading-snug">{entry.poorly}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-2 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg">
                      <p className="text-[7px] text-amber-400 font-semibold uppercase mb-0.5 flex items-center gap-0.5"><Lightbulb className="w-2 h-2" /> Surprises</p>
                      <p className="text-[7px] text-slate-300 leading-snug">{entry.surprises}</p>
                    </div>
                    <div className="p-2 bg-blue-500/[0.06] border border-blue-500/15 rounded-lg">
                      <p className="text-[7px] text-blue-400 font-semibold uppercase mb-0.5 flex items-center gap-0.5"><Target className="w-2 h-2" /> Follow-up</p>
                      <p className="text-[7px] text-slate-300 leading-snug">{entry.followUp}</p>
                    </div>
                  </div>
                </div>
              )}
            </MiniCard>
          </FadeIn>
        );
      })}
    </div>
  );
}

// ─── Phase 3: Stats ───────────────────────────────────────────────────────────

function StatsPhase() {
  return (
    <div className="h-full overflow-y-auto db-scroll space-y-2.5" style={{ minHeight: 520, maxHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

      {/* Score Trend */}
      <FadeIn delay={0}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center"><Activity className="w-2.5 h-2.5 text-amber-400" /></div>
            <p className="text-[10px] font-bold text-white">Self-Score Trend</p>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Coinbase — Phone Screen', value: 70 },
              { label: 'Datadog — Behavioral', value: 75 },
              { label: 'Google — Technical', value: 55 },
              { label: 'Stripe — System Design', value: 82 },
            ].map((s, i) => (
              <MiniProgressBar key={i} label={s.label} value={s.value} />
            ))}
          </div>
        </MiniCard>
      </FadeIn>

      {/* Outcome breakdown */}
      <FadeIn delay={300}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center"><BarChart3 className="w-2.5 h-2.5 text-blue-400" /></div>
            <p className="text-[10px] font-bold text-white">Outcome Breakdown</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Moved Fwd', count: 2, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
              { label: 'Rejected', count: 1, color: 'text-red-400 bg-red-400/10 border-red-400/20' },
              { label: 'Pending', count: 1, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
            ].map(o => (
              <div key={o.label} className={`p-2 rounded-lg border text-center ${o.color}`}>
                <p className="text-[12px] font-bold">{o.count}</p>
                <p className="text-[7px] opacity-70">{o.label}</p>
              </div>
            ))}
          </div>
        </MiniCard>
      </FadeIn>

      {/* Emotional profile */}
      <FadeIn delay={600}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-pink-500/10 flex items-center justify-center"><Heart className="w-2.5 h-2.5 text-pink-400" /></div>
            <p className="text-[10px] font-bold text-white">Emotion vs Performance</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { emoji: '🤩', label: 'Excited', avg: 82, count: 1 },
              { emoji: '😐', label: 'Neutral', avg: 72, count: 2 },
              { emoji: '😟', label: 'Anxious', avg: 55, count: 1 },
            ].map(e => (
              <div key={e.label} className="p-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-center">
                <span className="block text-lg mb-0.5">{e.emoji}</span>
                <p className={`text-[11px] font-bold ${e.avg >= 75 ? 'text-emerald-400' : e.avg >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{e.avg}%</p>
                <p className="text-[7px] text-slate-600">{e.label} ({e.count}×)</p>
              </div>
            ))}
          </div>
        </MiniCard>
      </FadeIn>

      {/* Stage performance */}
      <FadeIn delay={900}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center"><Users className="w-2.5 h-2.5 text-violet-400" /></div>
            <p className="text-[10px] font-bold text-white">Performance by Stage</p>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'System Design', value: 82, sub: '1 interview · 82% avg' },
              { label: 'Behavioral', value: 75, sub: '1 interview · 75% avg' },
              { label: 'Phone Screen', value: 70, sub: '1 interview · 70% avg' },
              { label: 'Technical', value: 55, sub: '1 interview · 55% avg' },
            ].map((s, i) => (
              <MiniProgressBar key={i} label={s.label} value={s.value} sub={s.sub} />
            ))}
          </div>
        </MiniCard>
      </FadeIn>
    </div>
  );
}

// ─── Phase 4: AI Analysis ─────────────────────────────────────────────────────

function AIAnalysisPhase() {
  return (
    <div className="h-full overflow-y-auto db-scroll space-y-2.5" style={{ minHeight: 520, maxHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

      {/* Readiness + Verdict */}
      <FadeIn delay={0}>
        <MiniCard>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center"><Brain className="w-2.5 h-2.5 text-violet-400" /></div>
              <p className="text-[10px] font-bold text-white">AI Career Coach</p>
            </div>
            <span className="text-[7px] text-slate-600">4 entries analysed</span>
          </div>
          <div className="flex items-center gap-4">
            <MiniReadinessGauge score={62} label="Getting There" />
            <div className="flex-1">
              <div className="p-2 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                <p className="text-[7px] text-slate-600 uppercase tracking-widest font-semibold mb-1">Coach&apos;s Verdict</p>
                <p className="text-[9px] text-white leading-relaxed italic">&ldquo;You have strong system design instincts but crumble under time pressure. Fix the panic response and you&apos;re clearing final rounds.&rdquo;</p>
              </div>
            </div>
          </div>
        </MiniCard>
      </FadeIn>

      {/* Strengths */}
      <FadeIn delay={300}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /></div>
            <p className="text-[10px] font-bold text-white">Strengths</p>
          </div>
          <div className="space-y-1.5">
            {[
              { area: 'System Architecture', evidence: 'Nailed high-level design at Stripe, strong Datadog STAR stories', leverage: 'Lead with architecture in every interview — it\'s your differentiator.' },
              { area: 'Storytelling (STAR)', evidence: 'Smooth behavioral at Datadog, good project narratives', leverage: 'Prepare 5 polished stories that each showcase a different skill.' },
            ].map((s, i) => (
              <div key={i} className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                <p className="text-[9px] font-semibold text-emerald-300 mb-0.5">{s.area}</p>
                <p className="text-[7px] text-slate-500 mb-1">{s.evidence}</p>
                <div className="flex items-start gap-1">
                  <ArrowRight className="w-2 h-2 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[7px] text-emerald-400">{s.leverage}</p>
                </div>
              </div>
            ))}
          </div>
        </MiniCard>
      </FadeIn>

      {/* Weaknesses */}
      <FadeIn delay={600}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-2.5 h-2.5 text-red-400" /></div>
            <p className="text-[10px] font-bold text-white">Weakness Map</p>
          </div>
          <div className="space-y-1.5">
            {[
              { area: 'Time Management Under Pressure', severity: 'severe', freq: '2×', example: 'Ran out of time at Google, got hand-wavy at Stripe when pressed', fix: 'Practice 25-min timed problems daily. Use a visible timer in mock interviews.' },
              { area: 'Quantifying Impact', severity: 'moderate', freq: '2×', example: 'Said "improved performance" at Coinbase without numbers', fix: 'Create an impact cheat sheet: every project gets 3 specific metrics.' },
            ].map((w, i) => (
              <div key={i} className={`p-2 rounded-lg border ${w.severity === 'severe' ? 'bg-red-500/[0.08] border-red-500/20' : 'bg-orange-500/[0.08] border-orange-500/20'}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-[9px] font-semibold ${w.severity === 'severe' ? 'text-red-400' : 'text-orange-400'}`}>{w.area}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] opacity-60 text-slate-400">{w.freq}</span>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full bg-white/[0.08] font-semibold capitalize ${w.severity === 'severe' ? 'text-red-400' : 'text-orange-400'}`}>{w.severity}</span>
                  </div>
                </div>
                <p className="text-[7px] text-slate-500 mb-1 italic">&ldquo;{w.example}&rdquo;</p>
                <div className="flex items-start gap-1">
                  <Zap className="w-2 h-2 flex-shrink-0 mt-0.5 text-amber-400" />
                  <p className={`text-[7px] ${w.severity === 'severe' ? 'text-red-300' : 'text-orange-300'}`}>{w.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </MiniCard>
      </FadeIn>

      {/* Stage Analysis */}
      <FadeIn delay={900}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center"><MapPin className="w-2.5 h-2.5 text-blue-400" /></div>
            <p className="text-[10px] font-bold text-white">Stage Analysis</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
              <p className="text-[7px] text-emerald-400 uppercase font-semibold mb-0.5">Strongest</p>
              <p className="text-[9px] text-white">System Design</p>
            </div>
            <div className="p-2 bg-red-500/[0.06] border border-red-500/15 rounded-lg">
              <p className="text-[7px] text-red-400 uppercase font-semibold mb-0.5">Weakest</p>
              <p className="text-[9px] text-white">Technical (Coding)</p>
            </div>
          </div>
          <div className="p-2 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg">
            <p className="text-[7px] text-amber-400 uppercase font-semibold mb-0.5 flex items-center gap-0.5"><Flame className="w-2 h-2" /> Bottleneck</p>
            <p className="text-[7px] text-slate-300">You pass earlier rounds but crumble in timed coding. This is the single biggest thing killing your pipeline.</p>
          </div>
        </MiniCard>
      </FadeIn>

      {/* 30-Day Plan (week 1 only) */}
      <FadeIn delay={1200}>
        <MiniCard>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center"><Target className="w-2.5 h-2.5 text-violet-400" /></div>
            <p className="text-[10px] font-bold text-white">30-Day Plan</p>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">W1</div>
            <div>
              <p className="text-[7px] text-slate-600">Week 1</p>
              <p className="text-[9px] font-bold text-white">Fix the Panic: Timed Problem Training</p>
            </div>
          </div>
          <div className="space-y-1 mb-2">
            {['Solve 3 LeetCode mediums daily with 25-min timer', 'Practice "thinking out loud" during each problem', 'Record one mock interview and review the tape'].map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-3 h-3 border border-white/[0.12] rounded flex-shrink-0 mt-0.5" />
                <p className="text-[7px] text-slate-300 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
          <div className="p-1.5 bg-violet-500/[0.06] border border-violet-500/15 rounded-lg">
            <p className="text-[7px] text-violet-400 font-semibold flex items-center gap-0.5"><Target className="w-2 h-2" /> Complete 3 timed problems without running out of time</p>
          </div>
        </MiniCard>
      </FadeIn>
    </div>
  );
}

// ─── Phase 5: Interactive ─────────────────────────────────────────────────────

function InteractivePhase() {
  const [activeTab, setActiveTab] = useState<'log' | 'stats' | 'ai'>('log');

  const tabs = [
    { id: 'log' as const, label: 'Journal', icon: BookOpen },
    { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
    { id: 'ai' as const, label: 'AI Analysis', icon: Brain },
  ];

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

      {/* Hint */}
      <p className="text-[8px] text-indigo-400 text-center mb-2 font-medium">✨ Switch tabs to explore all views</p>

      {/* Tabs */}
      <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-3 flex-shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-semibold transition-all cursor-pointer ${
              activeTab === t.id ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
            }`}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'log' && <JournalLogPhase />}
        {activeTab === 'stats' && <StatsPhase />}
        {activeTab === 'ai' && <AIAnalysisPhase />}
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

type Phase = 'form' | 'form-loading' | 'journal' | 'stats' | 'ai-loading' | 'ai' | 'interactive';
const LOADING_DURATION = 2000;

export function DebriefExamplePreview({ step }: { step: number }) {
  const [phase, setPhase] = useState<Phase>('form');
  const [autoMode, setAutoMode] = useState(true);

  // ── Auto-play driven by external `step` prop ──
  // serviceConfig steps:
  //   0 → "Logging interview details…"   → form
  //   1 → "Saving to journal…"           → form-loading
  //   2 → "Journal entries loaded!"      → journal
  //   3 → "Calculating stats…"           → stats
  //   4 → "Running AI analysis…"         → ai-loading
  //   5 → "AI insights ready!"           → ai
  //   6+ → interactive
  useEffect(() => {
    if (!autoMode) return;
    if (step <= 0) setPhase('form');
    else if (step === 1) setPhase('form-loading');
    else if (step === 2) setPhase('journal');
    else if (step === 3) setPhase('stats');
    else if (step === 4) setPhase('ai-loading');
    else if (step === 5) setPhase('ai');
    else setPhase('interactive');
  }, [step, autoMode]);

  // ── Auto-transition from loading → next ──
  useEffect(() => {
    if (phase === 'form-loading') {
      const t = setTimeout(() => setPhase('journal'), LOADING_DURATION);
      return () => clearTimeout(t);
    }
    if (phase === 'ai-loading') {
      const t = setTimeout(() => setPhase('ai'), LOADING_DURATION);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── Click handlers (switch to manual mode) ──
  const handleSave = useCallback(() => {
    setAutoMode(false);
    setPhase('form-loading');
  }, []);

  // ── Manual mode: auto-advance after pause ──
  useEffect(() => {
    if (autoMode) return;
    if (phase === 'journal') {
      const t = setTimeout(() => setPhase('stats'), 5000);
      return () => clearTimeout(t);
    }
    if (phase === 'stats') {
      const t = setTimeout(() => setPhase('ai'), 5000);
      return () => clearTimeout(t);
    }
    if (phase === 'ai') {
      const t = setTimeout(() => setPhase('interactive'), 5000);
      return () => clearTimeout(t);
    }
  }, [phase, autoMode]);

  switch (phase) {
    case 'form':
      return <LogFormPhase onSave={handleSave} isLoading={false} />;
    case 'form-loading':
      return <LogFormPhase onSave={handleSave} isLoading={true} />;
    case 'journal':
      return <JournalLogPhase />;
    case 'stats':
      return <StatsPhase />;
    case 'ai-loading':
      return (
        <div className="flex items-center justify-center" style={{ minHeight: 520 }}>
          <LoadingCard message="Analysing your interview history…" sub="Identifying patterns across 4 entries — brutally honest, no sugarcoating" />
        </div>
      );
    case 'ai':
      return <AIAnalysisPhase />;
    case 'interactive':
      return <InteractivePhase />;
    default:
      return <LogFormPhase onSave={handleSave} isLoading={false} />;
  }
}