// app/(root)/apply/start/page.tsx
//
// Where Auto mode on /jobs opens its new tab: /apply/start?job=<posting url>.
// The tab shows this page straight away (never a blank tab), checks the
// posting, adds it to the tracker and moves on to the Apply flow with ?auto=1.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { startApplication } from '@/lib/jobs/start-application';

export default function ApplyFromFeedPage() {
  const router = useRouter();
  const [user, loading] = useSupabaseUser();
  const [problem, setProblem] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    const job = new URLSearchParams(window.location.search).get('job') ?? '';
    if (!/^https?:\/\//i.test(job)) { setProblem('This link has no job posting in it.'); return; }
    startApplication(job)
      .then(r => {
        if ('closed' in r) setProblem(`${r.company} has closed this posting since our last check.`);
        else router.replace(`/apply/${r.id}?auto=1`);
      })
      .catch(e => setProblem(e instanceof Error ? e.message : 'Something went wrong'));
  }, [user, router]);

  if (!problem) return <AnimatedLoader isVisible loadingText="Getting your application ready" showNavigation />;

  return (
    <div className="max-w-lg mx-auto mt-16 glass-card p-6 text-center space-y-4">
      <AlertCircle className="w-8 h-8 text-rose-300 mx-auto" />
      <p className="text-sm text-slate-200">{problem}</p>
      <Link href="/jobs" className="btn-secondary h-9 inline-flex">Back to jobs</Link>
    </div>
  );
}
