// lib/config/student-domains.ts
// Which email domains qualify for the .edu student perk.
//
// The perk is for CURRENTLY ENROLLED students. A bare "ends with .edu" test
// (what app/api/student/* did before) also hands a free Pro month to alumni,
// staff, faculty and departmental role accounts - alumni addresses in
// particular are issued for life and often self-serve, which made them the
// cheapest way to farm the perk.
//
// Deliberately a static config rather than a DB table: it is edited by us, it
// is read on every verification attempt, and keeping it in the repo means a
// change is code-reviewed and deployed rather than silently mutated.

// ─── Qualifying suffixes ─────────────────────────────────────────────────────
// KNOWN GAP: .edu is US-centric, so no non-US student can currently claim the
// perk at all - a UK (.ac.uk), Australian (.edu.au) or Indian (.edu.in)
// student is rejected outright. That is the pre-existing behaviour, preserved
// here rather than widened silently, because opening it up multiplies the
// abuse surface and should be a deliberate decision. When we do open it, it
// is an edit to this array and nothing else.
export const QUALIFYING_SUFFIXES = ['.edu'] as const;

// ─── Denied subdomain prefixes ───────────────────────────────────────────────
// Matched against the labels to the LEFT of the registrable domain, so
// `alumni.mit.edu` is denied while `mit.edu` is not. Prefix-matched (not exact)
// so `alumni-mail.berkeley.edu` and `alumni2.foo.edu` are caught too.
export const DENIED_SUBDOMAIN_PREFIXES = [
  // Former students - issued for life, frequently self-serve
  'alumni', 'alum', 'former', 'grad-alumni', 'emeritus', 'retired',
  // Employees rather than students
  'staff', 'faculty', 'employee', 'employees', 'hr', 'admin', 'apps',
  // Role / shared / infrastructure accounts
  'mail', 'noreply', 'no-reply', 'postmaster', 'webmaster', 'listserv',
  'guest', 'temp', 'test',
] as const;

// ─── Denied local parts ──────────────────────────────────────────────────────
// Role accounts on an otherwise-qualifying domain (info@some.edu). These are
// shared inboxes, so whoever claims first spends the whole institution's
// address for everyone behind it.
export const DENIED_LOCAL_PARTS = [
  'admin', 'administrator', 'info', 'contact', 'support', 'help', 'helpdesk',
  'noreply', 'no-reply', 'postmaster', 'webmaster', 'abuse', 'security',
  'registrar', 'hr', 'careers', 'jobs', 'test',
] as const;

// ─── Denied full domains ─────────────────────────────────────────────────────
// Domains that end in .edu but do not represent enrolment we want to honour:
// disposable/forwarding services, and .edu addresses that are handed out
// without enrolment. Add to this as abuse shows up in the logs.
export const DENIED_DOMAINS: string[] = [
  // e.g. 'mailinator.edu',
];

// ─── Optional allowlist ──────────────────────────────────────────────────────
// Empty = "any domain passing the rules above qualifies". Populate ONLY if
// abuse forces us to a known-good list; it turns the perk into opt-in per
// institution and will reject legitimate students at unlisted schools.
export const ALLOWED_DOMAINS: string[] = [];

export type EduRejectionReason =
  | 'not_qualifying_suffix'
  | 'denied_subdomain'
  | 'denied_local_part'
  | 'denied_domain'
  | 'not_allowlisted'
  | 'malformed';

export interface EduEvaluation {
  ok: boolean;
  domain: string;
  reason?: EduRejectionReason;
  /** User-facing copy. Intentionally vague about WHICH rule matched, so the
   *  denylist cannot be enumerated by probing addresses. */
  message?: string;
}

const GENERIC_REJECTION =
  "That address doesn't look like a current student address. " +
  'Use the email your university issues to enrolled students - alumni, staff ' +
  'and departmental addresses do not qualify. Contact support if this is wrong.';

/**
 * Single gate for "does this address earn the student perk". Called by both
 * send-verification (to fail fast before emailing a code) and verify-code (so
 * the rules cannot be bypassed by replaying a code issued under older config).
 */
export function evaluateEduEmail(rawEmail: string): EduEvaluation {
  const email = rawEmail.trim().toLowerCase();

  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return { ok: false, domain: '', reason: 'malformed', message: 'Enter a valid email address.' };
  }

  const localPart = email.slice(0, atIndex);
  const domain    = email.slice(atIndex + 1);

  if (!QUALIFYING_SUFFIXES.some(suffix => domain.endsWith(suffix))) {
    return {
      ok: false, domain, reason: 'not_qualifying_suffix',
      message: 'Enter a university email address ending in .edu.',
    };
  }

  if (DENIED_DOMAINS.includes(domain)) {
    return { ok: false, domain, reason: 'denied_domain', message: GENERIC_REJECTION };
  }

  // Strip the '+tag' suffix before checking: careers+student@x.edu is still
  // the careers role account.
  const baseLocal = localPart.split('+')[0];
  if (DENIED_LOCAL_PARTS.includes(baseLocal as (typeof DENIED_LOCAL_PARTS)[number])) {
    return { ok: false, domain, reason: 'denied_local_part', message: GENERIC_REJECTION };
  }

  // Everything left of the registrable domain. For `alumni.mit.edu` the
  // registrable domain is `mit.edu`, leaving ['alumni']. Safe to treat the
  // last two labels as registrable here because the suffix check above has
  // already constrained us to single-label TLDs (.edu); this assumption needs
  // revisiting alongside any multi-part suffix like .edu.au or .ac.uk added
  // to QUALIFYING_SUFFIXES.
  const labels     = domain.split('.');
  const subdomains = labels.slice(0, Math.max(0, labels.length - 2));

  const hasDeniedSubdomain = subdomains.some(label =>
    DENIED_SUBDOMAIN_PREFIXES.some(prefix => label.startsWith(prefix)),
  );
  if (hasDeniedSubdomain) {
    return { ok: false, domain, reason: 'denied_subdomain', message: GENERIC_REJECTION };
  }

  if (ALLOWED_DOMAINS.length > 0 && !ALLOWED_DOMAINS.includes(domain)) {
    return { ok: false, domain, reason: 'not_allowlisted', message: GENERIC_REJECTION };
  }

  return { ok: true, domain };
}
