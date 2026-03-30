// components/ServiceExampleModal/examples/resume/ResumeBenchmarkTab.tsx
'use client';

import {
  Users, Eye, AlertTriangle, BarChart3, Star, Zap, Target, ChevronRight,
} from 'lucide-react';
import { AnimatedBar, PercentileGauge } from '../../primitives';

export function ResumeBenchmarkTab() {
  return (
    <div className="space-y-2 text-left">
      {/* Benchmark header */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-white">Candidate Benchmark</p>
            <p className="text-[8px] text-slate-500">vs. real hired candidates for Software Engineer</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[7px] px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-slate-500">cached</span>
          </div>
        </div>
        <div className="flex items-center gap-3 p-2 bg-amber-500/[0.04] border border-amber-500/15 rounded-lg">
          <PercentileGauge percentile={65} />
          <div className="flex-1 text-left">
            <p className="text-[9px] font-bold text-amber-300">— Moderate Chance of Interview</p>
            <p className="text-[8px] text-slate-400 mt-0.5 leading-snug">The resume demonstrates relevant experience and skills for a Software Engineer role. However, the impact of achievements is not consistently quantified, which may hinder competitiveness against stronger candidates.</p>
          </div>
        </div>
      </div>

      {/* Recruiter's first impression */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Eye className="w-3 h-3 text-slate-400" />
          <p className="text-[8px] text-slate-500 uppercase tracking-wide font-semibold">Recruiter&apos;s First Impression (6 Seconds)</p>
        </div>
        <p className="text-[8px] text-slate-300 italic leading-snug">&quot;The resume shows a solid foundation in software engineering with relevant experience, but the lack of consistent metrics makes it hard to gauge the true impact of the work. The formatting issues also stand out, making it feel less polished than it could be.&quot;</p>
      </div>

      {/* Major issue */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-3 h-3 text-red-400" />
          </div>
          <p className="text-[7px] text-red-400 uppercase tracking-wide font-bold">Major Issue</p>
        </div>
        <p className="text-[9px] font-bold text-white text-left mb-1">Insufficient Quantified Impact</p>
        <p className="text-[8px] text-slate-400 leading-snug text-left">While the resume includes some metrics, such as &apos;40% reduction in alert latency&apos; and &apos;22% lift in recommendations&apos;, many bullets lack quantifiable results. For instance, the Cognizant bullet &apos;Built automated testing suite covering 85% of codebase&apos; doesn&apos;t specify the business impact. This lack of clear, measurable outcomes is likely costing interviews.</p>
      </div>

      {/* Dimension breakdown */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 bg-indigo-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold text-white">Dimension Breakdown</p>
            <p className="text-[7px] text-slate-500">Click any row to see the honest take</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[
            { label: 'ATS Compatibility', score: 75, tag: 'Competitive', tagColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20', barColor: 'bg-emerald-500', behind: 5, all: 65, hired: 80, top: 90, pct: '70th' },
            { label: 'Content Quality', score: 78, tag: 'Competitive', tagColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20', barColor: 'bg-emerald-500', behind: 2, all: 65, hired: 80, top: 90, pct: '75th' },
            { label: 'Structure & Format', score: 65, tag: 'Weak', tagColor: 'text-red-400 bg-red-500/10 border border-red-500/20', barColor: 'bg-red-500', behind: 10, all: 60, hired: 75, top: 85, pct: '60th' },
            { label: 'Skills & Keywords', score: 80, tag: 'Strong', tagColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20', barColor: 'bg-emerald-500', behind: 5, all: 70, hired: 85, top: 90, pct: '80th' },
            { label: 'Impact & Achievements', score: 70, tag: 'Competitive', tagColor: 'text-amber-400 bg-amber-500/10 border border-amber-500/20', barColor: 'bg-amber-500', behind: 10, all: 60, hired: 80, top: 90, pct: '65th' },
          ].map(dim => (
            <div key={dim.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-white">{dim.label}</span>
                  <span className={`px-1 py-0.5 rounded text-[7px] font-semibold ${dim.tagColor}`}>{dim.tag}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-white">{dim.score}</span>
                  <span className="text-[7px] text-slate-600">/100</span>
                  <span className="text-[7px] text-red-400">▼{dim.behind} behind</span>
                </div>
              </div>
              <div className="relative">
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${dim.barColor}`} style={{ width: `${dim.score}%`, transition: 'width 0.7s ease-out' }}>
                    <span className="absolute left-0 top-0 h-full flex items-center pl-1 text-[6px] font-bold text-white">{dim.score}</span>
                  </div>
                </div>
                <div className="flex justify-between mt-0.5 text-[6px] text-slate-600 relative">
                  <span>— All: {dim.all}</span>
                  <span>— Hired: {dim.hired}</span>
                  <span>— Top 10%: {dim.top}</span>
                  <span className="text-slate-500">You: {dim.pct} pct</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What hired candidates have */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Star className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold text-white">What Hired Candidates Have That You Don&apos;t</p>
            <p className="text-[7px] text-slate-500">Specific gaps vs. people who got the offer</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            'More consistent quantification of achievements across all roles, demonstrating clear business impact.',
            'A stronger emphasis on specific tools and technologies relevant to the Software Engineer role, tailored to job descriptions.',
            'Clearer formatting and organization that enhances readability and professionalism.',
          ].map((gap, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <ChevronRight className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[8px] text-slate-400 leading-snug">{gap}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Things to fix */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold text-white">3 Things to Fix Right Now</p>
            <p className="text-[7px] text-slate-500">Highest-leverage improvements, in order of priority</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { num: '1', title: "Revise the bullet points under each role to include specific metrics and outcomes, such as 'Increased revenue by X% through Y initiative'.", desc: "Quantifying your contributions will make your achievements more compelling and demonstrate your value to potential employers.", points: '+8–12 points on Content Quality' },
            { num: '2', title: 'Standardize the formatting of bullet points for consistency, ensuring uniform spacing and alignment.', desc: 'Improved formatting will enhance readability and present a more professional image to recruiters.', points: '+3–5 points on Structure & Format' },
            { num: '3', title: "Add specific tools and technologies relevant to Software Engineers, such as 'System Design' or 'Microservices Architecture', to the skills section.", desc: 'Including these keywords can improve ATS compatibility and align your resume more closely with what hiring managers are looking for.', points: '+5–7 points on ATS Compatibility' },
          ].map(fix => (
            <div key={fix.num} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0 mt-0.5">{fix.num}</span>
                <div className="text-left">
                  <p className="text-[8px] text-white font-semibold leading-snug">{fix.title}</p>
                  <p className="text-[7px] text-slate-500 mt-0.5 leading-snug">{fix.desc}</p>
                  <span className="inline-block mt-1 text-[7px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded font-semibold">{fix.points}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom line */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Target className="w-3 h-3 text-amber-400" />
          </div>
          <p className="text-[8px] text-slate-500 uppercase tracking-wide font-bold">Bottom Line</p>
        </div>
        <p className="text-[8px] text-slate-300 leading-snug">It would likely not get an interview due to insufficient quantification of achievements and formatting issues that detract from its overall professionalism.</p>
      </div>
    </div>
  );
}