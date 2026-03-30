// components/ServiceExampleModal/examples/career-tools/CareerToolsPreview.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Linkedin, Send, Sparkles, Search, Edit3, Users, Zap,
  CheckCircle2, AlertTriangle, ArrowRight, Copy,
  MessageSquare, Info, RefreshCw, XCircle,
   Mail, Loader2,
} from 'lucide-react';
import { FadeIn, TypingText, ScoreRing } from '../../primitives';

// ─── Scrollbar ────────────────────────────────────────────────────────────────

const SCROLL_CSS = `
  .ct-scroll::-webkit-scrollbar { width: 4px; }
  .ct-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
  .ct-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 10px; }
  .ct-scroll { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.3) rgba(255,255,255,0.02); }
`;

// ─── Loading Card ─────────────────────────────────────────────────────────────

function LoadingCard({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex-1 min-w-0 flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-3">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        </div>
        <p className="text-[11px] font-semibold text-white mb-1">{message}</p>
        <p className="text-[9px] text-slate-500 max-w-[220px] leading-relaxed mx-auto">{sub}</p>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-purple-500"
              style={{
                animation: 'pulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
          }
        `}} />
      </div>
    </div>
  );
}

// ─── Phase 1: LinkedIn Form ───────────────────────────────────────────────────

function LinkedInForm({ onGenerate, isLoading }: { onGenerate: () => void; isLoading: boolean }) {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      {/* Left — Form */}
      <div className="w-[48%] flex-shrink-0 flex flex-col">
        <FadeIn delay={0}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white">Career Tools</p>
              <p className="text-[8px] text-slate-500">AI-powered LinkedIn & outreach</p>
            </div>
          </div>
        </FadeIn>

        {/* Tool tabs */}
        <FadeIn delay={100}>
          <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-3">
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <Linkedin className="w-3 h-3" /> LinkedIn
            </div>
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold text-slate-500">
              <Send className="w-3 h-3" /> Cold Outreach
            </div>
          </div>
        </FadeIn>

        <div className="flex-1 overflow-y-auto pr-0.5 ct-scroll space-y-2.5" style={{ maxHeight: 440 }}>
          <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

          <FadeIn delay={200}>
            <div>
              <p className="text-[8px] text-slate-500 mb-1">Current Headline</p>
              <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <TypingText text="Software Developer | Java | Python" speed={30} className="text-[10px] text-white" />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={800}>
            <div>
              <p className="text-[8px] text-slate-500 mb-1">About / Summary</p>
              <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg h-[60px] overflow-hidden">
                <TypingText text="Passionate software developer with 5 years of experience building web applications. I love coding and solving problems. Looking for new opportunities." speed={12} delay={1200} className="text-[9px] text-slate-400 leading-snug" />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={2200}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[8px] text-slate-500 mb-1">Target Role</p>
                <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                  <TypingText text="Senior SWE" speed={40} delay={2400} className="text-[10px] text-white" />
                </div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-1">Industry</p>
                <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                  <TypingText text="Fintech" speed={40} delay={2800} className="text-[10px] text-white" />
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={3200}>
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="w-full py-2 rounded-xl text-center text-[10px] font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white flex items-center justify-center gap-1.5 hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Analysing…</>
              ) : (
                <><Sparkles className="w-3 h-3" /> Optimise My Profile</>
              )}
            </button>
          </FadeIn>
        </div>
      </div>

      {/* Right — Empty state or Loading */}
      {isLoading ? (
        <LoadingCard
          message="Analysing your profile…"
          sub="Checking keyword density, rewriting headline & about section"
        />
      ) : (
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <FadeIn delay={500}>
            <div className="text-center px-6">
              <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-3">
                <Linkedin className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mb-1">Results appear here</p>
              <p className="text-[9px] text-slate-600 max-w-[200px] leading-relaxed">Paste your headline or about section and click Optimise</p>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}

// ─── Phase 2: LinkedIn Results ────────────────────────────────────────────────

function LinkedInResults() {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

      {/* Left — Form (filled) */}
      <div className="w-[42%] flex-shrink-0 overflow-y-auto pr-0.5 ct-scroll" style={{ maxHeight: 520 }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center"><Sparkles className="w-3 h-3 text-white" /></div>
          <p className="text-[10px] font-bold text-white">Career Tools</p>
        </div>
        <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-3">
          <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white"><Linkedin className="w-3 h-3" /> LinkedIn</div>
          <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold text-slate-500"><Send className="w-3 h-3" /> Outreach</div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Headline', value: 'Software Developer | Java | Python' },
            { label: 'About', value: 'Passionate software developer with 5 years of experience building web applications...' },
            { label: 'Target Role', value: 'Senior SWE' },
            { label: 'Industry', value: 'Fintech' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[8px] text-slate-600 mb-0.5">{f.label}</p>
              <p className="text-[9px] text-slate-400 px-2 py-1.5 bg-white/[0.02] border border-white/[0.05] rounded-lg truncate">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Results */}
      <div className="flex-1 min-w-0 overflow-y-auto ct-scroll space-y-2.5" style={{ maxHeight: 520 }}>
        {/* Overall Score */}
        <FadeIn delay={0}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-3">
              <ScoreRing score={42} size={52} color="#f59e0b" delay={200} />
              <div className="flex-1">
                <p className="text-[8px] text-slate-500 uppercase tracking-widest font-semibold">Profile Strength</p>
                <p className="text-[12px] font-bold text-amber-400">Needs Work</p>
                <p className="text-[8px] text-slate-500 mt-0.5 italic leading-snug">&ldquo;Your headline is generic and your about section lacks keywords recruiters search for.&rdquo;</p>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-white/[0.05]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] text-slate-500 flex items-center gap-1"><Search className="w-2.5 h-2.5" /> Search visibility</span>
                <span className="text-[8px] text-white font-medium">28 <span className="text-slate-600">→</span> <span className="text-emerald-400">78</span></span>
              </div>
              <div className="relative h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-white/10 rounded-full" style={{ width: '28%' }} />
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full opacity-60" style={{ width: '78%' }} />
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={300}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-white flex items-center gap-1.5"><Edit3 className="w-3 h-3 text-blue-400" /> Headline</p>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-semibold text-red-400 bg-red-500/10 border-red-500/20">32/100</span>
            </div>
            <div className="p-2 bg-red-500/[0.06] border border-red-500/15 rounded-lg mb-2">
              <p className="text-[7px] text-red-400 font-semibold uppercase mb-0.5">Problem</p>
              <p className="text-[8px] text-slate-300 leading-relaxed">Generic title with no value proposition. &ldquo;Software Developer&rdquo; matches millions of profiles.</p>
            </div>
            <div className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[7px] text-emerald-400 font-semibold uppercase">Optimised</p>
                <span className="text-[7px] text-slate-500 flex items-center gap-0.5"><Copy className="w-2 h-2" /> Copy</span>
              </div>
              <p className="text-[10px] text-white font-medium leading-relaxed">Senior Software Engineer | Building Scalable Fintech Systems | Python & Java | Ex-JPMorgan</p>
              <p className="text-[8px] text-slate-500 mt-1">Includes target role, industry, key skills, and social proof — 4x more searchable.</p>
            </div>
          </div>
        </FadeIn>

        {/* About */}
        <FadeIn delay={600}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-white flex items-center gap-1.5"><Users className="w-3 h-3 text-violet-400" /> About Section</p>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-semibold text-amber-400 bg-amber-500/10 border-amber-500/20">45/100</span>
            </div>
            <div className="space-y-1 mb-2">
              {['No measurable achievements or metrics', 'Missing industry keywords recruiters search for'].map((p, i) => (
                <div key={i} className="flex items-start gap-1.5 p-1.5 bg-red-500/[0.06] border border-red-500/10 rounded">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[8px] text-slate-300 leading-snug">{p}</p>
                </div>
              ))}
            </div>
            <div className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
              <p className="text-[7px] text-emerald-400 font-semibold uppercase mb-1">Optimised About</p>
              <p className="text-[8px] text-slate-300 leading-relaxed">Full-stack engineer with 5+ years building payment systems processing $2B+ annually. Specialise in Python microservices and Java APIs at scale. Led migration of legacy monolith to event-driven architecture, reducing latency 40%...</p>
            </div>
            <div className="mt-2">
              <p className="text-[7px] text-slate-600 uppercase mb-1">Keywords added</p>
              <div className="flex flex-wrap gap-1">
                {['fintech', 'microservices', 'payment systems', 'event-driven', 'Python', 'scalable'].map(kw => (
                  <span key={kw} className="text-[7px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Quick Wins */}
        <FadeIn delay={900}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-2"><Zap className="w-3 h-3 text-amber-400" /> Quick Wins</p>
            {[
              { action: 'Add "Open to Work" badge for recruiters only', impact: 'high', time: '30 sec' },
              { action: 'Add a Featured section with your best project', impact: 'high', time: '5 min' },
              { action: 'Get 3 skill endorsements from colleagues', impact: 'medium', time: '10 min' },
            ].map((win, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-amber-500/[0.04] border border-amber-500/10 rounded-lg mb-1.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 text-white ${win.impact === 'high' ? 'bg-red-500/80' : 'bg-amber-500/80'}`}>{i + 1}</div>
                <div className="flex-1">
                  <p className="text-[9px] font-medium text-white">{win.action}</p>
                  <span className="text-[7px] text-slate-600">{win.time}</span>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

// ─── Phase 3: Cold Outreach Form ──────────────────────────────────────────────

function OutreachForm({ onGenerate, isLoading }: { onGenerate: () => void; isLoading: boolean }) {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <div className="w-[48%] flex-shrink-0 flex flex-col">
        <FadeIn delay={0}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center"><Sparkles className="w-3 h-3 text-white" /></div>
            <p className="text-[10px] font-bold text-white">Career Tools</p>
          </div>
          <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-3">
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold text-slate-500"><Linkedin className="w-3 h-3" /> LinkedIn</div>
            <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white"><Send className="w-3 h-3" /> Cold Outreach</div>
          </div>
        </FadeIn>

        <div className="flex-1 overflow-y-auto pr-0.5 ct-scroll space-y-2" style={{ maxHeight: 440 }}>
          <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

          <FadeIn delay={200}>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Platform</p>
                <div className="flex gap-1">
                  <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[8px] font-medium bg-purple-500/15 border border-purple-500/40 text-purple-300"><Mail className="w-3 h-3" /> Email</div>
                  <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[8px] font-medium bg-white/[0.03] border border-white/[0.07] text-slate-500"><Linkedin className="w-3 h-3" /> LinkedIn</div>
                </div>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 mb-0.5">Tone</p>
                <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] text-white">Professional</div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={400}>
            <div>
              <p className="text-[8px] text-slate-500 mb-0.5">Type</p>
              <div className="grid grid-cols-2 gap-1">
                {['Job Inquiry', 'Referral Request', 'Networking', 'After Applying'].map((t, i) => (
                  <div key={t} className={`py-1.5 px-2 rounded-lg text-[8px] font-medium border text-center ${i === 0 ? 'bg-purple-500/15 border-purple-500/40 text-purple-300' : 'bg-white/[0.03] border-white/[0.07] text-slate-500'}`}>{t}</div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={600}>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mb-1">Recipient</p>
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <p className="text-[8px] text-slate-500 mb-0.5">Name</p>
                    <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                      <TypingText text="Sarah Chen" speed={40} delay={800} className="text-[9px] text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-500 mb-0.5">Their Role</p>
                    <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                      <TypingText text="Eng Manager" speed={40} delay={1200} className="text-[9px] text-white" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 mb-0.5">Company <span className="text-red-400">*</span></p>
                  <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                    <TypingText text="Stripe" speed={50} delay={1600} className="text-[9px] text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 mb-0.5">Context</p>
                  <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg h-[36px] overflow-hidden">
                    <TypingText text="Saw their post about Stripe's new payments API. Mutual connection with James from MIT." speed={10} delay={2000} className="text-[8px] text-slate-400 leading-snug" />
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={3200}>
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="w-full py-2 rounded-xl text-center text-[10px] font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-center gap-1.5 hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-3 h-3" /> Generate Outreach</>
              )}
            </button>
          </FadeIn>
        </div>
      </div>

      {/* Right — Empty state or Loading */}
      {isLoading ? (
        <LoadingCard
          message="Crafting your messages…"
          sub="Personalising tone, referencing context, generating 3 versions"
        />
      ) : (
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <FadeIn delay={500}>
            <div className="text-center px-6">
              <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-3">
                <Send className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mb-1">Messages appear here</p>
              <p className="text-[9px] text-slate-600 max-w-[200px] leading-relaxed">Fill in recipient details. Context makes messages feel personal.</p>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}

// ─── Phase 4: Outreach Results ────────────────────────────────────────────────

function OutreachResults() {
  const [activeVersion, setActiveVersion] = useState(0);

  const versions = [
    { label: 'Best', approach: 'Value-first: lead with what you can offer Stripe, not what you want.',
      subject: "Quick question about Stripe's new payments API architecture",
      body: "Hi Sarah,\n\nI noticed your post about Stripe's new payments API — the shift to idempotent request handling is exactly what I've been building at JPMorgan for our real-time settlement system.\n\nI led a team that redesigned our payment processing pipeline to handle 50K TPS with 99.99% uptime. James Lee mentioned your team is scaling the infrastructure side — I'd love to hear more about the challenges you're tackling.\n\nWould a 15-min chat next week work?\n\nBest,\nAlex" },
    { label: 'Option 2', approach: 'Mutual connection angle: leverage the shared network.',
      subject: 'James Lee suggested I reach out — payments engineering',
      body: "Hi Sarah,\n\nJames Lee suggested I reach out — he mentioned your team at Stripe is doing impressive work on the payments infrastructure.\n\nI've spent the last 4 years building financial APIs at JPMorgan, and I'm exploring what's next. Your recent post about API design really resonated with the challenges I've been solving.\n\nWould you be open to a brief chat about what it's like on the engineering side at Stripe?\n\nCheers,\nAlex" },
    { label: 'Option 3', approach: 'Direct & bold: express clear interest upfront.',
      subject: "Interested in Stripe's backend engineering team",
      body: "Hi Sarah,\n\nI'll keep this short — I'm a backend engineer with 5 years in fintech (JPMorgan), and Stripe's payments team is at the top of my list.\n\nI saw the Senior Backend role and your post about the API redesign. My experience scaling payment systems to 50K TPS maps directly to what you're building.\n\nCould I get 10 minutes of your time this week?\n\nThanks,\nAlex" },
  ];

  const active = versions[activeVersion];

  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

      {/* Left — compact form summary */}
      <div className="w-[35%] flex-shrink-0 overflow-y-auto ct-scroll" style={{ maxHeight: 520 }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center"><Sparkles className="w-3 h-3 text-white" /></div>
          <p className="text-[10px] font-bold text-white">Career Tools</p>
        </div>
        <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-3">
          <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold text-slate-500"><Linkedin className="w-3 h-3" /> LinkedIn</div>
          <div className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white"><Send className="w-3 h-3" /> Outreach</div>
        </div>
        <div className="space-y-1.5">
          {[
            { l: 'To', v: 'Sarah Chen · Eng Manager' },
            { l: 'Company', v: 'Stripe' },
            { l: 'Type', v: 'Job Inquiry' },
            { l: 'Platform', v: 'Email' },
            { l: 'Context', v: 'Post about Stripe API, mutual connection James' },
          ].map(f => (
            <div key={f.l}>
              <p className="text-[7px] text-slate-600">{f.l}</p>
              <p className="text-[9px] text-slate-400 truncate">{f.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Results */}
      <div className="flex-1 min-w-0 overflow-y-auto ct-scroll space-y-2.5" style={{ maxHeight: 520 }}>
        {/* Version tabs */}
        <FadeIn delay={0}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-white flex items-center gap-1.5"><MessageSquare className="w-3 h-3 text-emerald-400" /> Cold Emails</p>
              <span className="text-[8px] text-slate-600">3 versions</span>
            </div>
            <div className="flex gap-1 mb-3">
              {versions.map((v, i) => (
                <button key={i} onClick={() => setActiveVersion(i)}
                  className={`px-2.5 py-1 rounded-lg text-[8px] font-semibold transition-all cursor-pointer ${activeVersion === i ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'}`}>
                  {v.label}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-1.5 p-2 bg-violet-500/[0.06] border border-violet-500/15 rounded-lg mb-2">
              <Info className="w-2.5 h-2.5 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-[8px] text-violet-300 leading-relaxed">{active.approach}</p>
            </div>

            <div className="mb-2">
              <p className="text-[7px] text-slate-600 uppercase mb-0.5">Subject line</p>
              <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                <p className="text-[9px] text-white font-medium">{active.subject}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[7px] text-slate-600 uppercase">Message</p>
                <span className="text-[7px] text-slate-500 flex items-center gap-0.5"><Copy className="w-2 h-2" /> Copy</span>
              </div>
              <div className="p-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                <p className="text-[9px] text-slate-200 leading-relaxed whitespace-pre-line">{active.body}</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Follow-up */}
        <FadeIn delay={400}>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-2"><RefreshCw className="w-3 h-3 text-blue-400" /> Follow-up Template</p>
            <div className="flex items-center gap-1.5 p-1.5 bg-blue-500/[0.06] border border-blue-500/15 rounded mb-2">
              <Info className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
              <p className="text-[8px] text-blue-300">Send 3–5 business days after initial email</p>
            </div>
            <div className="p-2 bg-white/[0.03] border border-white/[0.07] rounded-lg">
              <p className="text-[8px] text-slate-300 leading-relaxed">Hi Sarah, just bumping this to the top — I know inboxes move fast. Would a 10-minute call work this week? Happy to share more about the payment pipeline work I mentioned. No worries if the timing isn&apos;t right.</p>
            </div>
          </div>
        </FadeIn>

        {/* Tips */}
        <FadeIn delay={700}>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <p className="text-[8px] font-bold text-emerald-400 flex items-center gap-1 mb-1.5"><CheckCircle2 className="w-2.5 h-2.5" /> Do This</p>
              {['Reference their specific content', 'Mention the mutual connection early', 'Keep it under 150 words'].map((t, i) => (
                <div key={i} className="flex items-start gap-1 mb-0.5"><ArrowRight className="w-2 h-2 text-emerald-400 flex-shrink-0 mt-0.5" /><p className="text-[7px] text-slate-300 leading-snug">{t}</p></div>
              ))}
            </div>
            <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <p className="text-[8px] font-bold text-red-400 flex items-center gap-1 mb-1.5"><XCircle className="w-2.5 h-2.5" /> Don&apos;t Do This</p>
              {['Start with "I\'m looking for..."', 'Attach your resume unsolicited', 'Send the same message to 50 people'].map((t, i) => (
                <div key={i} className="flex items-start gap-1 mb-0.5"><AlertTriangle className="w-2 h-2 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-[7px] text-slate-300 leading-snug">{t}</p></div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

// ─── Phase 5: Interactive (user explores both tools — two-panel layout) ───────

function InteractiveView() {
  const [activeTool, setActiveTool] = useState<'linkedin' | 'outreach'>('linkedin');
  const [activeVersion, setActiveVersion] = useState(0);

  const versions = [
    { label: 'Best', approach: 'Value-first: lead with what you can offer Stripe, not what you want.',
      subject: "Quick question about Stripe's new payments API architecture",
      body: "Hi Sarah,\n\nI noticed your post about Stripe's new payments API — the shift to idempotent request handling is exactly what I've been building at JPMorgan for our real-time settlement system.\n\nI led a team that redesigned our payment processing pipeline to handle 50K TPS with 99.99% uptime. James Lee mentioned your team is scaling the infrastructure side — I'd love to hear more about the challenges you're tackling.\n\nWould a 15-min chat next week work?\n\nBest,\nAlex" },
    { label: 'Option 2', approach: 'Mutual connection angle: leverage the shared network.',
      subject: 'James Lee suggested I reach out — payments engineering',
      body: "Hi Sarah,\n\nJames Lee suggested I reach out — he mentioned your team at Stripe is doing impressive work on the payments infrastructure.\n\nI've spent the last 4 years building financial APIs at JPMorgan, and I'm exploring what's next. Your recent post about API design really resonated with the challenges I've been solving.\n\nWould you be open to a brief chat about what it's like on the engineering side at Stripe?\n\nCheers,\nAlex" },
    { label: 'Option 3', approach: 'Direct & bold: express clear interest upfront.',
      subject: "Interested in Stripe's backend engineering team",
      body: "Hi Sarah,\n\nI'll keep this short — I'm a backend engineer with 5 years in fintech (JPMorgan), and Stripe's payments team is at the top of my list.\n\nI saw the Senior Backend role and your post about the API redesign. My experience scaling payment systems to 50K TPS maps directly to what you're building.\n\nCould I get 10 minutes of your time this week?\n\nThanks,\nAlex" },
  ];

  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <style dangerouslySetInnerHTML={{ __html: SCROLL_CSS }} />

      {/* Left — Form summary + tool switcher */}
      <div className="w-[42%] flex-shrink-0 overflow-y-auto pr-0.5 ct-scroll" style={{ maxHeight: 520 }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center"><Sparkles className="w-3 h-3 text-white" /></div>
          <p className="text-[10px] font-bold text-white">Career Tools</p>
        </div>

        {/* Tool tabs */}
        <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-3">
          {[
            { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
            { id: 'outreach' as const, label: 'Outreach', icon: Send },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTool(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[8px] font-semibold transition-all cursor-pointer ${
                activeTool === t.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <t.icon className="w-3 h-3" /> {t.label}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="text-[8px] text-indigo-400 text-center mb-2.5 font-medium">✨ Switch tabs to explore both tools</p>

        {/* Form summary — changes based on active tool */}
        {activeTool === 'linkedin' ? (
          <div className="space-y-2">
            {[
              { label: 'Headline', value: 'Software Developer | Java | Python' },
              { label: 'About', value: 'Passionate software developer with 5 years of experience building web applications...' },
              { label: 'Target Role', value: 'Senior SWE' },
              { label: 'Industry', value: 'Fintech' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[8px] text-slate-600 mb-0.5">{f.label}</p>
                <p className="text-[9px] text-slate-400 px-2 py-1.5 bg-white/[0.02] border border-white/[0.05] rounded-lg truncate">{f.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {[
              { l: 'To', v: 'Sarah Chen · Eng Manager' },
              { l: 'Company', v: 'Stripe' },
              { l: 'Type', v: 'Job Inquiry' },
              { l: 'Platform', v: 'Email' },
              { l: 'Context', v: 'Post about Stripe API, mutual connection James' },
            ].map(f => (
              <div key={f.l}>
                <p className="text-[7px] text-slate-600">{f.l}</p>
                <p className="text-[9px] text-slate-400 truncate">{f.v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — Results (changes based on active tool) */}
      <div className="flex-1 min-w-0 overflow-y-auto ct-scroll space-y-2.5" style={{ maxHeight: 520 }}>
        {activeTool === 'linkedin' ? (
          <>
            {/* Score */}
            <FadeIn delay={0}>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center gap-3">
                  <ScoreRing score={42} size={52} color="#f59e0b" delay={0} />
                  <div className="flex-1">
                    <p className="text-[8px] text-slate-500 uppercase tracking-widest font-semibold">Profile Strength</p>
                    <p className="text-[12px] font-bold text-amber-400">Needs Work</p>
                    <p className="text-[8px] text-slate-500 mt-0.5 italic">&ldquo;Generic headline, missing keywords recruiters search for.&rdquo;</p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-white/[0.05]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] text-slate-500 flex items-center gap-1"><Search className="w-2.5 h-2.5" /> Search visibility</span>
                    <span className="text-[8px] text-white font-medium">28 <span className="text-slate-600">→</span> <span className="text-emerald-400">78</span></span>
                  </div>
                  <div className="relative h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-white/10 rounded-full" style={{ width: '28%' }} />
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full opacity-60" style={{ width: '78%' }} />
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Headline */}
            <FadeIn delay={200}>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-white flex items-center gap-1.5"><Edit3 className="w-3 h-3 text-blue-400" /> Headline</p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-semibold text-red-400 bg-red-500/10 border-red-500/20">32/100</span>
                </div>
                <div className="p-2 bg-red-500/[0.06] border border-red-500/15 rounded-lg mb-2">
                  <p className="text-[7px] text-red-400 font-semibold uppercase mb-0.5">Problem</p>
                  <p className="text-[9px] text-slate-300 leading-relaxed">Generic title with no value proposition. Matches millions of profiles.</p>
                </div>
                <div className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                  <p className="text-[7px] text-emerald-400 font-semibold uppercase mb-1">Optimised</p>
                  <p className="text-[10px] text-white font-medium leading-relaxed">Senior Software Engineer | Building Scalable Fintech Systems | Python & Java | Ex-JPMorgan</p>
                  <p className="text-[8px] text-slate-500 mt-1">4x more searchable with target role, industry, skills, and social proof.</p>
                </div>
              </div>
            </FadeIn>

            {/* About */}
            <FadeIn delay={400}>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-white flex items-center gap-1.5"><Users className="w-3 h-3 text-violet-400" /> About Section</p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-semibold text-amber-400 bg-amber-500/10 border-amber-500/20">45/100</span>
                </div>
                <div className="p-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                  <p className="text-[7px] text-emerald-400 font-semibold uppercase mb-1">Optimised About</p>
                  <p className="text-[9px] text-slate-300 leading-relaxed">Full-stack engineer with 5+ years building payment systems processing $2B+ annually. Specialise in Python microservices and Java APIs at scale. Led migration of legacy monolith to event-driven architecture, reducing latency 40%...</p>
                </div>
                <div className="mt-2">
                  <p className="text-[7px] text-slate-600 uppercase mb-1">Keywords added</p>
                  <div className="flex flex-wrap gap-1">
                    {['fintech', 'microservices', 'payment systems', 'event-driven', 'Python', 'scalable'].map(kw => (
                      <span key={kw} className="text-[7px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Quick Wins */}
            <FadeIn delay={600}>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <p className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-2"><Zap className="w-3 h-3 text-amber-400" /> Quick Wins</p>
                {[
                  { action: 'Add "Open to Work" badge for recruiters only', time: '30 sec' },
                  { action: 'Add a Featured section with your best project', time: '5 min' },
                  { action: 'Get 3 skill endorsements from colleagues', time: '10 min' },
                ].map((win, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-amber-500/[0.04] border border-amber-500/10 rounded-lg mb-1.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 text-white bg-amber-500/80">{i + 1}</div>
                    <div className="flex-1">
                      <p className="text-[9px] font-medium text-white">{win.action}</p>
                      <span className="text-[7px] text-slate-600">{win.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </>
        ) : (
          <>
            {/* Cold Emails */}
            <FadeIn delay={0}>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-white flex items-center gap-1.5"><MessageSquare className="w-3 h-3 text-emerald-400" /> Cold Emails</p>
                  <span className="text-[8px] text-slate-600">3 versions</span>
                </div>
                <div className="flex gap-1 mb-3">
                  {versions.map((v, i) => (
                    <button key={i} onClick={() => setActiveVersion(i)}
                      className={`px-2.5 py-1 rounded-lg text-[8px] font-semibold transition-all cursor-pointer ${activeVersion === i ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-start gap-1.5 p-2 bg-violet-500/[0.06] border border-violet-500/15 rounded-lg mb-2">
                  <Info className="w-2.5 h-2.5 text-violet-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[8px] text-violet-300 leading-relaxed">{versions[activeVersion].approach}</p>
                </div>
                <div className="mb-2">
                  <p className="text-[7px] text-slate-600 uppercase mb-0.5">Subject line</p>
                  <div className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                    <p className="text-[9px] text-white font-medium">{versions[activeVersion].subject}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[7px] text-slate-600 uppercase">Message</p>
                    <span className="text-[7px] text-slate-500 flex items-center gap-0.5"><Copy className="w-2 h-2" /> Copy</span>
                  </div>
                  <div className="p-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                    <p className="text-[9px] text-slate-200 leading-relaxed whitespace-pre-line">{versions[activeVersion].body}</p>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Follow-up */}
            <FadeIn delay={300}>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <p className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-2"><RefreshCw className="w-3 h-3 text-blue-400" /> Follow-up Template</p>
                <div className="flex items-center gap-1.5 p-1.5 bg-blue-500/[0.06] border border-blue-500/15 rounded mb-2">
                  <Info className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                  <p className="text-[8px] text-blue-300">Send 3–5 business days after initial email</p>
                </div>
                <div className="p-2 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                  <p className="text-[8px] text-slate-300 leading-relaxed">Hi Sarah, just bumping this to the top — I know inboxes move fast. Would a 10-minute call work this week? Happy to share more about the payment pipeline work I mentioned. No worries if the timing isn&apos;t right.</p>
                </div>
              </div>
            </FadeIn>

            {/* Tips */}
            <FadeIn delay={600}>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                  <p className="text-[8px] font-bold text-emerald-400 flex items-center gap-1 mb-1.5"><CheckCircle2 className="w-2.5 h-2.5" /> Do This</p>
                  {['Reference their specific content', 'Mention the mutual connection early', 'Keep it under 150 words'].map((t, i) => (
                    <div key={i} className="flex items-start gap-1 mb-0.5"><ArrowRight className="w-2 h-2 text-emerald-400 flex-shrink-0 mt-0.5" /><p className="text-[7px] text-slate-300 leading-snug">{t}</p></div>
                  ))}
                </div>
                <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                  <p className="text-[8px] font-bold text-red-400 flex items-center gap-1 mb-1.5"><XCircle className="w-2.5 h-2.5" /> Don&apos;t Do This</p>
                  {['Start with "I\'m looking for..."', 'Attach your resume unsolicited', 'Send same message to 50 people'].map((t, i) => (
                    <div key={i} className="flex items-start gap-1 mb-0.5"><AlertTriangle className="w-2 h-2 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-[7px] text-slate-300 leading-snug">{t}</p></div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

type Phase = 'li-form' | 'li-loading' | 'li-results' | 'or-form' | 'or-loading' | 'or-results' | 'interactive';

const LOADING_DURATION = 2000; // ms to show loading spinner

export function CareerToolsExamplePreview({ step }: { step: number }) {
  const [phase, setPhase] = useState<Phase>('li-form');
  const [autoMode, setAutoMode] = useState(true);

  // ── Auto-play driven by external `step` prop ──
  // serviceConfig steps:
  //   0 → "Filling LinkedIn details…"   → li-form
  //   1 → "Optimising profile…"         → li-loading
  //   2 → "LinkedIn results ready!"     → li-results
  //   3 → "Setting up cold outreach…"   → or-form
  //   4 → "Generating messages…"        → or-loading
  //   5 → "Outreach ready!"             → or-results
  //   6+ → interactive
  useEffect(() => {
    if (!autoMode) return;
    if (step <= 0) setPhase('li-form');
    else if (step === 1) setPhase('li-loading');
    else if (step === 2) setPhase('li-results');
    else if (step === 3) setPhase('or-form');
    else if (step === 4) setPhase('or-loading');
    else if (step === 5) setPhase('or-results');
    else setPhase('interactive');
  }, [step, autoMode]);

  // ── Auto-transition from loading → results ──
  useEffect(() => {
    if (phase === 'li-loading') {
      const t = setTimeout(() => setPhase('li-results'), LOADING_DURATION);
      return () => clearTimeout(t);
    }
    if (phase === 'or-loading') {
      const t = setTimeout(() => setPhase('or-results'), LOADING_DURATION);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── Click handlers (switch to manual mode) ──
  const handleLinkedInGenerate = useCallback(() => {
    setAutoMode(false);
    setPhase('li-loading');
  }, []);

  const handleOutreachGenerate = useCallback(() => {
    setAutoMode(false);
    setPhase('or-loading');
  }, []);

  // ── Manual mode: auto-advance from results after a pause ──
  // (In auto mode the serviceConfig durations handle pacing,
  //  so we only need this for manual / click-driven flow)
  useEffect(() => {
    if (autoMode) return;
    if (phase === 'li-results') {
      const t = setTimeout(() => setPhase('or-form'), 4000);
      return () => clearTimeout(t);
    }
    if (phase === 'or-results') {
      const t = setTimeout(() => setPhase('interactive'), 4000);
      return () => clearTimeout(t);
    }
  }, [phase, autoMode]);

  switch (phase) {
    case 'li-form':
      return <LinkedInForm onGenerate={handleLinkedInGenerate} isLoading={false} />;
    case 'li-loading':
      return <LinkedInForm onGenerate={handleLinkedInGenerate} isLoading={true} />;
    case 'li-results':
      return <LinkedInResults />;
    case 'or-form':
      return <OutreachForm onGenerate={handleOutreachGenerate} isLoading={false} />;
    case 'or-loading':
      return <OutreachForm onGenerate={handleOutreachGenerate} isLoading={true} />;
    case 'or-results':
      return <OutreachResults />;
    case 'interactive':
      return <InteractiveView />;
    default:
      return <LinkedInForm onGenerate={handleLinkedInGenerate} isLoading={false} />;
  }
}