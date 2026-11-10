// lib/inbound/classify.ts
// What a forwarded recruiter email means for the tracker.
//
// Three parts, so the rules can be tested without a model or a database:
//   detectForwardingConfirmation  Gmail and Outlook send a confirmation
//                                 email before forwarding starts. Found by
//                                 rule, never by the model, and surfaced to
//                                 the user, who cannot finish setup without it.
//   parseClassification           Validates the model's JSON, and lowers its
//                                 confidence when the quoted evidence is not
//                                 actually in the email.
//   decide                        Which status change, if any, to make.
//                                 Never moves a card backwards; anything
//                                 uncertain waits for the user.

export type InboundKind =
  | 'rejection' | 'interview_invite' | 'offer'
  | 'application_received' | 'forwarding_confirmation' | 'other';

export type InboundOutcome = 'applied' | 'needs_review' | 'unmatched' | 'ignored';

export interface Classification {
  kind: InboundKind;
  confidence: number;
  company: string | null;
  jobTitle: string | null;
  stage: 'phone-screen' | 'technical' | 'final' | null;
  evidence: string | null;
}

// ─── Forwarding confirmations ────────────────────────────────────────────────

export function detectForwardingConfirmation(
  from: string, subject: string, text: string,
): { provider: 'gmail' | 'outlook'; code: string | null; link: string | null } | null {
  const f = from.toLowerCase();
  const s = subject.toLowerCase();
  const isGmail = f.includes('forwarding-noreply@google.com') || /gmail forwarding confirmation/.test(s);
  const isOutlook = /outlook|microsoft/.test(f) && /forward/.test(s) && /(verify|confirm)/.test(s);
  if (!isGmail && !isOutlook) return null;
  const code = text.match(/confirmation code:\s*(\d{6,12})/i)?.[1] ?? subject.match(/#(\d{6,12})/)?.[1] ?? null;
  const link = text.match(/https:\/\/(?:mail-settings\.google\.com|mail\.google\.com|[a-z0-9.-]*(?:outlook|live|microsoft)\.com)\/[^\s<>"')]+/i)?.[0] ?? null;
  return { provider: isGmail ? 'gmail' : 'outlook', code, link };
}

// ─── The model's answer ──────────────────────────────────────────────────────

export const CLASSIFY_SYSTEM = `You read one email from a job seeker's inbox and say what it means for their job application. Return only a JSON object, no prose:

{"kind": "...", "confidence": 0.0, "company": "...", "jobTitle": "...", "stage": "...", "evidence": "..."}

kind, exactly one of:
- "rejection": the employer is not moving forward with this candidate.
- "interview_invite": the employer invites the candidate to an interview, phone screen, call or assessment, or asks to schedule one.
- "offer": the employer offers the candidate the job.
- "application_received": an automatic confirmation that an application was received, with no decision.
- "other": anything else, including newsletters, job alerts, marketing and recruiters cold-pitching a different role.

Rules:
- If the email is forwarded, judge the forwarded message, not the forwarding note.
- company: the hiring employer as written in the email. Never the applicant tracking system (Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters) or a job board. null if unclear.
- jobTitle: the role as written, or null.
- stage, only for interview_invite: "phone-screen" for a first call, recruiter screen or initial chat; "technical" for a technical, coding or skills interview or assessment; "final" for a final round or onsite. null otherwise.
- evidence: one sentence copied word for word from the email that shows the kind. Never paraphrase.
- confidence: how sure you are of kind, from 0 to 1. Below 0.8 if the email is ambiguous.
- Never guess. Unclear means null and lower confidence.`;

const KINDS: InboundKind[] = ['rejection', 'interview_invite', 'offer', 'application_received', 'other'];
const STAGES = ['phone-screen', 'technical', 'final'] as const;
const ATS = /^(greenhouse|lever|workday|ashby|icims|smartrecruiters|jobvite|taleo|linkedin|indeed|glassdoor)$/i;

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The model's JSON, checked. Its evidence must appear in the email; when it
 * does not, the label may be invented, so confidence drops below the bar for
 * acting on it alone.
 */
export function parseClassification(json: unknown, emailText: string): Classification {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const kind = KINDS.includes(o.kind as InboundKind) ? (o.kind as InboundKind) : 'other';
  let confidence = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  let company = str(o.company, 120);
  if (company && ATS.test(company)) company = null;
  const evidence = str(o.evidence, 300);
  if (!evidence || !squash(emailText).includes(squash(evidence).slice(0, 120))) confidence = Math.min(confidence, 0.5);
  const stage = kind === 'interview_invite' && STAGES.includes(o.stage as typeof STAGES[number])
    ? (o.stage as Classification['stage'])
    : null;
  return { kind, confidence, company, jobTitle: str(o.jobTitle, 150), stage, evidence };
}

// ─── What to do ──────────────────────────────────────────────────────────────

/** Acting without asking needs at least this much confidence. */
export const AUTO_APPLY_CONFIDENCE = 0.8;

const RANK: Record<string, number> = {
  wishlist: 0, applied: 1, ghosted: 1, 'phone-screen': 2, technical: 3, final: 4, offer: 5,
  rejected: 6, withdrew: 6,
};

export function statusFor(c: Classification): string | null {
  if (c.kind === 'rejection') return 'rejected';
  if (c.kind === 'offer') return 'offer';
  if (c.kind === 'interview_invite') return c.stage ?? 'phone-screen';
  return null;
}

export function decide(
  c: Classification,
  currentStatus: string | null,
): { outcome: InboundOutcome; newStatus: string | null } {
  const target = statusFor(c);
  if (!target) return { outcome: 'ignored', newStatus: null };
  if (currentStatus === null) return { outcome: 'unmatched', newStatus: target };
  if (currentStatus === target) return { outcome: 'ignored', newStatus: null };

  const cur = RANK[currentStatus] ?? 1;
  const next = RANK[target];
  // A finished application does not reopen on its own: an interview invite
  // after a rejection or withdrawal, or a rejection after an offer, is real
  // but unusual, so the user decides.
  if (cur >= 6) return { outcome: 'needs_review', newStatus: target };
  if (currentStatus === 'offer' && target === 'rejected') return { outcome: 'needs_review', newStatus: target };
  // Never backwards: a phone-screen invite for a card already at the final
  // round is old news, not a demotion.
  if (target !== 'rejected' && next <= cur) return { outcome: 'ignored', newStatus: null };
  if (c.confidence < AUTO_APPLY_CONFIDENCE) return { outcome: 'needs_review', newStatus: target };
  return { outcome: 'applied', newStatus: target };
}

/** Plain text for the model: prefer the text part, else strip the HTML. */
export function emailToText(text: string | null, html: string | null): string {
  if (text && text.trim()) return text.slice(0, 12_000);
  return (html ?? '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, 12_000);
}
