// lib/jobs/posting-facts.ts
//
// Facts a posting states about itself: pay range, job type and where the
// work happens, plus its text split into sections for reading. Each fact is
// read from the posting's own words and left out when the posting does not
// say; nothing is estimated here.

export interface PayRange {
  min: number;
  max: number | null;
  unit: 'year' | 'hour';
  /** The words the range was read from. */
  quote: string;
}

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Temporary';
export type Workplace = 'Remote' | 'Hybrid' | 'On-site';

export interface PostingFacts {
  pay: PayRange | null;
  type: JobType | null;
  workplace: Workplace | null;
}

const num = (s: string, k?: string) => {
  const n = Number(s.replace(/,/g, ''));
  return /k/i.test(k ?? '') ? n * 1000 : n;
};

/** "$69,000 - $114,000", "$69K–$114K per year", "$32.50/hr", "USD 120,000 to 150,000". */
export function readPay(text: string): PayRange | null {
  const t = text.replace(/ /g, ' ');
  const money = String.raw`(?:\$|USD\s?)\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s?([kK])?`;
  const range = new RegExp(`${money}\\s*(?:-|–|—|to)\\s*(?:\\$|USD\\s?)?\\s?(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d{1,2})?)\\s?([kK])?([^\\n.;]{0,40})`, 'i');
  const m = t.match(range);
  if (m) {
    const lo = num(m[1], m[2] || m[4]), hi = num(m[3], m[4] || m[2]);
    const unit = /hour|hr\b|hourly/i.test(m[5]) || hi < 500 ? 'hour' : 'year';
    if (lo > 0 && hi >= lo && (unit === 'hour' ? hi < 500 : lo >= 10000 && hi < 2_000_000)) {
      return { min: lo, max: hi, unit, quote: m[0].trim().slice(0, 80) };
    }
  }
  const single = new RegExp(`${money}\\s*(?:\\/|per\\s)\\s*(hour|hr|year|yr|annum)`, 'i');
  const s = t.match(single);
  if (s) {
    const v = num(s[1], s[2]);
    const unit = /h/i.test(s[3]) ? 'hour' : 'year';
    if (v > 0 && (unit === 'hour' ? v < 500 : v >= 10000)) return { min: v, max: null, unit, quote: s[0].trim() };
  }
  return null;
}

export function readType(title: string, text: string): JobType | null {
  if (/\b(intern|internship|co-?op)\b/i.test(title)) return 'Internship';
  if (/\bcontract(or)?\b/i.test(title)) return 'Contract';
  const head = text.slice(0, 6000);
  if (/\bpart[- ]time\b/i.test(head) && !/\bfull[- ]time\b/i.test(head)) return 'Part-time';
  if (/\bfull[- ]time\b/i.test(head)) return 'Full-time';
  if (/\b(temporary|fixed[- ]term)\b/i.test(head)) return 'Temporary';
  if (/\b(contract role|contract position|w2 contract|1099)\b/i.test(head)) return 'Contract';
  return null;
}

export function readWorkplace(location: string, text: string): Workplace | null {
  const head = text.slice(0, 8000);
  if (/\bhybrid\b/i.test(location) || /\bhybrid (role|position|work|schedule|model)\b|\bthis (role|position) is hybrid\b|\bdays? (a|per) week in (the )?office\b/i.test(head)) return 'Hybrid';
  if (/\bremote\b/i.test(location) || /\b(fully|100%) remote\b|\bthis (role|position) is remote\b|\bremote[- ]first\b/i.test(head)) return 'Remote';
  if (/\b(on-?site|in-office|in office|in-person)\b/i.test(location) || /\b(this (role|position) is (on-?site|in-office|in-person)|fully on-?site|on-?site (role|position)|5 days (a|per) week in (the )?office)\b/i.test(head)) return 'On-site';
  return null;
}

export function postingFacts(title: string, location: string, text: string): PostingFacts {
  return { pay: readPay(text), type: readType(title, text), workplace: readWorkplace(location, text) };
}

// ─── Sections ────────────────────────────────────────────────────────────────

export interface PostingSection {
  heading: string | null;
  items: { bullet: boolean; text: string }[];
}

const HEADING_WORDS = /^(about( (the|this) (role|team|job|position|company|us))?|about us|who we are|the role|the team|overview|summary|job summary|position summary|role overview|what you('|’)ll do|what you will do|what you('|’)ll be doing|your role|responsibilities|key responsibilities|duties|in this role|day to day|what we('|’)re looking for|who you are|qualifications|basic qualifications|minimum qualifications|required qualifications|preferred qualifications|requirements|required|preferred|nice to have|bonus points|you might be a fit|skills|what you bring|what you('|’)ll bring|benefits|perks|what we offer|compensation|pay|salary|pay range|location|why join us|equal opportunity|eeo)\b/i;

/** Splits the posting's plain text into headed sections of paragraphs and bullets. */
export function postingSections(text: string): PostingSection[] {
  const out: PostingSection[] = [];
  let cur: PostingSection = { heading: null, items: [] };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[•\-*·▪●◦]\s*/.test(line);
    const body = line.replace(/^[•\-*·▪●◦]\s*/, '').trim();
    if (!body) continue;
    const short = body.length <= 70 && !/[.!?]$/.test(body.replace(/:$/, ''));
    const isHeading = !bullet && short && (body.endsWith(':') || HEADING_WORDS.test(body)) && body.split(/\s+/).length <= 9;
    if (isHeading) {
      if (cur.heading || cur.items.length) out.push(cur);
      cur = { heading: body.replace(/:$/, ''), items: [] };
    } else {
      cur.items.push({ bullet, text: body });
    }
  }
  if (cur.heading || cur.items.length) out.push(cur);
  return out.filter(s => s.items.length > 0);
}
