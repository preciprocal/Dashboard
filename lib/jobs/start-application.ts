// lib/jobs/start-application.ts
//
// From a job in the feed to its Apply flow: reuse the tracker entry when the
// job is already tracked, otherwise check the posting is still open and add
// it to the tracker. Runs in the browser, as the signed-in student.

export type StartResult = { id: string } | { closed: true; company: string };

/** jobUrl -> tracker id, for the jobs the student already tracks. */
export async function trackedJobs(): Promise<Map<string, string>> {
  const r = await fetch('/api/job-tracker');
  const j = r.ok ? await r.json() : { data: [] };
  return new Map((j.data as { id: string; jobUrl: string | null }[]).filter(a => a.jobUrl).map(a => [a.jobUrl!, a.id]));
}

export async function startApplication(jobUrl: string, tracked?: Map<string, string>): Promise<StartResult> {
  const known = tracked ?? (await trackedJobs());
  const existing = known.get(jobUrl);
  if (existing) return { id: existing };

  const live = await fetch('/api/jobs/posting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: jobUrl }) });
  const p = await live.json();
  if (!live.ok) throw new Error(p.error || 'Could not check this posting');
  if (!p.open) return { closed: true, company: p.company || 'The employer' };

  const res = await fetch('/api/job-tracker', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: p.company, jobTitle: p.title, jobUrl: p.jobUrl, location: p.location || null,
      workType: /remote/i.test(p.location ?? '') ? 'remote' : 'onsite',
      status: 'wishlist', source: 'Preciprocal jobs', jobDescription: p.description || null,
    }),
  });
  const created = await res.json();
  if (!res.ok) throw new Error(created.error || 'Could not add it to your tracker');
  known.set(jobUrl, created.id);
  return { id: created.id };
}
