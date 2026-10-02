// lib/analytics/features.ts
// Which product area a URL belongs to. Shared by the browser tracker (to tag
// every event) and the admin analytics page (to label it), so the two can
// never disagree about what "interview" means.
//
// Most specific prefix first: /interview/create is still "interview", but
// /job-tracker must not be swallowed by a shorter /job prefix.

export const FEATURES: readonly { key: string; label: string; prefixes: string[] }[] = [
  { key: 'dashboard',      label: 'Dashboard',            prefixes: ['/'] },
  { key: 'resume',         label: 'Resume analysis',      prefixes: ['/resume'] },
  { key: 'interview',      label: 'Mock interviews',      prefixes: ['/interview'] },
  { key: 'cover-letter',   label: 'Cover letters',        prefixes: ['/cover-letter'] },
  { key: 'job-tracker',    label: 'Job tracker',          prefixes: ['/job-tracker'] },
  { key: 'planner',        label: 'Study planner',        prefixes: ['/planner'] },
  { key: 'debrief',        label: 'Interview journal',    prefixes: ['/debrief'] },
  { key: 'career-tools',   label: 'Career tools',         prefixes: ['/career-tools', '/job-tools', '/job-application', '/job-recommendation', '/recruiter-analysis'] },
  { key: 'templates',      label: 'Templates',            prefixes: ['/templates'] },
  { key: 'profile',        label: 'Profile',              prefixes: ['/profile'] },
  { key: 'settings',       label: 'Settings',             prefixes: ['/settings'] },
  { key: 'help',           label: 'Help and support',     prefixes: ['/help'] },
  { key: 'pricing',        label: 'Pricing',              prefixes: ['/pricing', '/subscription'] },
  { key: 'admin',          label: 'Admin',                prefixes: ['/admin'] },
];

export function featureOf(path: string): string {
  let best: { key: string; len: number } = { key: 'other', len: 0 };
  for (const f of FEATURES) {
    for (const p of f.prefixes) {
      const hit = p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`);
      if (hit && p.length > best.len) best = { key: f.key, len: p.length };
    }
  }
  return best.key;
}

export function featureLabel(key: string): string {
  return FEATURES.find(f => f.key === key)?.label ?? 'Other';
}
