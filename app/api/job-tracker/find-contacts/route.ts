// app/api/job-tracker/find-contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth, db } from '@/firebase/admin';

const apiKey       = process.env.CLAUDE_API_KEY;
const hunterApiKey = process.env.HUNTER_API_KEY;
const anthropic    = apiKey ? new Anthropic({ apiKey }) : null;

export const maxDuration = 30;

const TAG = '[FIND-CONTACTS]';
function log(level: '✅'|'⚠️'|'❌'|'📊'|'🔍', step: string, detail?: unknown) {
  const ts = new Date().toISOString();
  if (detail !== undefined) console.log(`${TAG} ${level} [${ts}] ${step}`, detail);
  else console.log(`${TAG} ${level} [${ts}] ${step}`);
}

// ─── Types ────────────────────────────────────────────────────────

interface HunterContact {
  email:      string;
  firstName:  string;
  lastName:   string;
  fullName:   string;
  position:   string;
  department: string;
  confidence: number;
  linkedin:   string | null;
  tier?:      number;
}

interface SenderContext {
  name:             string;
  email:            string;
  phone:            string;
  location:         string;
  linkedin:         string;
  github:           string;
  website:          string;
  targetRole:       string;
  experienceLevel:  string;
  bio:              string;
  careerGoals:      string;
  skills:           string[];
  resumeText:       string;
  topAchievements:  string[];
  education:        string;
  recentRole:       string;
  courses:          string[];
}

// ─── Auth ─────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session     = cookieStore.get('session');
    if (!session) { log('❌', 'No session cookie'); return null; }
    const claims = await auth.verifySessionCookie(session.value, true);
    return claims.uid;
  } catch (e) {
    log('❌', 'Auth failed', { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// ─── Build rich sender context ────────────────────────────────────

async function buildSenderContext(userId: string): Promise<SenderContext> {
  const ctx: SenderContext = {
    name: '', email: '', phone: '', location: '',
    linkedin: '', github: '', website: '',
    targetRole: '', experienceLevel: 'mid', bio: '', careerGoals: '',
    skills: [], resumeText: '',
    topAchievements: [], education: '', recentRole: '', courses: [],
  };

  // ── User profile ──
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const u = userDoc.data() as Record<string, unknown>;
      ctx.name            = (u.name            as string)   || '';
      ctx.email           = (u.email           as string)   || '';
      ctx.phone           = (u.phone           as string)   || '';
      ctx.location        = (u.location        as string)   || '';
      ctx.linkedin        = (u.linkedIn        as string)   || '';
      ctx.github          = (u.github          as string)   || '';
      ctx.website         = (u.website         as string)   || '';
      ctx.bio             = (u.bio             as string)   || '';
      ctx.targetRole      = (u.targetRole      as string)   || '';
      ctx.experienceLevel = (u.experienceLevel as string)   || 'mid';
      ctx.careerGoals     = (u.careerGoals     as string)   || '';
      ctx.skills          = (u.preferredTech   as string[]) || [];
      log('✅', 'User profile loaded', {
        name: ctx.name, hasLinkedIn: !!ctx.linkedin,
        hasGitHub: !!ctx.github, skillCount: ctx.skills.length,
      });
    }
  } catch (e) {
    log('⚠️', 'User profile fetch failed', { error: e instanceof Error ? e.message : String(e) });
  }

  // ── Latest resume ──
  // FIX: check all possible text locations — feedback.resumeText is the primary store
  try {
    const snap = await db.collection('resumes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!snap.empty) {
      const r = snap.docs[0].data() as Record<string, unknown>;

      // Check all possible locations in priority order
      const feedback = r.feedback as Record<string, unknown> | undefined;
      const text = (
        (feedback?.resumeText as string) ||
        (r.resumeText         as string) ||
        (r.extractedText      as string) ||
        ''
      );

      if (text && text.trim().length > 50) {
        ctx.resumeText = text.slice(0, 3000);

        // Extract bullet-point achievements
        const achievementLines = text.match(/[•\-\*]\s*([^•\-\*\n]{30,150})/g) || [];
        ctx.topAchievements = achievementLines
          .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
          .filter(l => /\d|%|improved|built|led|designed|created|reduced|increased|launched/i.test(l))
          .slice(0, 4);

        // Extract education lines
        const eduMatch = text.match(/(?:university|college|bachelor|master|b\.s|m\.s|phd|degree)[^\n]{0,200}/gi);
        ctx.education = (eduMatch || []).slice(0, 2).join(' | ');

        // Extract most recent role
        const roleMatch = text.match(/(?:software|data|product|devops|ml|ai|backend|frontend|full.?stack|engineer|analyst|developer|manager|intern)[^\n]{0,100}/i);
        ctx.recentRole = roleMatch?.[0]?.trim() || '';

        // Extract courses / certifications
        const courseMatch = text.match(/(?:course|certification|certified|coursera|udemy|bootcamp|training)[^\n]{0,100}/gi);
        ctx.courses = (courseMatch || []).slice(0, 3).map(c => c.trim());

        // If skills still empty, try to extract from resume
        if (!ctx.skills.length) {
          const skillMatch = text.match(/(?:python|javascript|typescript|react|node|java|go|rust|c\+\+|sql|aws|gcp|azure|docker|kubernetes|tensorflow|pytorch)[a-z]*/gi);
          ctx.skills = [...new Set(skillMatch || [])].slice(0, 8);
        }

        log('✅', 'Resume parsed', {
          textLen:      text.length,
          source:       feedback?.resumeText ? 'feedback.resumeText' : r.resumeText ? 'resumeText' : 'extractedText',
          achievements: ctx.topAchievements.length,
          courses:      ctx.courses.length,
          education:    ctx.education,
        });
      } else {
        log('⚠️', 'Resume exists but no text content found — checked feedback.resumeText, resumeText, extractedText');
      }
    } else {
      log('⚠️', 'No resume found for user');
    }
  } catch (e) {
    log('⚠️', 'Resume fetch failed', { error: e instanceof Error ? e.message : String(e) });
  }

  return ctx;
}

// ─── Contact role tiers ──────────────────────────────────────────

const ROLE_TIERS: Record<number, string[]> = {
  1: ['recruiter','talent acquisition','talent partner','head of talent','head of recruiting',
      'recruiting manager','recruiting lead','hr manager','people operations','people partner',
      'ceo','chief executive','co-founder','founder','president','owner',
      'cto','chief technology','chief technical',
      'cpo','chief product','chief operating','coo'],
  2: ['vp of engineering','vp engineering','vp of talent','vp of people','vp talent',
      'vice president','director of engineering','director of talent','director of hr',
      'director of recruiting','director of people','head of engineering','head of product',
      'engineering director','product director'],
  3: ['engineering manager','senior engineering manager','senior recruiter','technical recruiter',
      'tech lead','principal engineer','staff engineer','senior manager','manager',
      'lead engineer','lead developer',
      'lead data scientist','lead data engineer','lead ml engineer','lead machine learning',
      'lead software engineer','lead product manager','lead designer','lead analyst',
      'lead backend','lead frontend','lead devops','lead platform','lead infrastructure',
      'data science lead','ml lead','ai lead','analytics lead','research lead',
      'team lead','technical lead','functional lead'],
  4: ['senior engineer','senior developer','software engineer','developer','engineer'],
};

function getRoleTier(position: string, department: string): number {
  const text = `${position} ${department}`.toLowerCase();
  for (const tier of [1, 2, 3, 4] as const) {
    if (ROLE_TIERS[tier].some(kw => text.includes(kw))) return tier;
  }
  return 5;
}

// ─── Hunter.io domain search ──────────────────────────────────────

type HunterEmail = {
  value:      string;
  type:       string;
  confidence: number;
  first_name: string;
  last_name:  string;
  position:   string;
  linkedin:   string;
  department: string;
};

async function fetchHunterContacts(domain: string): Promise<HunterContact[]> {
  if (!hunterApiKey) throw new Error('HUNTER_API_KEY not configured');

  log('🔍', 'Searching domain', { domain });
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=3&api_key=${hunterApiKey}`;
  const res = await fetch(url);

  // FIX: Hunter returns 400 with "limited to 10" when results exist but are capped by plan.
  // Only treat it as an error if there's truly no data. Parse the body first.
  const data = await res.json() as {
    data?: { emails?: HunterEmail[]; domain?: string; organization?: string };
    meta?: { results?: number };
    errors?: { id: string; details: string }[];
  };

  if (!res.ok) {
    const errors = data.errors || [];
    const detail = errors[0]?.details || '';
    const emails = data.data?.emails || [];

    // Plan limit hit — Hunter knows the domain is valid but won't return results
    const isPlanLimit = detail.toLowerCase().includes('limited') || detail.toLowerCase().includes('plan');

    if (emails.length > 0) {
      // Non-200 but emails came back — proceed normally
      log('⚠️', 'Hunter non-200 but emails present — proceeding', { status: res.status, detail, count: emails.length });
    } else if (isPlanLimit) {
      // Domain is real, plan just can't return results for this company
      log('⚠️', 'Hunter plan limit hit — domain valid but results unavailable on free plan', { domain, detail });
      throw new Error(
        `Contacts exist at "${domain}" but your Hunter.io plan limits results for large companies. ` +
        `Upgrade your Hunter plan or try a smaller company's domain.`
      );
    } else {
      log('❌', 'Domain search failed', { status: res.status, detail, domain });
      if (res.status === 401) throw new Error('Invalid API key — please check your HUNTER_API_KEY.');
      if (res.status === 429) throw new Error('Search limit reached for this month. Upgrade your plan to search more companies.');
      throw new Error(
        `No contacts found for "${domain}". Try entering the company's actual website domain — ` +
        `e.g. if the company is "Match Group" try "match.com" or "gotinder.com".`
      );
    }
  }

  const emails = data.data?.emails || [];
  log('✅', 'Domain search succeeded', { total: data.meta?.results, returned: emails.length });

  if (emails.length === 0) return [];

  const scored = emails.map(e => ({
    ...e,
    _tier:  getRoleTier(e.position || '', e.department || ''),
    _score: (e.confidence || 0),
  }));

  scored.sort((a, b) => a._tier !== b._tier ? a._tier - b._tier : b._score - a._score);

  const RECRUITING_KW = ['recruiter','talent','hr','hiring','people ops'];

  const recruiters = scored.filter(e =>
    RECRUITING_KW.some(kw => `${e.position} ${e.department}`.toLowerCase().includes(kw))
  );

  const picked: HunterEmail[] = [];
  const seen = new Set<string>();

  const add = (list: HunterEmail[], max: number) => {
    let added = 0;
    for (const e of list) {
      if (picked.length >= 2 || added >= max) break;
      if (!seen.has(e.value)) { seen.add(e.value); picked.push(e); added++; }
    }
  };

  add(recruiters.slice(0, 2), 2);

  // If no recruiters found, fall back to top-tier contacts
  if (picked.length === 0) {
    add(scored.slice(0, 2), 2);
    log('⚠️', 'No recruiters found — using top-tier contacts as fallback', { picked: picked.length });
  }

  log('📊', 'Contact selection', { recruitersFound: recruiters.length, picked: picked.length });

  return picked.map(e => ({
    email:      e.value,
    firstName:  e.first_name || '',
    lastName:   e.last_name  || '',
    fullName:   `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
    position:   e.position    || 'Professional',
    department: e.department  || '',
    confidence: e.confidence  || 0,
    linkedin:   e.linkedin     || null,
    tier:       getRoleTier(e.position || '', e.department || ''),
  }));
}

// ─── Claude personalised email ────────────────────────────────────

async function generatePersonalisedEmail(
  contact:        HunterContact,
  jobTitle:       string,
  company:        string,
  jobDescription: string,
  ctx:            SenderContext,
): Promise<string> {
  if (!anthropic) throw new Error('Claude not configured');

  const pos = contact.position.toLowerCase();
  let recipientAngle: string;
  if (/recruiter|talent|hr|people|hiring/.test(pos)) {
    recipientAngle = `This person handles recruiting/talent. Write a direct, friendly note about interest in the ${jobTitle} role. Keep it short — they receive hundreds of these. One clear ask: a 15-min call or "can you point me to the right person".`;
  } else if (/cto|vp of eng|director of eng|head of eng/.test(pos)) {
    recipientAngle = `This is a senior technical leader. Show genuine technical depth and excitement about their technical direction. Reference a specific technical challenge in their stack if possible. Ask for a brief conversation about the team's vision.`;
  } else if (/ceo|co-founder|founder|president/.test(pos)) {
    recipientAngle = `This is the CEO/founder. Show you understand the company mission and business problems they're solving. Demonstrate you can make an impact, not just fill a seat. Keep it very short — executives skim.`;
  } else if (/engineer|developer|architect|tech lead|principal/.test(pos)) {
    recipientAngle = `This is a peer engineer. Be technical and collegial. Show respect for their work and genuine curiosity about the engineering challenges. Ask about the team's approach to a relevant technical problem.`;
  } else if (/manager|director|vp/.test(pos)) {
    recipientAngle = `This is a manager/director. Focus on impact and execution — what you've shipped, problems you've solved. Make it easy for them to champion your candidacy internally.`;
  } else {
    recipientAngle = `Write a professional, warm outreach expressing genuine interest in ${company} and asking about ${jobTitle} opportunities.`;
  }

  const socialLinks = [
    ctx.linkedin,
    ctx.github,
    ctx.website,
  ].filter(Boolean);
  const primarySocial = socialLinks[0] || '';

  const achievementsBlock = ctx.topAchievements.length > 0
    ? `Key achievements from resume:\n${ctx.topAchievements.map(a => `• ${a}`).join('\n')}`
    : '';

  const coursesBlock = ctx.courses.length > 0
    ? `Courses/certifications: ${ctx.courses.join(', ')}`
    : '';

  const prompt = `Write a cold outreach email from ${ctx.name || 'the sender'} to ${contact.firstName || contact.fullName}.

RECIPIENT
Name: ${contact.firstName || contact.fullName}
Title: ${contact.position}
Company: ${company}
Angle: ${recipientAngle}

SENDER CONTEXT
${ctx.location ? `Location: ${ctx.location}` : ''}
Role they want: ${jobTitle} at ${company}
Experience level: ${ctx.experienceLevel}
${ctx.bio ? `Bio: ${ctx.bio}` : ''}
${ctx.careerGoals ? `Career goals: ${ctx.careerGoals}` : ''}
Skills: ${ctx.skills.slice(0, 8).join(', ') || 'not specified'}
${achievementsBlock}
${ctx.education ? `Education: ${ctx.education}` : ''}
${ctx.recentRole ? `Most recent role: ${ctx.recentRole}` : ''}
${coursesBlock}
${jobDescription ? `\nJOB CONTEXT\n${jobDescription.slice(0, 500)}` : ''}
${ctx.resumeText ? `\nRESUME HIGHLIGHTS\n${ctx.resumeText.slice(0, 700)}` : ''}

WHAT TO WRITE
3 short paragraphs, 100-150 words total.

Paragraph 1: Something specific and genuine about the company or team's work. Not a compliment — an observation. Like something you'd actually say to someone at a networking event.

Paragraph 2: One or two sentences about relevant work. Just the most relevant fact from the resume. No preamble, no "I'm a X who has spent Y years doing Z." Just state what you did.

Paragraph 3: Ask for 15 minutes. One sentence. Natural, not servile.

Sign-off block (exactly this format, nothing else):
[First name only],
[email]
${primarySocial ? primarySocial : '[one social link if available]'}

BANNED WORDS AND PHRASES — if any appear, rewrite:
- em dash (—) — use a comma or period instead
- "I'm a [title] who" or "I'm a [title] based in"
- "exactly what [excites/interests/gets] me"
- "I came across"
- "I would love to"
- "I am passionate"
- "happy to work around"
- "I wanted to reach out"
- "I hope this"
- "My name is"
- "I am writing"
- "Here's my" or "My LinkedIn" or "My GitHub" — links go bare, no label
- "Best regards" — use "Best," only
- "looking forward"
- "please feel free"
- "don't hesitate"
- "opportunity"
- exclamation marks

TONE RULES
- Short sentences. Fragments are fine.
- No filler words: very, really, truly, honestly, incredibly
- Confident, not eager
- Sounds like a person who has other options

Return only the email. No subject line. No meta-commentary.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  let text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  // Post-process: strip anything that slipped through
  text = text
    .replace(/\s—\s/g, ', ')
    .replace(/—/g, ', ')
    .replace(/\bI'm a (\w+) (who|based)/gi, "I've been working as a $1,")
    .replace(/\bexactly what (excites|interests|gets) me\b/gi, 'interesting work')
    .replace(/\bI came across\b/gi, 'I saw')
    .replace(/\bI would love to\b/gi, "I'd like to")
    .replace(/\bHappy to work around your schedule\b/gi, '')
    .replace(/\bBest regards\b/gi, 'Best')
    .replace(/\blooking forward to hearing from you\b/gi, '')
    .replace(/\bplease (feel free|don't hesitate)\b/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text || text.length < 50) throw new Error('AI returned empty response');
  return text;
}

// ─── Claude multi-domain resolver ────────────────────────────────
// Returns an ordered list of candidate domains to try with Hunter.
// We try them in sequence and stop at the first one that returns contacts.

function sanitizeDomain(raw: string): string | null {
  const d = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split(' ')[0]
    .trim();
  return /^[a-z0-9][a-z0-9\-\.]{1,60}\.[a-z]{2,10}$/.test(d) ? d : null;
}

// Well-known companies whose domain differs from their name
const KNOWN_DOMAINS: Record<string, string[]> = {
  'google':        ['google.com'],
  'alphabet':      ['google.com', 'abc.xyz'],
  'meta':          ['meta.com', 'facebook.com'],
  'facebook':      ['facebook.com', 'meta.com'],
  'amazon':        ['amazon.com'],
  'apple':         ['apple.com'],
  'microsoft':     ['microsoft.com'],
  'netflix':       ['netflix.com'],
  'uber':          ['uber.com'],
  'lyft':          ['lyft.com'],
  'airbnb':        ['airbnb.com'],
  'twitter':       ['twitter.com', 'x.com'],
  'x':             ['x.com', 'twitter.com'],
  'tiktok':        ['tiktok.com', 'bytedance.com'],
  'bytedance':     ['bytedance.com', 'tiktok.com'],
  'chewy':         ['chewy.com'],
  'shopify':       ['shopify.com'],
  'stripe':        ['stripe.com'],
  'square':        ['squareup.com', 'block.xyz'],
  'block':         ['block.xyz', 'squareup.com'],
  'match group':   ['match.com', 'matchgroup.com'],
  'tinder':        ['gotinder.com', 'match.com'],
  'coinbase':      ['coinbase.com'],
  'robinhood':     ['robinhood.com'],
  'doordash':      ['doordash.com'],
  'instacart':     ['instacart.com'],
  'pinterest':     ['pinterest.com'],
  'snap':          ['snap.com', 'snapchat.com'],
  'snapchat':      ['snap.com'],
  'discord':       ['discord.com'],
  'slack':         ['slack.com'],
  'zoom':          ['zoom.us'],
  'salesforce':    ['salesforce.com'],
  'oracle':        ['oracle.com'],
  'ibm':           ['ibm.com'],
  'intel':         ['intel.com'],
  'nvidia':        ['nvidia.com'],
  'amd':           ['amd.com'],
  'qualcomm':      ['qualcomm.com'],
  'palantir':      ['palantir.com'],
  'snowflake':     ['snowflake.com'],
  'databricks':    ['databricks.com'],
  'openai':        ['openai.com'],
  'anthropic':     ['anthropic.com'],
  'hugging face':  ['huggingface.co'],
  'huggingface':   ['huggingface.co'],
  'goldman sachs': ['goldmansachs.com', 'gs.com'],
  'jpmorgan':      ['jpmorgan.com', 'jpmorganchase.com'],
  'morgan stanley':['morganstanley.com'],
  'deloitte':      ['deloitte.com'],
  'mckinsey':      ['mckinsey.com'],
  'bain':          ['bain.com'],
  'bcg':           ['bcg.com'],
  'accenture':     ['accenture.com'],
  'walmart':       ['walmart.com'],
  'target':        ['target.com'],
  'costco':        ['costco.com'],
  'boeing':        ['boeing.com'],
  'lockheed':      ['lockheedmartin.com'],
  'spacex':        ['spacex.com'],
  'tesla':         ['tesla.com'],
  'ford':          ['ford.com'],
  'gm':            ['gm.com'],
  'general motors':['gm.com', 'generalmotors.com'],
  'johnson & johnson': ['jnj.com'],
  'pfizer':        ['pfizer.com'],
  'cvs':           ['cvshealth.com', 'cvs.com'],
  'united health': ['unitedhealthgroup.com'],
};

// ─── Extract domain directly from job posting URL ────────────────
// This is the most reliable source — no guessing needed.
// Strips known ATS subdomains/paths to get the actual company domain.

const ATS_HOSTS = new Set([
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
  'monster.com', 'careerbuilder.com', 'simplyhired.com', 'dice.com',
  'greenhouse.io', 'lever.co', 'ashbyhq.com', 'icims.com',
  'jobvite.com', 'smartrecruiters.com', 'taleo.net', 'bamboohr.com',
  'recruitee.com', 'wellfound.com', 'angel.co', 'myworkdayjobs.com',
  'workday.com', 'breezy.hr', 'jazzhr.com', 'rippling.com',
  'successfactors.com', 'oracle.com', 'kenexa.com',
]);

function extractDomainFromJobUrl(jobUrl: string): string | null {
  if (!jobUrl) return null;
  try {
    const url      = new URL(jobUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    // If it's a known ATS platform, skip — no useful company domain here
    if (ATS_HOSTS.has(hostname) || [...ATS_HOSTS].some(ats => hostname.endsWith('.' + ats))) {
      log('⚠️', 'Job URL is on ATS platform — skipping URL domain extraction', { hostname });
      return null;
    }

    // For company-hosted ATS (e.g. jobs.stripe.com, careers.airbnb.com, stripe.greenhouse.io)
    // Strip known ATS subdomains
    const atsSubdomains = ['jobs', 'careers', 'apply', 'hiring', 'work', 'join', 'boards'];
    const parts         = hostname.split('.');

    if (parts.length >= 3) {
      // e.g. jobs.stripe.com → stripe.com
      if (atsSubdomains.includes(parts[0])) {
        const candidate = parts.slice(1).join('.');
        if (sanitizeDomain(candidate)) {
          log('✅', 'Extracted domain from job URL (stripped ATS subdomain)', { jobUrl, domain: candidate });
          return candidate;
        }
      }
      // e.g. stripe.greenhouse.io → stripe.com (company is the first part)
      const knownAtsTlds = ['greenhouse', 'lever', 'ashbyhq', 'jobvite', 'recruitee', 'bamboohr'];
      if (knownAtsTlds.some(ats => hostname.includes(ats))) {
        const companySlug  = parts[0];
        const candidate    = `${companySlug}.com`;
        if (sanitizeDomain(candidate)) {
          log('✅', 'Extracted company slug from ATS subdomain', { jobUrl, domain: candidate });
          return candidate;
        }
      }
    }

    // Otherwise use the hostname directly (e.g. careers.chewy.com → chewy.com, or chewy.com directly)
    if (parts.length >= 3 && atsSubdomains.includes(parts[0])) {
      return parts.slice(1).join('.');
    }

    log('✅', 'Using job URL hostname as domain', { jobUrl, domain: hostname });
    return hostname;
  } catch {
    return null;
  }
}

async function resolveDomains(company: string, jobTitle: string): Promise<string[]> {
  const companyLower = company.toLowerCase().trim();

  // 1. Check known domains first
  for (const [key, domains] of Object.entries(KNOWN_DOMAINS)) {
    if (companyLower.includes(key) || key.includes(companyLower)) {
      log('✅', 'Known domain matched', { company, domains });
      return domains;
    }
  }

  // 2. Ask Claude for up to 4 candidate domains
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 120,
        messages: [
          {
            role: 'user',
            content: `List up to 4 possible website domains for the company "${company}"${jobTitle ? ` (hiring for "${jobTitle}")` : ''}.

Many companies use a different domain than their name (e.g. "Match Group" → match.com, "Square" → squareup.com, "Twitter" → x.com).

Reply with ONLY a JSON array of domain strings, most likely first. Example: ["chewy.com", "chewyfulfillment.com"]
No explanation, no markdown, just the JSON array.`,
          },
        ],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      // Extract JSON array
      const arrMatch = raw.match(/\[[\s\S]*?\]/);
      if (arrMatch) {
        const parsed = JSON.parse(arrMatch[0]) as unknown[];
        const domains = parsed
          .map(d => sanitizeDomain(String(d)))
          .filter((d): d is string => d !== null);

        if (domains.length > 0) {
          log('✅', 'Claude returned candidate domains', { company, domains });
          return domains;
        }
      }
      log('⚠️', 'Claude domain list parse failed', { raw: raw.slice(0, 100) });
    } catch (e) {
      log('⚠️', 'Claude domain resolution failed', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 3. Deterministic fallbacks based on company name variations
  const slug = companyLower.replace(/[^a-z0-9]/g, '');
  const slugHyphen = companyLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    `${slug}.com`,
    `${slugHyphen}.com`,
    `${slug}.io`,
    `${slug}.co`,
  ];
}

// ─── Try domains until one works ─────────────────────────────────

async function findContactsAcrossDomains(
  company: string,
  jobTitle: string,
  domainOverride?: string,
  jobUrl?: string,
): Promise<{ contacts: HunterContact[]; domain: string }> {
  // 1. User manually entered a domain — use only that
  if (domainOverride) {
    const contacts = await fetchHunterContacts(domainOverride);
    return { contacts, domain: domainOverride };
  }

  // 2. Extract domain directly from the job posting URL — most reliable
  const urlDomain = jobUrl ? extractDomainFromJobUrl(jobUrl) : null;
  if (urlDomain) {
    log('🔍', 'Trying domain extracted from job URL', { urlDomain });
    try {
      const contacts = await fetchHunterContacts(urlDomain);
      if (contacts.length > 0) {
        log('✅', 'Job URL domain worked', { urlDomain, contacts: contacts.length });
        return { contacts, domain: urlDomain };
      }
      log('⚠️', 'Job URL domain returned 0 contacts — falling back to resolution', { urlDomain });
    } catch (e) {
      log('⚠️', 'Job URL domain failed — falling back to resolution', { urlDomain, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 3. Fall back to known-domains + Claude + slug guesses
  const candidates = await resolveDomains(company, jobTitle);
  log('📊', 'Domain candidates to try', { company, candidates });

  let lastError: string = '';

  for (const domain of candidates) {
    try {
      log('🔍', 'Trying domain', { domain });
      const contacts = await fetchHunterContacts(domain);
      if (contacts.length > 0) {
        log('✅', 'Domain worked', { domain, contacts: contacts.length });
        return { contacts, domain };
      }
      log('⚠️', 'Domain returned 0 contacts, trying next', { domain });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // Plan limit errors are definitive — stop trying other domains
      if (lastError.includes('plan limits results') || lastError.includes('Upgrade your Hunter')) {
        log('❌', 'Plan limit hit — stopping domain search', { domain, error: lastError });
        break;
      }
      log('⚠️', 'Domain failed, trying next', { domain, error: lastError });
    }
  }

  // All candidates failed
  throw new Error(
    lastError ||
    `No contacts found for "${company}". Try entering the domain manually (e.g. chewy.com).`
  );
}

// ─── Route handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const start = Date.now();
  log('🔍', 'find-contacts request received');

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, string>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { company, jobTitle, jobDescription, domain: domainOverride, jobUrl } = body;

  if (!company)      return NextResponse.json({ error: 'company is required' }, { status: 400 });
  if (!hunterApiKey) return NextResponse.json({ error: 'HUNTER_API_KEY not configured' }, { status: 503 });
  if (!anthropic)    return NextResponse.json({ error: 'CLAUDE_API_KEY not configured' }, { status: 503 });

  log('📊', 'Request', { company, jobTitle, domainOverride, jobUrl: jobUrl ? jobUrl.slice(0, 80) : null });

  log('🔍', 'Building sender context');
  const senderCtx = await buildSenderContext(userId);
  log('📊', 'Sender context ready', {
    name:         senderCtx.name,
    skills:       senderCtx.skills.length,
    achievements: senderCtx.topAchievements.length,
    hasResume:    senderCtx.resumeText.length > 0,
    hasLinkedIn:  !!senderCtx.linkedin,
    hasGitHub:    !!senderCtx.github,
    courses:      senderCtx.courses.length,
  });

  let contacts: HunterContact[];
  let domain: string;
  try {
    const result = await findContactsAcrossDomains(company, jobTitle || '', domainOverride, jobUrl);
    contacts = result.contacts;
    domain   = result.domain;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch contacts';
    log('❌', 'All domains failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  log('📊', 'Using domain', { domain, wasOverridden: !!domainOverride });

  log('✅', 'Contacts fetched', { count: contacts.length });

  log('🔍', 'Generating personalised emails', { count: contacts.length });
  const results = await Promise.allSettled(
    contacts.map(contact =>
      generatePersonalisedEmail(
        contact, jobTitle || company, company,
        jobDescription || '', senderCtx,
      )
    )
  );

  const contactsWithEmails = contacts.map((contact, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      log('✅', `Email OK: ${contact.fullName}`);
      return { ...contact, generatedEmail: result.value, emailError: undefined };
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log('❌', `Email failed: ${contact.fullName}`, { error: errMsg });
      return { ...contact, generatedEmail: null, emailError: errMsg };
    }
  });

  const succeeded = contactsWithEmails.filter(c => c.generatedEmail).length;
  log('📊', 'Email generation complete', { succeeded, total: contacts.length, ms: Date.now() - start });

  try {
    await db.collection('contactSearches').add({
      userId, company, domain, jobTitle,
      contactCount: contacts.length,
      emailsGenerated: succeeded,
      createdAt: new Date(),
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, domain, contacts: contactsWithEmails });
}