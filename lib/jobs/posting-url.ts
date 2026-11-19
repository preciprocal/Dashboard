// lib/jobs/posting-url.ts
//
// What a job posting's address says about it, for the extension's "I applied"
// saves (app/api/extension/track-job). After a student submits, the extension
// is often on the board's thank-you page, so the page title is "Thank you for
// applying" and the host is the job board (job-boards.greenhouse.io,
// jobs.ashbyhq.com, <company>.breezy.hr), not the employer. These helpers
// recover the posting itself and the employer from the address, so the save
// lands on the card the student already has for that job.

/** Hosted job boards where the employer is named in the address. */
const BOARDS: { host: RegExp; where: 'path' | 'subdomain'; keep: number }[] = [
  // job-boards.greenhouse.io/<org>/jobs/<id>, boards.greenhouse.io/<org>/jobs/<id>
  { host: /(^|\.)greenhouse\.io$/i, where: 'path', keep: 3 },
  // jobs.ashbyhq.com/<org>/<uuid>
  { host: /(^|\.)ashbyhq\.com$/i, where: 'path', keep: 2 },
  // jobs.lever.co/<org>/<uuid>
  { host: /(^|\.)lever\.co$/i, where: 'path', keep: 2 },
  // <org>.breezy.hr/p/<slug>
  { host: /\.breezy\.hr$/i, where: 'subdomain', keep: 2 },
  // apply.workable.com/<org>/j/<id>
  { host: /^apply\.workable\.com$/i, where: 'path', keep: 3 },
  // jobs.smartrecruiters.com/<org>/<id>
  { host: /^jobs\.smartrecruiters\.com$/i, where: 'path', keep: 2 },
];

/** Path endings that are a step of applying, not the posting. */
const STEP_SUFFIX = /\/(apply|application|applications|confirmation|confirm|thanks|thank-you|thankyou|success|submitted|done)\/?$/i;

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try { return new URL(url); } catch { return null; }
}

/**
 * The posting's own address: no fragment, no tracking tags, no apply or thank-you
 * step. Two saves of the same job, from the posting and from its confirmation
 * page, give the same answer.
 */
export function canonicalPostingUrl(url: string | null | undefined): string | null {
  const u = parse(url);
  if (!u) return url ?? null;
  const board = BOARDS.find(b => b.host.test(u.hostname));
  let parts = u.pathname.split('/').filter(Boolean);
  if (board) parts = parts.slice(0, board.keep);
  let path = '/' + parts.join('/');
  while (STEP_SUFFIX.test(path)) path = path.replace(STEP_SUFFIX, '') || '/';
  // Greenhouse also passes the job as ?gh_jid= on embedded boards.
  const gh = u.searchParams.get('gh_jid');
  // Elsewhere the query can be the job itself (?jobId=), so it is kept,
  // less tracking tags.
  let query = '';
  if (board) query = gh && !/\/jobs\/\d+/.test(path) ? `?gh_jid=${gh}` : '';
  else {
    const q = new URLSearchParams(u.search);
    for (const k of [...q.keys()]) if (/^(utm_|ref$|src$|source$|gh_src$|lever-source)/i.test(k)) q.delete(k);
    query = q.toString() ? `?${q}` : '';
  }
  return `${u.protocol}//${u.hostname.toLowerCase()}${path === '/' ? '' : path}${query}`;
}

const titleCase = (s: string) => s
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  // A short word with no vowels is an initialism (JND, IBM); the rest are words.
  .map(w => (w.length <= 4 && !/[aeiouy]/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
  .join(' ');

/** The employer named in a hosted job board's address, or '' when it does not say. */
export function companyFromPostingUrl(url: string | null | undefined): string {
  const u = parse(url);
  if (!u) return '';
  const board = BOARDS.find(b => b.host.test(u.hostname));
  if (!board) return '';
  // Embedded Greenhouse forms name the employer as ?for=<org>.
  const slug = board.where === 'subdomain' ? u.hostname.split('.')[0]
    : (u.searchParams.get('for') || u.pathname.split('/').filter(Boolean)[0] || '');
  if (!slug || /^(embed|jobs?|p|j)$/i.test(slug)) return '';
  return titleCase(decodeURIComponent(slug));
}

/**
 * Whether an address points at one posting, so two saves of it are the same
 * job. A shared page such as an employer's own /apply/upload-documents is
 * used for every role there, so it says nothing about which job it was.
 */
export function isSpecificPosting(url: string | null | undefined): boolean {
  const u = parse(url);
  if (!u) return false;
  const board = BOARDS.find(b => b.host.test(u.hostname));
  const parts = u.pathname.split('/').filter(Boolean);
  if (board && parts.length >= board.keep && !/^embed$/i.test(parts[0])) return true;
  // Otherwise only when the address carries an id: a long number or a UUID.
  return /\d{5,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(u.pathname + u.search);
}

/**
 * A role and employer from a page title in the form job boards use,
 * "Job Application for <role> at <company>", or null.
 */
export function parseApplicationTitle(title: string): { role: string; company: string } | null {
  const m = title.trim().match(/^job application for (.+?) at (.+)$/i);
  return m ? { role: m[1].trim(), company: m[2].trim() } : null;
}

/** A title without a trailing "@ Company" or "at Company" for the employer already known. */
export function stripCompanySuffix(title: string, company: string): string {
  if (!company) return title;
  const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return title.replace(new RegExp(`\\s*(@|\\bat)\\s*${esc}\\s*$`, 'i'), '').trim() || title;
}

/** Words that name a job board or its host rather than an employer. */
const BOARD_WORDS = /^(job[\s-]?boards?|jobs?|boards?|apply|careers?|greenhouse|ashby|ashbyhq|lever|breezy|workable|smartrecruiters|workday|myworkdayjobs|icims|linkedin|indeed|other)$/i;

/** Whether a company name is really the job board's name, read from its host. */
export function isBoardName(company: string): boolean {
  return !company.trim() || BOARD_WORDS.test(company.trim());
}

/** Whether a title is a thank-you or confirmation page heading, not a job title. */
export function isConfirmationTitle(title: string): boolean {
  return /thank(s| you)|application (was )?(submitted|received|sent|complete)|you('ve| have) (successfully )?applied|successfully (applied|submitted)|uploaded successfully|^confirmation$|^application$|^submitted$/i.test(title.trim());
}

/** A job title read from a posting address slug (Breezy, Lever), or ''. */
export function titleFromPostingUrl(url: string | null | undefined): string {
  const u = parse(url);
  if (!u || !/\.breezy\.hr$/i.test(u.hostname)) return '';
  // /p/<12 hex id>-<title-slug>
  const slug = u.pathname.split('/').filter(Boolean)[1] ?? '';
  const words = slug.replace(/^[0-9a-f]{8,}-/i, '').replace(/(-\d+)+$/, '');
  return words ? words.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : '';
}
