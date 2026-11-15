// app/(root)/apply/page.tsx
//
// Start the "Apply to this job" flow: pick a job already in the tracker (the
// extension saves jobs there) or add one here with its description.
// ?company=&role= (or &title=)&jobUrl= prefill the form, for links from the
// extension and the public /jobs page.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, Plus, Briefcase, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';

interface TrackedJob {
  id: string;
  company: string;
  jobTitle: string;
  status: string;
  jobDescription: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  wishlist: 'Not applied yet', applied: 'Applied', 'phone-screen': 'Phone screen', technical: 'Technical',
  final: 'Final round', offer: 'Offer', rejected: 'Rejected', ghosted: 'No response', withdrew: 'Withdrew',
};
const ACTIVE = ['wishlist', 'applied', 'phone-screen', 'technical', 'final'];

export default function ApplyStartPage() {
  const router = useRouter();
  const [user, loading] = useSupabaseUser();
  const [jobs, setJobs] = useState<TrackedJob[] | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jd, setJd] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setCompany(q.get('company')?.slice(0, 200) ?? '');
    setRole((q.get('role') || q.get('title'))?.slice(0, 200) ?? '');
    setJobUrl(q.get('jobUrl')?.slice(0, 1000) ?? '');
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/job-tracker')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => setJobs((j.data as TrackedJob[]).filter(a => ACTIVE.includes(a.status))))
      .catch(() => setJobs([]));
  }, [user]);

  const start = async () => {
    if (!company.trim() || !role.trim()) { toast.error('Add the company and the role.'); return; }
    if (jd.trim().length < 50) { toast.error('Paste the job description. Tailoring needs it.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/job-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, jobTitle: role, jobUrl: jobUrl || null, status: 'wishlist', source: 'Preciprocal Apply', jobDescription: jd }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Could not save the job');
      router.push(`/apply/${j.data?.id ?? j.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the job');
      setCreating(false);
    }
  };

  if (loading || !user) return <AnimatedLoader isVisible loadingText="Loading" showNavigation />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Apply to a job"
        icon={Send}
        description="Tailor your resume and cover letter to one job, then prepare for each round."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-indigo-300" /> From your job tracker</h2>
          <p className="text-[13px] text-slate-400 mb-4">Jobs you saved, including from the Chrome extension.</p>
          {jobs === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading your jobs</div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No active jobs yet. Add one on the right, or save one with the extension.</p>
          ) : (
            <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {jobs.map(j => (
                <li key={j.id}>
                  <Link href={`/apply/${j.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[var(--accent-border)] hover:bg-white/[0.04] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{j.jobTitle}</p>
                      <p className="text-xs text-slate-400 truncate">{j.company} · {STATUS_LABEL[j.status] ?? j.status}{j.jobDescription ? '' : ' · no description saved'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1"><Plus className="w-4 h-4 text-indigo-300" /> A new job</h2>
          <p className="text-[13px] text-slate-400 mb-4">It is added to your tracker as not applied yet.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="field w-full" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
              <input className="field w-full" placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
            </div>
            <input className="field w-full" placeholder="Job posting URL (optional)" value={jobUrl} onChange={e => setJobUrl(e.target.value)} />
            <textarea className="field w-full min-h-[200px] py-3 leading-relaxed" placeholder="Paste the full job description" value={jd} onChange={e => setJd(e.target.value)} />
            <button onClick={start} disabled={creating} className="btn-primary w-full justify-center disabled:opacity-50">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Start
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
