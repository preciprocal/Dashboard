// components/ServiceExampleModal/examples/resume/ResumeRecruiterTab.tsx
'use client';

import {
  Shield, Users, AlertTriangle, CheckCircle2, Eye, Clock,
  TrendingUp, MessageSquare,
} from 'lucide-react';

export function ResumeRecruiterTab() {
  return (
    <div className="space-y-2 text-left">
      {/* Overall Score */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-white">Overall Score</p>
            <p className="text-[8px] text-slate-500">Comprehensive AI evaluation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className="text-[20px] font-bold text-white leading-none">75</span>
            <span className="text-[9px] text-amber-400 font-semibold ml-1.5">Good</span>
            <p className="text-[8px] text-slate-500">out of 100</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-[7px] text-slate-500">Current</p>
              <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} />
              </div>
              <p className="text-[7px] text-emerald-400 mt-0.5">75%</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] text-slate-500">Potential</p>
              <div className="w-6 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: '100%' }} />
              </div>
              <p className="text-[7px] text-emerald-400 mt-0.5">+20%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Perspective Analysis */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold text-white">Multi-Perspective Analysis</p>
            <p className="text-[7px] text-slate-500">Viewing your resume from three perspectives: HR Recruiter, Technical Lead, and Hiring Manager.</p>
          </div>
        </div>
      </div>

      {/* First Impression */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold text-white">First Impression</p>
              <p className="text-[8px] text-emerald-400 font-medium">Likely to pass initial screening</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[18px] font-bold text-white leading-none">72</span>
            <p className="text-[7px] text-slate-500">Score</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              <p className="text-[7px] text-slate-500">Total review time</p>
            </div>
            <p className="text-[11px] font-bold text-white">7s</p>
          </div>
          <div className="flex-1 p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Eye className="w-2.5 h-2.5 text-slate-400" />
              <p className="text-[7px] text-slate-500">First glance</p>
            </div>
            <p className="text-[11px] font-bold text-white">3s</p>
          </div>
        </div>
      </div>

      {/* Elements that stand out */}
      <div className="p-2.5 bg-emerald-500/[0.04] border-l-2 border-emerald-500/40 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <p className="text-[9px] font-bold text-emerald-400">Elements that stand out</p>
        </div>
        <div className="space-y-1">
          {[
            'The role at Datadog as Software Engineer Co-op with strong quantified metrics (2M+ events/sec, 40% latency reduction) immediately signals competence.',
            'Progression from Cognizant → TechVision → Wayfair → Datadog shows clear upward career trajectory.',
            'Project section (SmartHire AI, FinTrack) demonstrates initiative beyond employment.',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1" />
              <p className="text-[7.5px] text-slate-400 leading-snug">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Elements that raise concerns */}
      <div className="p-2.5 bg-amber-500/[0.04] border-l-2 border-amber-500/40 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <p className="text-[9px] font-bold text-amber-400">Elements that raise concerns</p>
        </div>
        <div className="space-y-1">
          {[
            "Cognizant bullet 'Built automated testing suite covering 85% of codebase' — this describes a duty, not an achievement. Zero business impact shown.",
            'Lack of a professional summary section means the recruiter has to infer fit rather than being told directly.',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
              <p className="text-[7.5px] text-slate-400 leading-snug">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attention Heatmap */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold text-white">Attention Heatmap</p>
              <p className="text-[7px] text-slate-500">Time spent per section</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[6px] text-slate-500">Low</span>
            <div className="w-2 h-2 rounded-sm bg-red-500" />
            <div className="w-2 h-2 rounded-sm bg-amber-500" />
            <div className="w-2 h-2 rounded-sm bg-emerald-500" />
            <span className="text-[6px] text-slate-500">High</span>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { section: 'Work Experience', time: '4s', score: 80, notes: 'Strong role at Datadog with quantified metrics. The progression from Cognizant to Datadog shows clear growth. However, the Cognizant bullets lack specific impact.', barColor: 'bg-amber-500', dotColor: 'bg-amber-400' },
            { section: 'Skills', time: '1.5s', score: 70, notes: 'Good coverage of relevant technologies — Python, Go, Kubernetes, AWS. Well-categorized into 4 groups which aids quick scanning.', barColor: 'bg-emerald-500', dotColor: 'bg-emerald-400' },
            { section: 'Education', time: '0.5s', score: 35, notes: 'MS Computer Science from Boston University carries solid weight. Relevant coursework listed strengthens the education section.', barColor: 'bg-red-500', dotColor: 'bg-red-400' },
            { section: 'Projects', time: '1s', score: 55, notes: 'SmartHire AI and FinTrack demonstrate hands-on initiative. Including user numbers (1,000+ and 500+) adds credibility.', barColor: 'bg-amber-500', dotColor: 'bg-amber-400' },
          ].map(item => (
            <div key={item.section} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold text-white">{item.section}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[7px] text-slate-500">Time</span>
                  <span className="text-[9px] font-bold text-white">{item.time}</span>
                  <div className={`w-2.5 h-5 rounded-sm ${item.dotColor}`} />
                </div>
              </div>
              <p className="text-[7.5px] text-amber-400/80 italic leading-snug mb-1.5">{item.notes}</p>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex">
                <div className={`h-full ${item.barColor} rounded-l-full`} style={{ width: `${item.score}%` }} />
                <div className="h-full bg-slate-700/50 flex-1 rounded-r-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recruiter's internal notes */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 h-5 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-2.5 h-2.5 text-blue-400" />
          </div>
          <p className="text-[9px] font-bold text-blue-400">Recruiter&apos;s internal notes</p>
        </div>
        <div className="space-y-1.5">
          {[
            'This candidate has strong experience at Datadog and Wayfair with quantified achievements. The technical progression is impressive. Worth moving forward to technical screen.',
            "The biggest gap is the Cognizant role — it reads like a job description, not an achievement list. They should revise those bullets before the next round.",
            'Overall a solid resume with room to improve. Recommend for first-round technical interview based on Datadog experience alone.',
          ].map((note, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1" />
              <p className="text-[7.5px] text-slate-400 leading-snug">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}