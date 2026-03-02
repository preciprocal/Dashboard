// app/api/job-tracker/find-contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, db } from '@/firebase/admin';

const apiKey       = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const hunterApiKey = process.env.HUNTER_API_KEY;
const genAI        = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Tell Vercel to allow up to 30s for this route (email generation takes time)
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
  tier?:      number; // 1=recruiter/C-suite, 2=VP/Director, 3=Manager/Lead, 4=IC
}

interface SenderContext {
  // Identity
  name:             string;
  email:            string;
  phone:            string;
  location:         string;
  // Socials
  linkedin:         string;
  github:           string;
  website:          string;
  // Professional
  targetRole:       string;
  experienceLevel:  string;
  bio:              string;
  careerGoals:      string;
  skills:           string[];
  // Resume content
  resumeText:       string;
  // Derived highlights (extracted from resume)
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
  try {
    const snap = await db.collection('resumes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!snap.empty) {
      const r    = snap.docs[0].data() as Record<string, unknown>;
      const text = (r.resumeText as string) || (r.extractedText as string) || '';
      ctx.resumeText = text.slice(0, 3000);

      if (text) {
        // Extract bullet-point achievements (lines with metrics)
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
          textLen:       text.length,
          achievements:  ctx.topAchievements.length,
          courses:       ctx.courses.length,
          education:     ctx.education,
        });
      } else {
        log('⚠️', 'Resume exists but no text content found');
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
// Tier 1 = highest priority (recruiters, C-suite, founders)
// Tier 2 = strong (VPs, directors, heads)
// Tier 3 = good (managers, leads, principals)
// Tier 4 = relevant (engineers, other)

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
  return 5; // unknown
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
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=20&api_key=${hunterApiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    const errors  = (errBody as Record<string, unknown[]>)?.errors;
    const detail  = Array.isArray(errors) && errors.length > 0
      ? (errors[0] as Record<string, string>)?.details || ''
      : '';
    log('❌', 'Domain search failed', { status: res.status, detail, domain });

    if (res.status === 400) {
      throw new Error(
        `No contacts found for "${domain}". Try entering the company's actual website domain — ` +
        `e.g. if the company is "Match Group" try "match.com" or "gotinder.com".`
      );
    }
    if (res.status === 401) throw new Error('Invalid API key — please check your HUNTER_API_KEY.');
    if (res.status === 429) throw new Error('Search limit reached for this month. Upgrade your plan to search more companies.');
    throw new Error(`Search failed (${res.status}). Try a different domain.`);
  }

  const data = await res.json() as {
    data: { emails: HunterEmail[]; domain: string; organization: string };
    meta: { results: number };
  };

  log('✅', 'Domain search succeeded', { total: data.meta?.results, returned: data.data?.emails?.length });

  const emails = data.data?.emails || [];
  if (emails.length === 0) return [];

  // Score each contact — tier (lower = better) + confidence bonus
  const scored = emails.map(e => ({
    ...e,
    _tier:  getRoleTier(e.position || '', e.department || ''),
    _score: (e.confidence || 0),
  }));

  // Sort: tier first (ascending = best first), then confidence (descending)
  scored.sort((a, b) => a._tier !== b._tier ? a._tier - b._tier : b._score - a._score);

  // Pick best 6 but ensure role diversity:
  // - At least 1 recruiter/HR/talent (tier 1 recruiting)
  // - At least 1 C-suite/founder (tier 1 leadership)
  // - At least 1 VP/Director (tier 2)
  // - Fill remaining with next best

  const RECRUITING_KW = ['recruiter','talent','hr','hiring','people ops'];
  const LEADERSHIP_KW = ['ceo','cto','cpo','coo','founder','president','chief'];
  const LEADS_KW      = ['team lead','tech lead','lead data','lead ml','lead software','lead engineer','lead analyst','lead product','data science lead','ml lead','ai lead'];

  const recruiters  = scored.filter(e => RECRUITING_KW.some(kw => `${e.position} ${e.department}`.toLowerCase().includes(kw)));
  const leadership  = scored.filter(e => LEADERSHIP_KW.some(kw => `${e.position} ${e.department}`.toLowerCase().includes(kw)));
  const directors   = scored.filter(e => e._tier === 2);
  const leads       = scored.filter(e => LEADS_KW.some(kw => `${e.position} ${e.department}`.toLowerCase().includes(kw)));

  const picked: HunterEmail[] = [];
  const seen = new Set<string>();
  const add = (list: HunterEmail[], max: number) => {
    let added = 0;
    for (const e of list) {
      if (picked.length >= 6 || added >= max) break;
      if (!seen.has(e.value)) { seen.add(e.value); picked.push(e); added++; }
    }
  };

  // Priority: recruiter → C-suite/founder → VPs/Directors → Team leads → best remaining
  add(recruiters.slice(0, 2), 2);
  add(leadership.slice(0, 2), 2);
  add(directors.slice(0, 1),  1);
  add(leads.slice(0, 1),      1);
  // Fill remaining slots with highest-tier contacts not yet picked
  for (const e of scored) {
    if (picked.length >= 6) break;
    if (!seen.has(e.value)) { seen.add(e.value); picked.push(e); }
  }

  log('📊', 'Contact selection', {
    recruiters: recruiters.length,
    leadership: leadership.length,
    directors:  directors.length,
    leads:      leads.length,
    picked:     picked.length,
  });

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

// ─── Gemini personalised email ────────────────────────────────────

async function generatePersonalisedEmail(
  contact:        HunterContact,
  jobTitle:       string,
  company:        string,
  jobDescription: string,
  ctx:            SenderContext,
): Promise<string> {
  if (!genAI) throw new Error('Gemini not configured');

  // Angle tailored to recipient role
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

  // Build socials block
  const socials = [
    ctx.linkedin && `LinkedIn: ${ctx.linkedin}`,
    ctx.github   && `GitHub: ${ctx.github}`,
    ctx.website  && `Portfolio: ${ctx.website}`,
  ].filter(Boolean).join('\n');

  // Build achievements block
  const achievementsBlock = ctx.topAchievements.length > 0
    ? `Key achievements from resume:\n${ctx.topAchievements.map(a => `• ${a}`).join('\n')}`
    : '';

  // Build courses block
  const coursesBlock = ctx.courses.length > 0
    ? `Courses/certifications: ${ctx.courses.join(', ')}`
    : '';

  const prompt = `You are a world-class cold email writer helping a job seeker stand out. Write a highly personalised, authentic cold email.

═══ RECIPIENT ═══
Name: ${contact.firstName || contact.fullName}
Title: ${contact.position}
Company: ${company}
How to approach them: ${recipientAngle}

═══ SENDER ═══
Name: ${ctx.name || 'the candidate'}
Email: ${ctx.email}
${ctx.phone    ? `Phone: ${ctx.phone}` : ''}
${ctx.location ? `Location: ${ctx.location}` : ''}
${socials      ? `\nSocials:\n${socials}` : ''}

Applying for: ${jobTitle} at ${company}
Experience level: ${ctx.experienceLevel}
${ctx.bio ? `Bio: ${ctx.bio}` : ''}
${ctx.careerGoals ? `Career goals: ${ctx.careerGoals}` : ''}
Top skills: ${ctx.skills.slice(0, 8).join(', ') || 'not specified'}

${achievementsBlock}
${ctx.education ? `Education: ${ctx.education}` : ''}
${ctx.recentRole ? `Most recent role: ${ctx.recentRole}` : ''}
${coursesBlock}

${jobDescription ? `═══ JOB CONTEXT ═══\n${jobDescription.slice(0, 600)}` : ''}

${ctx.resumeText ? `═══ RESUME HIGHLIGHTS ═══\n${ctx.resumeText.slice(0, 800)}` : ''}

═══ EMAIL REQUIREMENTS ═══
1. 120-180 words — tight, not bloated
2. NEVER start with: "I hope this finds you well", "My name is", "I am writing to"
3. Open with something specific about THEM, their company, or their work — not yourself
4. Weave in 1-2 specific achievements or skills from the resume naturally — don't list everything
5. If the sender has GitHub/LinkedIn/portfolio, include ONE relevant link naturally in the body
6. End with ONE small, clear ask (15-min call, quick reply, coffee chat)
7. Sign off with: name, email, and any relevant social link
8. Sound like a real smart human wrote this — warm, direct, confident, not desperate
9. NO generic phrases like "I am a passionate professional" or "I would be a great fit"
10. Reference the job title and company name naturally

Return ONLY the complete email including greeting, body, and signature. No subject line. No commentary.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.65, maxOutputTokens: 500 },
  });

  const result = await model.generateContent(prompt);
  const text   = result.response.text().trim();
  if (!text || text.length < 50) throw new Error('AI returned empty response');
  return text;
}

// ─── Gemini domain guesser ───────────────────────────────────────

async function guessDomain(company: string, jobTitle: string): Promise<string> {
  if (!genAI) return company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0, maxOutputTokens: 30 },
    });

    const result = await model.generateContent(
      `What is the official website domain (e.g. stripe.com, gotinder.com) for the company "${company}"?` +
      (jobTitle ? ` The job title is "${jobTitle}".` : '') +
      ` Reply with ONLY the domain name, nothing else. No https://, no www., no explanation.`
    );

    const raw = result.response.text().trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split(' ')[0]
      .trim();

    // Must look like a domain
    if (raw && /^[a-z0-9][a-z0-9\-\.]{1,60}\.[a-z]{2,10}$/.test(raw)) {
      log('✅', 'Domain guessed by AI', { company, domain: raw });
      return raw;
    }

    log('⚠️', 'AI returned invalid domain, using fallback', { raw });
  } catch (e) {
    log('⚠️', 'Domain guess failed, using fallback', { error: e instanceof Error ? e.message : String(e) });
  }

  // Fallback: simple normalisation
  return company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
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

  const { company, jobTitle, jobDescription, domain: domainOverride } = body;

  if (!company) return NextResponse.json({ error: 'company is required' }, { status: 400 });
  if (!hunterApiKey) return NextResponse.json({ error: 'HUNTER_API_KEY not configured' }, { status: 503 });
  if (!genAI)        return NextResponse.json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY not configured' }, { status: 503 });

  log('📊', 'Request', { company, jobTitle, domainOverride });

  // ── Build full sender context ─────────────────────────────────
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

  // ── Determine domain ──────────────────────────────────────────
  const domain = domainOverride
    ? domainOverride
    : await guessDomain(company, jobTitle || '');
  log('📊', 'Using domain', { domain, wasOverridden: !!domainOverride });

  // ── Fetch contacts ────────────────────────────────────────────
  let contacts: HunterContact[];
  try {
    contacts = await fetchHunterContacts(domain);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch contacts';
    log('❌', 'Hunter.io failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (contacts.length === 0) {
    log('⚠️', 'No contacts found', { domain });
    return NextResponse.json({ contacts: [], message: `No contacts found for ${domain}. Try entering the domain manually (e.g. stripe.com).` });
  }

  log('✅', 'Contacts fetched', { count: contacts.length });

  // ── Generate emails in parallel ────────────────────────────
  log('🔍', 'Generating personalised emails in parallel', { count: contacts.length });
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

  // Cache (non-fatal)
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