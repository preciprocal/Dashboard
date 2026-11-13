// scripts/verify-salary.ts
// Pins the market pay rules: job titles map to the right BLS occupation,
// locations to the right metro, state or national area, offers parse and
// land at the right percentile, and the ingest reads BLS markers ("*", "#")
// correctly. No network or database.
//
//   npm run verify:salary

import { matchTitle, coreWords, CURATED_RULE_COUNT, CURATED_PHRASE_COUNT, CURATED_CODES, isKnownOccupation } from '@/lib/salary/match-title';
import { matchLocation, NATIONAL_AREA } from '@/lib/salary/match-location';
import { parseOffer, offerPosition, formatUsd, type WageBand } from '@/lib/salary/position';
import { COMMON_OCCUPATIONS } from '@/lib/salary/occupations';
// The ingest's row parser; the app never imports it, so it is pinned here.
import * as oews from './salary/oews.mjs';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else { failed++; console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`); }
}

// ─── Titles ──────────────────────────────────────────────────────────────────

const TITLES: [string, string][] = [
  // Software
  ['Senior Software Engineer II', '15-1252'],
  ['Software Engineer', '15-1252'],
  ['SWE Intern', '15-1252'],
  ['Staff Software Engineer, Payments', '15-1252'],
  ['Sr. Backend Engineer (Go)', '15-1252'],
  ['Front End Developer', '15-1252'],
  ['Full-Stack Engineer', '15-1252'],
  ['iOS Engineer', '15-1252'],
  ['Android Developer - Consumer', '15-1252'],
  ['Machine Learning Engineer', '15-1252'],
  ['ML Engineer, Ads Ranking', '15-1252'],
  ['Site Reliability Engineer', '15-1252'],
  ['DevOps Engineer', '15-1252'],
  ['Member of Technical Staff', '15-1252'],
  ['Software Development Engineer II', '15-1252'],
  ['SDE I', '15-1252'],
  ['Principal Engineer', '15-1252'],
  ['New Grad Software Engineer 2026', '15-1252'],
  ['Embedded Software Engineer', '15-1252'],
  ['.NET Developer', '15-1252'],
  ['C++ Developer', '15-1252'],
  ['Software Engineering Intern, Summer 2026', '15-1252'],
  ['Product Engineer', '15-1252'],
  ['Forward Deployed Engineer', '15-1252'],
  ['Customer Support Engineer', '15-1232'],
  ['Web Developer', '15-1254'],
  ['QA Engineer', '15-1253'],
  ['SDET', '15-1253'],
  ['Security Engineer', '15-1212'],
  ['Cybersecurity Analyst', '15-1212'],
  ['Information Security Analyst', '15-1212'],
  ['Solutions Architect', '15-1241'],
  ['Network Engineer', '15-1241'],
  ['Data Engineer', '15-1243'],
  ['Senior Analytics Engineer', '15-1243'],
  ['Database Administrator', '15-1242'],
  ['Systems Administrator', '15-1244'],
  ['IT Support Specialist', '15-1232'],
  ['Help Desk Technician', '15-1232'],
  ['Research Scientist, AI', '15-1221'],
  ['Applied Scientist', '15-1221'],
  ['Engineering Manager', '11-3021'],
  ['Senior Engineering Manager, Platform', '11-3021'],
  ['Director of Engineering', '11-3021'],
  ['VP of Engineering', '11-3021'],
  ['Vice President, Engineering', '11-3021'],
  ['CTO', '11-3021'],
  ['IT Manager', '11-3021'],
  ['Technical Program Manager', '15-1299'],
  ['Scrum Master', '15-1299'],
  ['Business Systems Analyst', '15-1211'],
  ['Salesforce Administrator', '15-1211'],
  // Data
  ['Data Analyst, Growth', '15-2051'],
  ['Data Scientist', '15-2051'],
  ['Senior Data Scientist - Experimentation', '15-2051'],
  ['Business Intelligence Analyst', '15-2051'],
  ['BI Developer', '15-2051'],
  ['Product Analyst', '15-2051'],
  ['Statistician', '15-2041'],
  ['Biostatistician II', '15-2041'],
  ['Actuarial Analyst', '15-2011'],
  ['Operations Research Analyst', '15-2031'],
  // Product and design
  ['Product Manager', '11-2021'],
  ['Senior Product Manager, Payments', '11-2021'],
  ['Sr. PM - Payments', '11-2021'],
  ['Associate Product Manager', '11-2021'],
  ['APM', '11-2021'],
  ['Product Owner', '11-2021'],
  ['Head of Product', '11-2021'],
  ['Director, Product Management', '11-2021'],
  ['Technical Product Manager', '11-3021'],
  ['Product Designer', '15-1255'],
  ['UX Designer', '15-1255'],
  ['UI/UX Designer', '15-1255'],
  ['Graphic Designer', '27-1024'],
  ['UX Researcher', '13-1161'],
  ['Creative Director', '27-1011'],
  // Marketing and sales
  ['Marketing Manager', '11-2021'],
  ['Product Marketing Manager', '11-2021'],
  ['Manager, Product Marketing', '11-2021'],
  ['Brand Manager', '11-2021'],
  ['Digital Marketing Specialist', '13-1161'],
  ['SEO Specialist', '13-1161'],
  ['Marketing Analyst', '13-1161'],
  ['Social Media Coordinator', '13-1161'],
  ['Content Writer', '27-3043'],
  ['Copywriter', '27-3043'],
  ['Technical Writer', '27-3042'],
  ['Communications Specialist', '27-3031'],
  ['Account Executive', '41-3091'],
  ['SDR', '41-3091'],
  ['Business Development Representative', '41-3091'],
  ['Customer Success Manager', '41-3091'],
  ['Sales Engineer', '41-9031'],
  ['Solutions Engineer', '41-9031'],
  ['Sales Manager', '11-2022'],
  // Business and consulting
  ['Management Consultant', '13-1111'],
  ['Consultant', '13-1111'],
  ['Senior Consultant, Strategy', '13-1111'],
  ['Associate Consultant', '13-1111'],
  ['Business Analyst', '13-1111'],
  ['Strategy & Operations Associate', '13-1111'],
  ['Project Manager', '13-1082'],
  ['Program Manager', '13-1082'],
  ['Operations Manager', '11-1021'],
  ['Chief of Staff', '11-1021'],
  ['Supply Chain Analyst', '13-1081'],
  ['Economist', '19-3011'],
  // Finance
  ['Financial Analyst', '13-2051'],
  ['FP&A Analyst', '13-2051'],
  ['Investment Banking Analyst', '13-2051'],
  ['Equity Research Associate', '13-2051'],
  ['Private Equity Associate', '13-2051'],
  ['Staff Accountant', '13-2011'],
  ['Senior Auditor', '13-2011'],
  ['CPA', '13-2011'],
  ['Tax Associate', '13-2011'],
  ['Financial Advisor', '13-2052'],
  ['Risk Analyst', '13-2054'],
  ['Credit Analyst', '13-2041'],
  ['Quantitative Analyst', '13-2099'],
  ['Controller', '11-3031'],
  ['Finance Manager', '11-3031'],
  ['CFO', '11-3031'],
  // People
  ['Recruiter', '13-1071'],
  ['Technical Recruiter', '13-1071'],
  ['Talent Acquisition Partner', '13-1071'],
  ['HR Generalist', '13-1071'],
  ['HRBP', '13-1071'],
  ['People Operations Specialist', '13-1071'],
  ['HR Manager', '11-3121'],
  ['Head of People', '11-3121'],
  ['Compensation Analyst', '13-1141'],
  ['Learning and Development Specialist', '13-1151'],
  ['Instructional Designer', '25-9031'],
  // Engineering
  ['Mechanical Engineer', '17-2141'],
  ['Electrical Engineer', '17-2071'],
  ['Hardware Engineer', '17-2061'],
  ['Civil Engineer', '17-2051'],
  ['Manufacturing Engineer', '17-2112'],
  ['Chemical Engineer', '17-2041'],
  ['Aerospace Engineer', '17-2011'],
  ['Biomedical Engineer', '17-2031'],
  // Healthcare
  ['Registered Nurse', '29-1141'],
  ['RN - ICU', '29-1141'],
  ['Travel Nurse', '29-1141'],
  ['Nurse Practitioner', '29-1171'],
  ['Family Nurse Practitioner (FNP)', '29-1171'],
  ['Physician Assistant', '29-1071'],
  ['Pharmacist', '29-1051'],
  ['Physical Therapist', '29-1123'],
  ['Occupational Therapist', '29-1122'],
  ['Hospitalist Physician', '29-1229'],
  ['Medical Assistant', '31-9092'],
  ['Dental Hygienist', '29-1292'],
  ['Practice Manager', '11-9111'],
  ['Clinical Research Scientist', '19-1042'],
  ['Clinical Psychologist', '19-3033'],
  ['Social Worker', '21-1022'],
  // Legal
  ['Associate Attorney', '23-1011'],
  ['Corporate Lawyer', '23-1011'],
  ['Legal Counsel', '23-1011'],
  ['General Counsel', '23-1011'],
  ['Paralegal', '23-2011'],
  ['Law Clerk', '23-1012'],
  ['Compliance Analyst', '13-1041'],
  // Matched through BLS titles rather than the curated map
  ['Dietitian', '29-1031'],
  ['Veterinarian', '29-1131'],
  ['Elementary School Teacher', '25-2021'],
  ['Executive Assistant', '43-6011'],
  ['Customer Service Representative', '43-4051'],
  ['Electrician', '47-2111'],
  ['Flight Attendant', '53-2031'],
  ['Air Traffic Controller', '53-2021'],
  ['Librarian', '25-4022'],
  ['Urban Planner', '19-3051'],
  ['Nurse Anesthetist', '29-1151'],
  ['Truck Driver', '53-3033'],
];

for (const [title, want] of TITLES) {
  const got = matchTitle(title);
  check(`title "${title}" -> ${want}`, got?.code === want, got ? `${got.code} via ${got.source} "${got.matched}"` : 'no match');
}

const blsOnly = ['Electrician', 'Flight Attendant', 'Air Traffic Controller', 'Librarian', 'Urban Planner'];
check('titles outside the curated map match through BLS occupation titles',
  blsOnly.every((t) => matchTitle(t)?.source === 'bls-title'), blsOnly.map((t) => `${t}:${matchTitle(t)?.source}`).join(', '));

// A single generic word must not drag in an occupation that merely contains it.
for (const junk of ['', '   ', 'asdfgh', 'Ninja', 'Rockstar', 'Engineer', 'Analyst', 'Associate', 'Research Assistant', 'Head of Growth']) {
  check(`no confident match for "${junk}"`, matchTitle(junk) === null, JSON.stringify(matchTitle(junk)));
}

check('seniority and level words are stripped', coreWords('Senior Staff Software Engineer II, L5').join(' ') === 'software engineer');
check(`curated map has at least 80 entries (${CURATED_RULE_COUNT} occupations, ${CURATED_PHRASE_COUNT} phrases)`, CURATED_PHRASE_COUNT >= 80 && CURATED_RULE_COUNT >= 80);
const unknownCurated = CURATED_CODES.filter((c) => !isKnownOccupation(c));
check('every curated SOC code exists in the OEWS release', unknownCurated.length === 0, unknownCurated.join(', '));
const unknownCommon = COMMON_OCCUPATIONS.filter((o) => !isKnownOccupation(o.code)).map((o) => o.code);
check('every picker occupation exists in the OEWS release', unknownCommon.length === 0, unknownCommon.join(', '));
check('alternatives never repeat the match', TITLES.every(([t]) => { const m = matchTitle(t); return !m || !m.alternatives.includes(m.code); }));

// ─── Locations ───────────────────────────────────────────────────────────────

const BOS = '0014460', NY = '0035620', SF = '0041860', SJ = '0041940', SEA = '0042660', DC = '0047900', LA = '0031080';
const AUS = '0012420', CHI = '0016980', DAL = '0019100', PDX = '0038900', DUR = '0020500', ATL = '0012060';
const LOCATIONS: [string, string, string][] = [
  // [input, first candidate, kind]
  ['Boston, MA', BOS, 'metro'],
  ['Cambridge, MA', BOS, 'metro'],
  ['Somerville, Massachusetts', BOS, 'metro'],
  ['NYC', NY, 'metro'],
  ['New York, NY', NY, 'metro'],
  ['New York City', NY, 'metro'],
  ['Brooklyn, NY', NY, 'metro'],
  ['Jersey City, NJ', NY, 'metro'],
  ['San Francisco Bay Area', SF, 'metro'],
  ['San Francisco, CA', SF, 'metro'],
  ['SF', SF, 'metro'],
  ['Menlo Park, CA', SF, 'metro'],
  ['Palo Alto, CA', SJ, 'metro'],
  ['Mountain View, California', SJ, 'metro'],
  ['San Jose, CA', SJ, 'metro'],
  ['Seattle, WA', SEA, 'metro'],
  ['Redmond, WA', SEA, 'metro'],
  ['Bellevue, WA', SEA, 'metro'],
  ['Washington, DC', DC, 'metro'],
  ['Arlington, VA', DC, 'metro'],
  ['McLean, VA', DC, 'metro'],
  ['Los Angeles, CA', LA, 'metro'],
  ['Santa Monica, CA', LA, 'metro'],
  ['Irvine, CA', LA, 'metro'],
  ['Austin, TX', AUS, 'metro'],
  ['Austin TX 78701', AUS, 'metro'],
  ['Chicago, IL', CHI, 'metro'],
  ['Plano, TX', DAL, 'metro'],
  ['Arlington, TX', DAL, 'metro'],
  ['Portland, OR', PDX, 'metro'],
  ['Portland', PDX, 'metro'],
  ['Durham, NC', DUR, 'metro'],
  ['Atlanta, Georgia', ATL, 'metro'],
  ['Hybrid - Boston, MA', BOS, 'metro'],
  ['Remote - NYC', NY, 'metro'],
  ['Boston, MA (Hybrid)', BOS, 'metro'],
  // States
  ['California', '0600000', 'state'],
  ['Texas', '4800000', 'state'],
  ['Remote, CA', '0600000', 'state'],
  ['Hanover, NH', '3300000', 'state'],
  ['New York State', '3600000', 'state'],
  ['Puerto Rico', '7200000', 'state'],
  // National
  ['Remote', NATIONAL_AREA, 'national'],
  ['Remote (US)', NATIONAL_AREA, 'national'],
  ['United States', NATIONAL_AREA, 'national'],
  ['Anywhere', NATIONAL_AREA, 'national'],
  ['', NATIONAL_AREA, 'national'],
  ['London, UK', NATIONAL_AREA, 'national'],
];

for (const [input, want, kind] of LOCATIONS) {
  const got = matchLocation(input);
  check(`location "${input}" -> ${want} (${kind})`, got.candidates[0] === want && got.kind === kind, `${got.candidates.join(',')} ${got.kind}`);
}
check('a metro falls back to its state, then national', matchLocation('Boston, MA').candidates.join(',') === `${BOS},2500000,${NATIONAL_AREA}`);
check('a multi-state metro uses the state the user named', matchLocation('Jersey City, NJ').candidates[1] === '3400000');
check('every result ends with national', LOCATIONS.every(([i]) => matchLocation(i).candidates.at(-1) === NATIONAL_AREA));
check('remote is flagged', matchLocation('Remote').remote && !matchLocation('Boston, MA').remote);

// ─── Offers ──────────────────────────────────────────────────────────────────

const OFFERS: [string, number | null][] = [
  ['$145,000', 145000], ['145000', 145000], ['145k', 145000], ['$145K', 145000], ['145', 145000],
  ['$70/hr', 145600], ['55 an hour', 114400], ['$120-140k', 120000], ['120,000 - 140,000', 120000],
  ['', null], ['competitive', null], ['$5', null],
];
for (const [raw, want] of OFFERS) check(`offer "${raw}" -> ${want}`, parseOffer(raw) === want, String(parseOffer(raw)));

// May 2025 national Software Developers.
const SWE: WageBand = { p10: 82460, p25: 105210, p50: 135980, p75: 171980, p90: 214670, capped: 0 };
check('the median is the 50th percentile', offerPosition(135980, SWE).percentile === 50);
check('interpolates between published points', offerPosition(153980, SWE).percentile === 63, String(offerPosition(153980, SWE).percentile));
check('below the 10th is labelled, not guessed', offerPosition(70000, SWE).below && offerPosition(70000, SWE).label === 'below the 10th percentile');
check('above the 90th is labelled', offerPosition(250000, SWE).above && offerPosition(250000, SWE).label === 'above the 90th percentile');
check('a low offer is told to counter at the median', offerPosition(95000, SWE).suggestion.includes('$136,000'));
check('a strong offer is pointed at non-salary terms', /bonus, equity/.test(offerPosition(200000, SWE).suggestion));
// A top-coded 90th (e.g. surgeons): "#" means at least the top code.
const TOP: WageBand = { p10: 120000, p25: 180000, p50: 230000, p75: 239200, p90: 239200, capped: 0b11000 };
check('an offer at a top-coded 90th is "at or above"', offerPosition(239200, TOP).label === 'at or above the 90th percentile', offerPosition(239200, TOP).label);
check('formatUsd marks top-coded values', formatUsd(239200, true) === '$239,200+');
const PARTIAL: WageBand = { p10: null, p25: 50000, p50: 60000, p75: null, p90: null, capped: 0 };
check('withheld percentiles still place an offer', offerPosition(55000, PARTIAL).percentile === 38 && offerPosition(70000, PARTIAL).above);
check('suggestions contain no em or en dashes', [70000, 120000, 150000, 190000, 260000].every((o) => !/[\u2013\u2014]/.test(offerPosition(o, SWE).suggestion)));

// ─── Ingest row parsing ──────────────────────────────────────────────────────

check('reads the top code from the BLS notes',
  oews.topCodeFromNotes('#  = indicates a wage equal to or greater than $115.00 per hour or $239,200 per year ') === 239200);
check('"#" is the top code, flagged', JSON.stringify(oews.parseWage('#', 239200)) === JSON.stringify({ value: 239200, capped: true }));
check('"*" is unknown', oews.parseWage('*', 239200).value === null && oews.parseWage('**', 239200).value === null);
check('numbers parse, decimals round', oews.parseWage('135980', 239200).value === 135980 && oews.parseWage('74.180000000000007', 1).value === 74);
check('"**" employment is unknown', oews.parseEmployment('**') === null && oews.parseEmployment('1687890') === 1687890);
check('area codes cannot collide across kinds',
  oews.areaCode('national', '99') === '0000000' && oews.areaCode('state', '6') === '0600000' && oews.areaCode('metro', '14460') === '0014460');

const base = {
  AREA: '14460', AREA_TITLE: 'Boston-Cambridge-Newton, MA-NH', AREA_TYPE: '4', PRIM_STATE: 'MA', I_GROUP: 'cross-industry',
  OWN_CODE: '1235', OCC_CODE: '29-1248', OCC_TITLE: 'Surgeons', O_GROUP: 'detailed', TOT_EMP: '**',
  A_PCT10: '120000', A_PCT25: '*', A_MEDIAN: '#', A_PCT75: '#', A_PCT90: '#',
};
const rec = oews.toRecord(base, 239200);
check('a top-coded row keeps its flags', rec?.wage.capped === 0b11100 && rec.wage.p50 === 239200 && rec.wage.p25 === null && rec.wage.employment === null,
  JSON.stringify(rec?.wage));
check('a row without a median is dropped', oews.toRecord({ ...base, A_MEDIAN: '*' }, 239200) === null);
check('broad and major groups are dropped', oews.toRecord({ ...base, O_GROUP: 'broad' }, 239200) === null && oews.toRecord({ ...base, O_GROUP: 'major' }, 239200) === null);
check('industry-specific rows are dropped', oews.toRecord({ ...base, I_GROUP: 'sector' }, 239200) === null);
check('state rows get a state area code', oews.toRecord({ ...base, AREA: '25', AREA_TYPE: '2' }, 239200)?.area.code === '2500000');

console.log(`\n${passed} passed, ${failed} failed (${TITLES.length} titles, ${LOCATIONS.length} locations)`);
process.exit(failed ? 1 : 0);
