// lib/salary/match-title.ts
// Job title -> BLS occupation (SOC code), deterministically.
//
// Job titles are free text ("Senior Software Engineer II", "Data Analyst,
// Growth", "Sr. PM - Payments") while BLS publishes pay by occupation. Three
// passes, most trusted first:
//   1. A curated phrase map for the roles Preciprocal users apply for. The
//      longest matching phrase wins, so "machine learning engineer" beats
//      "engineer" and "product marketing manager" beats "product manager".
//   2. The BLS occupation titles themselves (every detailed occupation in the
//      release), by word overlap, for titles the map does not cover
//      ("Dental Hygienist", "Economist").
//   3. Nothing: the caller may ask a model to choose among a shortlist, and
//      the user can always pick another occupation.
// Seniority and level words are stripped first: BLS has one occupation for
// junior and staff engineers alike, and the percentiles cover that range.

import { OEWS_OCCUPATIONS } from '@/lib/salary/oews-data';

export type MatchSource = 'curated' | 'bls-title';

export interface TitleMatch {
  code: string;
  source: MatchSource;
  /** The phrase or BLS title that matched, for debugging and tests. */
  matched: string;
  /** Other occupations worth offering in the picker, best first. */
  alternatives: string[];
}

// ─── Normalising ─────────────────────────────────────────────────────────────

const SENIORITY = new Set([
  'senior', 'sr', 'snr', 'junior', 'jr', 'lead', 'leading', 'principal', 'staff', 'distinguished',
  'entry', 'level', 'mid', 'experienced', 'associate', 'assoc', 'intern', 'internship', 'trainee',
  'apprentice', 'graduate', 'grad', 'new', 'early', 'career', 'i', 'ii', 'iii', 'iv', 'v', 'vi',
  'contract', 'contractor', 'temporary', 'temp', 'part', 'full', 'time', 'remote', 'hybrid', 'onsite',
  'founding', 'chief', 'head', 'vp', 'svp', 'evp', 'avp', 'vice', 'president', 'director', 'of',
  'the', 'a', 'an', 'and', 'for', 'to', 'in', 'at', 'with', 'team',
]);
// Kept apart from SENIORITY: these are dropped only for phrase matching on the
// "core" form, while the curated map still sees them in the full form
// (so "vp engineering" and "chief executive" can match).

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bswe\b/g, 'software engineer'],
  [/\bsde\b/g, 'software engineer'],
  [/\bsdet\b/g, 'software development engineer in test'],
  [/\bml\b/g, 'machine learning'],
  [/\bai\b/g, 'artificial intelligence'],
  [/\bpm\b/g, 'product manager'],
  [/\bapm\b/g, 'associate product manager'],
  [/\btpm\b/g, 'technical program manager'],
  [/\bux\b/g, 'user experience'],
  [/\bui\b/g, 'user interface'],
  [/\bqa\b/g, 'quality assurance'],
  [/\bbi\b/g, 'business intelligence'],
  [/\bhr\b/g, 'human resources'],
  [/\bhrbp\b/g, 'human resources business partner'],
  [/\bsre\b/g, 'site reliability engineer'],
  [/\bfp and a\b/g, 'financial planning analysis'],
  [/\bfp a\b/g, 'financial planning analysis'],
  [/\bfpa\b/g, 'financial planning analysis'],
  [/\bib\b/g, 'investment banking'],
  [/\bcpa\b/g, 'accountant'],
  [/\brn\b/g, 'registered nurse'],
  [/\bnp\b/g, 'nurse practitioner'],
  [/\bfnp\b/g, 'nurse practitioner'],
  [/\bpa c\b/g, 'physician assistant'],
  [/\bsdr\b/g, 'sales development representative'],
  [/\bbdr\b/g, 'business development representative'],
  [/\bae\b/g, 'account executive'],
  [/\bcsm\b/g, 'customer success manager'],
  [/\bseo\b/g, 'search engine optimization'],
  [/\bdevops\b/g, 'dev ops'],
  [/\bfront end\b/g, 'frontend'],
  [/\bback end\b/g, 'backend'],
  [/\bfull stack\b/g, 'fullstack'],
  [/\bvice president\b/g, 'vp'],
  [/\bmgr\b/g, 'manager'],
  [/\beng\b/g, 'engineer'],
  [/\bdev\b/g, 'developer'],
  [/\bmktg\b/g, 'marketing'],
  [/\bacct\b/g, 'accountant'],
  [/\bcto\b/g, 'chief technology officer'],
  [/\bcfo\b/g, 'chief financial officer'],
  [/\bcmo\b/g, 'chief marketing officer'],
  [/\bceo\b/g, 'chief executive officer'],
  [/\bcoo\b/g, 'chief operating officer'],
];

/** Lowercase words, abbreviations expanded, punctuation and level numbers gone. */
export function normalizeTitle(raw: string): string {
  let s = ` ${raw.toLowerCase()} `
    .replace(/&/g, ' and ')
    .replace(/\+\+/g, 'pp')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, ' ');
  // "level 3", "l5", "ic4", "e5", "grade 2", trailing numbers
  s = s.replace(/\b(level|grade|band)\s*\d+\b/g, ' ').replace(/\b(l|ic|e|m|p|t)\d{1,2}\b/g, ' ').replace(/\b\d+\b/g, ' ');
  s = ` ${s.replace(/\s+/g, ' ').trim()} `;
  for (const [re, rep] of ABBREVIATIONS) s = s.replace(re, rep);
  return s.replace(/\s+/g, ' ').trim();
}

const singular = (w: string) =>
  w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y`
  : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') ? w.slice(0, -1)
  : w;

// ─── Curated map ─────────────────────────────────────────────────────────────
// [SOC code, phrases...]. Phrases are matched as whole words against the
// normalised title (abbreviations already expanded). Mappings follow O*NET's
// reported job titles for each SOC code where it has one; for roles BLS does
// not name (product manager, ML engineer) the closest occupation by duties is
// used and an alternative is offered in ALTERNATIVES.

const RULES: [string, ...string[]][] = [
  // Software and IT
  ['15-1252', 'software engineer', 'software developer', 'software development engineer', 'backend engineer', 'backend developer',
    'frontend engineer', 'frontend developer', 'fullstack engineer', 'fullstack developer', 'fullstack', 'mobile engineer',
    'mobile developer', 'ios engineer', 'ios developer', 'android engineer', 'android developer', 'application developer',
    'applications developer', 'platform engineer', 'infrastructure engineer', 'site reliability engineer', 'dev ops engineer', 'dev ops',
    'cloud engineer', 'game developer', 'game programmer', 'embedded software', 'firmware engineer', 'machine learning engineer',
    'artificial intelligence engineer', 'deep learning engineer', 'computer vision engineer', 'blockchain developer',
    'java developer', 'python developer', 'javascript developer', 'react developer', 'net developer', 'cpp developer',
    'golang developer', 'ruby developer', 'salesforce developer', 'member of technical staff', 'programmer analyst',
    'developer advocate', 'product engineer', 'software engineering', 'forward deployed engineer', 'staff engineer', 'principal engineer', 'founding engineer', 'senior engineer', 'build engineer', 'release engineer', 'software architect'],
  ['15-1251', 'computer programmer', 'programmer', 'mainframe programmer'],
  ['15-1253', 'quality assurance', 'software development engineer in test', 'test engineer', 'software tester', 'test automation',
    'automation tester', 'qa analyst', 'quality engineer software'],
  ['15-1254', 'web developer', 'wordpress developer', 'webmaster', 'shopify developer', 'web engineer'],
  ['15-1255', 'user experience designer', 'user interface designer', 'product designer', 'interaction designer', 'web designer',
    'user experience', 'user interface', 'digital designer', 'experience designer'],
  ['15-1211', 'systems analyst', 'business systems analyst', 'it analyst', 'information technology analyst', 'erp analyst',
    'salesforce administrator', 'salesforce admin', 'crm analyst', 'workday analyst', 'sap consultant', 'implementation consultant'],
  ['15-1212', 'security engineer', 'security analyst', 'cybersecurity', 'cyber security', 'information security',
    'penetration tester', 'pentester', 'soc analyst', 'application security', 'security architect', 'threat intelligence'],
  ['15-1221', 'research scientist', 'artificial intelligence researcher', 'machine learning researcher', 'machine learning scientist',
    'applied scientist', 'research engineer', 'computer scientist'],
  ['15-1241', 'network architect', 'cloud architect', 'solutions architect', 'network engineer', 'infrastructure architect',
    'enterprise architect'],
  ['15-1242', 'database administrator', 'dba'],
  ['15-1243', 'data engineer', 'database architect', 'data architect', 'database engineer', 'analytics engineer', 'etl developer',
    'big data engineer', 'data warehouse'],
  ['15-1244', 'system administrator', 'systems administrator', 'sysadmin', 'it administrator', 'network administrator',
    'systems engineer', 'linux administrator'],
  ['15-1231', 'network support', 'noc technician', 'noc engineer'],
  ['15-1232', 'it support', 'help desk', 'helpdesk', 'desktop support', 'technical support', 'it specialist', 'it technician',
    'service desk', 'support engineer', 'it support specialist', 'technical support specialist', 'desktop support specialist', 'customer support engineer',
    'technical support engineer'],
  ['15-1299', 'technical program manager', 'it project manager', 'information technology project manager', 'scrum master',
    'agile coach', 'it program manager', 'delivery manager', 'technical project manager'],
  ['11-3021', 'engineering manager', 'software engineering manager', 'it manager', 'it director', 'chief technology officer',
    'chief information officer', 'cto', 'engineering director', 'director engineering', 'vp engineering', 'head engineering',
    'technology manager', 'information technology manager', 'development manager', 'chief information security officer',
    'technical product manager'],
  // Data
  ['15-2051', 'data scientist', 'data analyst', 'data analytics', 'business intelligence analyst', 'business intelligence developer',
    'business intelligence', 'analytics manager', 'decision scientist', 'product analyst', 'insights analyst', 'reporting analyst',
    'analytics analyst', 'quantitative researcher', 'data science', 'marketing data analyst', 'growth analyst', 'people analytics'],
  ['15-2041', 'statistician', 'biostatistician'],
  ['15-2031', 'operations research', 'optimization analyst'],
  ['15-2011', 'actuary', 'actuarial'],
  ['15-2021', 'mathematician'],
  // Product, design, marketing, sales
  ['11-2021', 'product manager', 'product owner', 'marketing manager', 'product marketing manager', 'product marketing',
    'brand manager', 'chief marketing officer', 'head marketing', 'director marketing', 'vp marketing', 'marketing director',
    'growth manager', 'demand generation manager', 'lifecycle marketing manager', 'group product manager', 'product lead',
    'digital marketing manager', 'performance marketing manager', 'product management', 'head product', 'director product',
    'vp product', 'chief product officer'],
  ['13-1161', 'marketing analyst', 'market research', 'marketing specialist', 'search engine optimization', 'growth marketer',
    'growth marketing', 'digital marketing', 'marketing coordinator', 'marketing associate', 'content marketing', 'social media',
    'marketing operations', 'email marketing', 'user experience researcher', 'user researcher', 'ux researcher',
    'consumer insights', 'campaign manager', 'community manager', 'paid media'],
  ['27-1024', 'graphic designer', 'visual designer', 'brand designer', 'marketing designer'],
  ['27-1011', 'art director', 'creative director', 'design manager', 'head design', 'design director'],
  ['27-1021', 'industrial designer'],
  ['27-1014', 'animator', 'motion designer', 'motion graphics'],
  ['27-3031', 'public relations', 'communications specialist', 'communications manager', 'pr specialist', 'communications coordinator'],
  ['11-2032', 'public relations manager', 'director communications', 'head communications'],
  ['27-3042', 'technical writer', 'documentation writer'],
  ['27-3043', 'content writer', 'copywriter', 'writer', 'content strategist', 'content creator'],
  ['27-3041', 'editor', 'content editor'],
  ['27-2012', 'producer', 'video producer'],
  ['11-2022', 'sales manager', 'sales director', 'director sales', 'vp sales', 'head sales', 'regional sales manager'],
  ['11-2011', 'advertising manager', 'promotions manager'],
  ['41-3091', 'account executive', 'sales representative', 'sales development representative', 'business development representative',
    'business development', 'account manager', 'sales associate', 'inside sales', 'customer success manager', 'customer success',
    'partnerships manager', 'sales executive', 'key account manager'],
  ['41-9031', 'sales engineer', 'solutions engineer', 'solutions consultant', 'pre sales', 'presales', 'technical account manager',
    'customer engineer', 'field engineer'],
  ['41-3031', 'trader', 'sales trader', 'stockbroker', 'securities sales'],
  // Business and consulting
  ['13-1111', 'consultant', 'management consultant', 'strategy consultant', 'business analyst', 'strategy analyst', 'strategy and operations',
    'business operations', 'operations analyst', 'process improvement', 'strategy associate', 'business consultant',
    'corporate strategy', 'strategy manager', 'transformation', 'management analyst', 'bizops', 'product operations'],
  ['13-1082', 'project manager', 'program manager', 'project coordinator', 'program coordinator', 'project management', 'pmo'],
  ['11-1021', 'operations manager', 'general manager', 'chief staff', 'chief of staff', 'director operations', 'head operations',
    'vp operations', 'business manager', 'store manager'],
  ['11-1011', 'chief executive officer', 'chief operating officer', 'founder', 'co founder', 'managing director'],
  ['13-1081', 'supply chain analyst', 'logistics analyst', 'logistician', 'supply chain', 'demand planner', 'inventory analyst'],
  ['11-3071', 'logistics manager', 'supply chain manager', 'distribution manager', 'warehouse manager'],
  ['13-1020', 'buyer', 'procurement specialist', 'purchasing agent', 'sourcing specialist', 'procurement analyst'],
  ['11-3061', 'purchasing manager', 'procurement manager'],
  ['13-1199', 'business operations specialist', 'operations specialist', 'operations associate', 'operations coordinator'],
  ['13-1121', 'event planner', 'event coordinator', 'event manager'],
  ['19-3011', 'economist'],
  ['13-1051', 'cost estimator'],
  // Finance
  ['13-2051', 'financial analyst', 'finance analyst', 'investment analyst', 'financial planning analysis', 'equity research',
    'investment banking analyst', 'investment banking associate', 'investment banking', 'corporate finance', 'valuation analyst',
    'private equity', 'venture capital', 'portfolio analyst', 'finance associate', 'investment associate', 'credit analyst corporate'],
  ['13-2011', 'accountant', 'auditor', 'staff accountant', 'tax accountant', 'audit associate', 'tax associate', 'internal audit',
    'audit', 'tax senior', 'external audit', 'accounting'],
  ['13-2052', 'financial advisor', 'financial planner', 'wealth advisor', 'wealth manager', 'financial adviser'],
  ['13-2054', 'risk analyst', 'credit risk', 'market risk', 'risk manager', 'model risk', 'risk management'],
  ['13-2041', 'credit analyst', 'loan analyst'],
  ['13-2053', 'underwriter', 'insurance underwriter'],
  ['13-2099', 'quantitative analyst', 'quant', 'quantitative developer', 'financial specialist'],
  ['11-3031', 'finance manager', 'financial manager', 'controller', 'treasurer', 'chief financial officer', 'finance director',
    'director finance', 'vp finance', 'head finance', 'treasury manager', 'accounting manager'],
  ['43-3031', 'bookkeeper', 'bookkeeping'],
  ['13-2072', 'loan officer'],
  // People
  ['13-1071', 'recruiter', 'talent acquisition', 'technical recruiter', 'sourcer', 'human resources generalist',
    'human resources specialist', 'people operations', 'people operations specialist', 'human resources business partner', 'people partner', 'recruiting coordinator',
    'talent partner', 'recruiting'],
  ['11-3121', 'human resources manager', 'human resources director', 'head people', 'chief people officer', 'vp people',
    'director people', 'people manager', 'talent acquisition manager', 'recruiting manager'],
  ['13-1141', 'compensation analyst', 'benefits specialist', 'compensation specialist', 'benefits analyst', 'total rewards'],
  ['11-3111', 'compensation manager', 'benefits manager', 'total rewards manager'],
  ['13-1151', 'learning and development', 'training specialist', 'trainer', 'corporate trainer', 'enablement'],
  ['25-9031', 'instructional designer', 'curriculum developer', 'instructional coordinator'],
  ['43-4161', 'human resources assistant', 'human resources coordinator'],
  // Engineering
  ['17-2141', 'mechanical engineer', 'mechanical design engineer'],
  ['17-2071', 'electrical engineer', 'power engineer'],
  ['17-2072', 'electronics engineer', 'rf engineer', 'analog engineer'],
  ['17-2061', 'hardware engineer', 'asic engineer', 'fpga engineer', 'chip designer', 'silicon engineer', 'verification engineer'],
  ['17-2051', 'civil engineer', 'structural engineer', 'transportation engineer'],
  ['17-2112', 'industrial engineer', 'manufacturing engineer', 'process engineer', 'quality engineer'],
  ['17-2041', 'chemical engineer'],
  ['17-2011', 'aerospace engineer'],
  ['17-2031', 'biomedical engineer', 'bioengineer'],
  ['17-2081', 'environmental engineer'],
  ['17-2199', 'robotics engineer', 'controls engineer', 'systems engineer hardware'],
  ['11-9041', 'engineering program manager', 'mechanical engineering manager', 'hardware engineering manager',
    'manufacturing manager engineering'],
  ['17-1011', 'architect building', 'licensed architect', 'project architect'],
  ['11-9021', 'construction manager'],
  // Healthcare and science
  ['29-1141', 'registered nurse', 'nurse', 'staff nurse', 'icu nurse', 'charge nurse', 'travel nurse'],
  ['29-1171', 'nurse practitioner'],
  ['29-1071', 'physician assistant', 'physician associate'],
  ['29-1051', 'pharmacist'],
  ['29-2052', 'pharmacy technician'],
  ['29-1123', 'physical therapist'],
  ['29-1122', 'occupational therapist'],
  ['29-1127', 'speech language pathologist', 'speech therapist'],
  ['29-1229', 'physician', 'doctor', 'hospitalist', 'medical doctor'],
  ['29-1215', 'family medicine', 'family physician', 'primary care physician'],
  ['29-1223', 'psychiatrist'],
  ['29-1021', 'dentist'],
  ['29-1292', 'dental hygienist'],
  ['29-1131', 'veterinarian'],
  ['29-2061', 'licensed practical nurse', 'lpn', 'lvn'],
  ['31-9092', 'medical assistant'],
  ['29-2034', 'radiologic technologist', 'x ray technician'],
  ['29-1031', 'dietitian', 'nutritionist'],
  ['11-9111', 'healthcare administrator', 'health services manager', 'practice manager', 'hospital administrator',
    'clinical manager', 'nurse manager', 'healthcare manager'],
  ['19-1042', 'medical scientist', 'clinical scientist', 'clinical research scientist'],
  ['19-1029', 'biologist', 'research associate biology'],
  ['19-2031', 'chemist'],
  ['19-1021', 'biochemist'],
  ['19-3033', 'psychologist', 'clinical psychologist'],
  ['21-1018', 'mental health counselor', 'therapist', 'counselor', 'behavioral health'],
  ['21-1022', 'social worker', 'healthcare social worker', 'medical social worker'],
  ['29-9021', 'health information'],
  ['29-2010', 'clinical laboratory technologist', 'medical laboratory scientist', 'lab technologist'],
  // Legal
  ['23-1011', 'lawyer', 'attorney', 'counsel', 'legal counsel', 'general counsel', 'associate attorney', 'litigator', 'solicitor'],
  ['23-2011', 'paralegal', 'legal assistant'],
  ['23-1012', 'law clerk', 'judicial clerk'],
  ['43-6012', 'legal secretary'],
  ['13-1041', 'compliance analyst', 'compliance officer', 'compliance specialist', 'compliance manager', 'regulatory affairs',
    'aml analyst', 'kyc analyst'],
  ['23-2099', 'legal operations', 'contract specialist', 'contracts manager'],
  // Education and admin
  ['25-2031', 'high school teacher', 'secondary school teacher'],
  ['25-2021', 'elementary school teacher', 'teacher'],
  ['43-6011', 'executive assistant'],
  ['43-6014', 'administrative assistant', 'office assistant', 'admin assistant'],
  ['43-4051', 'customer service representative', 'customer service', 'customer support', 'support specialist'],
  ['43-9061', 'office clerk'],
];

/** Occupations commonly confused with a matched one, offered first in the picker. */
const ALTERNATIVES: Record<string, string[]> = {
  '15-1252': ['15-1254', '15-1221', '11-3021'],
  '15-1221': ['15-1252', '15-2051'],
  '15-2051': ['15-2041', '13-1161', '15-1243'],
  '15-1243': ['15-1252', '15-2051'],
  '11-2021': ['11-3021', '13-1161', '15-1299'],
  '11-3021': ['11-2021', '15-1252'],
  '15-1299': ['13-1082', '11-3021'],
  '13-1082': ['15-1299', '11-1021'],
  '15-1255': ['27-1024', '13-1161'],
  '13-1161': ['11-2021', '15-2051'],
  '13-1111': ['13-1082', '15-1211', '13-2051'],
  '13-2051': ['13-2054', '13-2099', '11-3031'],
  '13-2099': ['13-2051', '15-2051'],
  '13-1071': ['11-3121', '13-1141'],
  '11-3121': ['13-1071'],
  '29-1229': ['29-1215', '29-1216'],
  '41-3091': ['11-2022', '41-9031'],
  '41-9031': ['41-3091', '15-1252'],
  '15-1212': ['15-1244', '15-1241'],
};

interface CompiledRule { code: string; phrase: string; re: RegExp; words: number }

const COMPILED: CompiledRule[] = RULES.flatMap(([code, ...phrases]) =>
  phrases.map((p) => {
    const phrase = normalizeTitle(p);
    return { code, phrase, re: new RegExp(`(?:^| )${phrase.replace(/ /g, ' (?:\\w+ )??')}(?: |$)`), words: phrase.split(' ').length };
  }),
);

export const CURATED_RULE_COUNT = RULES.length;
export const CURATED_PHRASE_COUNT = COMPILED.length;
export const CURATED_CODES = Array.from(new Set(RULES.map((r) => r[0])));

// ─── BLS titles ──────────────────────────────────────────────────────────────

// Words too generic to identify an occupation on their own.
const GENERIC = new Set([
  'all', 'other', 'except', 'specialist', 'specialists', 'worker', 'workers', 'manager', 'managers', 'assistant', 'assistants',
  'technician', 'technicians', 'operator', 'operators', 'occupation', 'occupations', 'clerk', 'clerks', 'and', 'or', 'of', 'the',
  'general', 'support', 'service', 'services', 'analyst', 'analysts', 'engineer', 'engineers', 'officer', 'officers',
  'representative', 'representatives', 'associate', 'senior', 'lead', 'staff', 'director', 'coordinator', 'helper', 'helpers',
]);

const wordsOf = (s: string) => s.split(' ').filter(Boolean).map(singular);

const BLS_INDEX = OEWS_OCCUPATIONS.map(([code, title]) => {
  const words = new Set(wordsOf(normalizeTitle(title)));
  return { code, title, words, key: [...words].filter((w) => !GENERIC.has(w)) };
});

function blsTitleMatch(core: string[]): { code: string; title: string; score: number }[] {
  const key = core.filter((w) => !GENERIC.has(w));
  if (!key.length) return [];
  const scored: { code: string; title: string; score: number }[] = [];
  for (const occ of BLS_INDEX) {
    if (!occ.key.length) continue;
    const hit = key.filter((w) => occ.words.has(w)).length;
    if (!hit) continue;
    // Share of the title's distinctive words found in the occupation, and of
    // the occupation's found in the title: both must be substantial, so
    // "nurse" does not match "Nurse Anesthetists" over "Registered Nurses"
    // on a tie, and "Dental Hygienist" lands on Dental Hygienists exactly.
    const recall = hit / key.length;
    const precision = occ.key.filter((w) => core.includes(w)).length / occ.key.length;
    // A title with one distinctive word must name the occupation's head word
    // ("Librarian" -> Librarians and Media Collections Specialists), or
    // "research" in "Research Assistant" would pick Operations Research
    // Analysts. Longer titles need half the occupation's words.
    if (key.length === 1 ? occ.key[0] !== key[0] : precision < 0.5) continue;
    scored.push({ code: occ.code, title: occ.title, score: recall * 0.6 + precision * 0.4 });
  }
  return scored.sort((a, b) => b.score - a.score);
}

// ─── Public ──────────────────────────────────────────────────────────────────

/** Words of a title with seniority, level and filler removed. */
export function coreWords(raw: string): string[] {
  return normalizeTitle(raw).split(' ').filter((w) => w && !SENIORITY.has(w)).map(singular);
}

function curatedMatch(text: string): CompiledRule | null {
  let best: CompiledRule | null = null;
  for (const r of COMPILED) {
    if (!r.re.test(text)) continue;
    if (!best || r.words > best.words || (r.words === best.words && r.phrase.length > best.phrase.length)) best = r;
  }
  return best;
}

export function matchTitle(raw: string): TitleMatch | null {
  const title = (raw ?? '').slice(0, 200);
  const full = normalizeTitle(title);
  if (!full) return null;

  // Qualifiers after a comma, dash or pipe ("Data Analyst, Growth", "PM -
  // Payments") usually name a team, so the part before them is tried first;
  // but "Manager, Product Marketing" puts the role last, so every segment is
  // tried and the most specific phrase across them wins.
  const segments = [full, ...title.split(/\s*(?:,|\||\s[-\u2013\u2014]\s|\/|\(|\)|:)\s*/).map(normalizeTitle).filter(Boolean)];
  const core = coreWords(title).join(' ');
  if (core) segments.push(core);

  let best: CompiledRule | null = null;
  for (const seg of segments) {
    const hit = curatedMatch(seg);
    if (hit && (!best || hit.words > best.words || (hit.words === best.words && hit.phrase.length > best.phrase.length))) best = hit;
  }
  const bls = blsTitleMatch(coreWords(title));
  // A one-word curated phrase is a weak signal ("controller" is usually a
  // finance role, but not in "Air Traffic Controller"). An exact BLS title
  // match, every distinctive word both ways, outranks it.
  const exactBls = bls.length > 0 && bls[0].score > 0.999;
  if (best && !(best.words === 1 && exactBls)) {
    return { code: best.code, source: 'curated', matched: best.phrase, alternatives: ALTERNATIVES[best.code] ?? [] };
  }

  if (bls.length && bls[0].score >= 0.6) {
    return { code: bls[0].code, source: 'bls-title', matched: bls[0].title, alternatives: bls.slice(1, 4).filter((b) => b.score >= 0.4).map((b) => b.code) };
  }
  return null;
}

/**
 * Up to `limit` occupations sharing words with the title, for a model to
 * choose from when nothing matched outright. Falls back to the curated codes
 * so the model always has a sensible list.
 */
export function shortlist(raw: string, limit = 12): string[] {
  const near = blsTitleMatch(coreWords(raw)).slice(0, limit).map((b) => b.code);
  return near.length >= 3 ? near : Array.from(new Set([...near, ...CURATED_CODES])).slice(0, 40);
}

const TITLES = new Map(OEWS_OCCUPATIONS.map(([code, title]) => [code, title]));
export const occupationTitle = (code: string): string | null => TITLES.get(code) ?? null;
export const isKnownOccupation = (code: string) => TITLES.has(code);
