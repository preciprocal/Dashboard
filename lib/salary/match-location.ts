// lib/salary/match-location.ts
// Free-text job location -> BLS area codes, most specific first.
//
// Postings say "Boston, MA", "NYC", "San Francisco Bay Area", "Remote (US)"
// or "Redmond, WA". BLS publishes pay for metro areas (named after their
// principal cities, "Seattle-Tacoma-Bellevue, WA"), states and the nation.
// The result is an ordered list of candidates (metro, then state, then
// national) because BLS withholds some occupations in some areas; the lookup
// takes the first one with data and says when it fell back.
//
// Order of attempts: known nicknames and suburbs (which are not in metro
// names), then "City, ST" against metro principal cities, then a state on its
// own. Remote or unrecognised locations use national figures.

import { OEWS_METROS } from '@/lib/salary/oews-data';

export const NATIONAL_AREA = '0000000';

export interface LocationMatch {
  /** Area codes to try, most specific first; always ends with national. */
  candidates: string[];
  kind: 'metro' | 'state' | 'national';
  /** Why national was used, when it was. */
  remote: boolean;
}

// [postal code, FIPS, name]. FIPS codes make the BLS state area code.
const STATES: [string, string, string][] = [
  ['AL', '01', 'alabama'], ['AK', '02', 'alaska'], ['AZ', '04', 'arizona'], ['AR', '05', 'arkansas'], ['CA', '06', 'california'],
  ['CO', '08', 'colorado'], ['CT', '09', 'connecticut'], ['DE', '10', 'delaware'], ['DC', '11', 'district of columbia'],
  ['FL', '12', 'florida'], ['GA', '13', 'georgia'], ['HI', '15', 'hawaii'], ['ID', '16', 'idaho'], ['IL', '17', 'illinois'],
  ['IN', '18', 'indiana'], ['IA', '19', 'iowa'], ['KS', '20', 'kansas'], ['KY', '21', 'kentucky'], ['LA', '22', 'louisiana'],
  ['ME', '23', 'maine'], ['MD', '24', 'maryland'], ['MA', '25', 'massachusetts'], ['MI', '26', 'michigan'], ['MN', '27', 'minnesota'],
  ['MS', '28', 'mississippi'], ['MO', '29', 'missouri'], ['MT', '30', 'montana'], ['NE', '31', 'nebraska'], ['NV', '32', 'nevada'],
  ['NH', '33', 'new hampshire'], ['NJ', '34', 'new jersey'], ['NM', '35', 'new mexico'], ['NY', '36', 'new york'],
  ['NC', '37', 'north carolina'], ['ND', '38', 'north dakota'], ['OH', '39', 'ohio'], ['OK', '40', 'oklahoma'], ['OR', '41', 'oregon'],
  ['PA', '42', 'pennsylvania'], ['RI', '44', 'rhode island'], ['SC', '45', 'south carolina'], ['SD', '46', 'south dakota'],
  ['TN', '47', 'tennessee'], ['TX', '48', 'texas'], ['UT', '49', 'utah'], ['VT', '50', 'vermont'], ['VA', '51', 'virginia'],
  ['WA', '53', 'washington'], ['WV', '54', 'west virginia'], ['WI', '55', 'wisconsin'], ['WY', '56', 'wyoming'],
  ['GU', '66', 'guam'], ['PR', '72', 'puerto rico'], ['VI', '78', 'virgin islands'],
];
const BY_POSTAL = new Map(STATES.map(([p, f, n]) => [p, { postal: p, fips: f, name: n }]));
const BY_NAME = new Map(STATES.map(([p, f, n]) => [n, { postal: p, fips: f, name: n }]));

export const stateArea = (postal: string) => {
  const s = BY_POSTAL.get(postal.toUpperCase());
  return s ? `${s.fips}00000` : null;
};

// Metro areas: principal cities and states, parsed from the BLS names.
const METROS = OEWS_METROS.map(([code, name, primary]) => {
  const [cityPart, statePart = ''] = name.split(', ');
  return {
    code,
    name,
    primary,
    cities: cityPart.split('-').map((c) => c.toLowerCase().trim()),
    states: statePart.split('-').map((s) => s.trim().toUpperCase()).filter(Boolean),
  };
});
const METRO_BY_CODE = new Map(METROS.map((m) => [m.code, m]));

/** Metro code (7 digits) by the name of its first principal city and state. */
function metro(city: string, state: string): string {
  const m = METROS.find((x) => x.cities[0] === city && x.states.includes(state));
  // A missing metro would be a delineation change in a new release: fail the
  // verify script loudly rather than silently match nothing.
  if (!m) throw new Error(`metro ${city}, ${state} not in OEWS data`);
  return m.code;
}

// Nicknames, neighbourhoods and suburbs that metro names do not list.
// [place, state or '' for any, metro]. Places are matched as whole words.
const ALIASES: [string, string, string][] = [
  ...['nyc', 'new york city', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'long island', 'hoboken', 'stamford',
    'white plains', 'westchester', 'tri state', 'new york metro'].map((p): [string, string, string] => [p, '', metro('new york', 'NY')]),
  ['new york', 'NY', metro('new york', 'NY')],
  ['new york', '', metro('new york', 'NY')],
  ...['bay area', 'sf bay area', 'san francisco bay area', 'sf', 'sfo', 'berkeley', 'san mateo', 'redwood city', 'menlo park',
    'foster city', 'south san francisco', 'burlingame', 'emeryville', 'walnut creek', 'san bruno', 'hayward', 'pleasanton']
    .map((p): [string, string, string] => [p, '', metro('san francisco', 'CA')]),
  ...['silicon valley', 'palo alto', 'mountain view', 'sunnyvale', 'cupertino', 'milpitas', 'los gatos', 'campbell', 'los altos',
    'south bay'].map((p): [string, string, string] => [p, '', metro('san jose', 'CA')]),
  ...['redmond', 'kirkland', 'bothell', 'everett', 'renton', 'issaquah'].map((p): [string, string, string] => [p, 'WA', metro('seattle', 'WA')]),
  ['seattle area', '', metro('seattle', 'WA')],
  ...['washington dc', 'washington d c', 'dc', 'd c', 'dmv', 'reston', 'mclean', 'tysons', 'herndon', 'bethesda', 'rockville',
    'silver spring', 'chantilly', 'fairfax', 'gaithersburg', 'vienna'].map((p): [string, string, string] => [p, '', metro('washington', 'DC')]),
  ['arlington', 'VA', metro('washington', 'DC')],
  ['washington', 'DC', metro('washington', 'DC')],
  ...['somerville', 'waltham', 'burlington', 'lexington', 'woburn', 'quincy', 'needham', 'brookline', 'greater boston']
    .map((p): [string, string, string] => [p, 'MA', metro('boston', 'MA')]),
  ['cambridge', 'MA', metro('boston', 'MA')],
  ['greater boston', '', metro('boston', 'MA')],
  ...['santa monica', 'culver city', 'pasadena', 'burbank', 'irvine', 'playa vista', 'el segundo', 'glendale', 'torrance',
    'costa mesa', 'newport beach', 'hollywood', 'venice', 'santa ana'].map((p): [string, string, string] => [p, 'CA', metro('los angeles', 'CA')]),
  ['la', 'CA', metro('los angeles', 'CA')],
  ['greater los angeles', '', metro('los angeles', 'CA')],
  ...['evanston', 'oak brook', 'schaumburg', 'deerfield'].map((p): [string, string, string] => [p, 'IL', metro('chicago', 'IL')]),
  ...['plano', 'irving', 'frisco', 'richardson', 'addison', 'mckinney', 'dfw'].map((p): [string, string, string] => [p, 'TX', metro('dallas', 'TX')]),
  ['dfw', '', metro('dallas', 'TX')],
  ['the woodlands', 'TX', metro('houston', 'TX')],
  ...['alpharetta', 'marietta', 'duluth'].map((p): [string, string, string] => [p, 'GA', metro('atlanta', 'GA')]),
  ['research triangle park', 'NC', metro('durham', 'NC')],
  ['rtp', 'NC', metro('durham', 'NC')],
  ['morrisville', 'NC', metro('raleigh', 'NC')],
  ...['scottsdale', 'tempe', 'chandler', 'mesa'].map((p): [string, string, string] => [p, 'AZ', metro('phoenix', 'AZ')]),
  ['portland', '', metro('portland', 'OR')],
  ['beaverton', 'OR', metro('portland', 'OR')],
  ['st paul', 'MN', metro('minneapolis', 'MN')],
  ['saint paul', 'MN', metro('minneapolis', 'MN')],
  ['twin cities', '', metro('minneapolis', 'MN')],
  ['saint louis', 'MO', metro('st. louis', 'MO')],
  ['st louis', '', metro('st. louis', 'MO')],
  ['jersey city', 'NJ', metro('new york', 'NY')],
  ['newark', 'NJ', metro('new york', 'NY')],
  ['king of prussia', 'PA', metro('philadelphia', 'PA')],
  ['conshohocken', 'PA', metro('philadelphia', 'PA')],
  ['south florida', '', metro('miami', 'FL')],
  ['fort lauderdale', 'FL', metro('miami', 'FL')],
];

// ─── Parsing ─────────────────────────────────────────────────────────────────

const REMOTE = /\b(remote|anywhere|work from home|wfh|distributed|virtual|nationwide|united states|usa|u s a|us only|us)\b/;

function clean(raw: string): string {
  return ` ${raw.toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

const hasPhrase = (text: string, phrase: string) => text.includes(` ${phrase} `);

/** The state named in a location, from its last comma part or a trailing two-letter code. */
function stateOf(raw: string): string | null {
  const parts = raw.split(/[,(|]/).map((p) => p.replace(/[).]/g, '').trim()).filter(Boolean);
  for (const part of parts.slice(1).reverse()) {
    const words = part.split(/\s+/);
    for (const w of words) {
      if (w.length === 2 && w === w.toUpperCase() && BY_POSTAL.has(w)) return w;
    }
    const lower = part.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [name, s] of BY_NAME) if (lower === name || lower.startsWith(`${name} `) || lower.endsWith(` ${name}`)) return s.postal;
  }
  // "Austin TX", "Boston MA 02110"
  const tail = raw.trim().match(/\b([A-Z]{2})(?:\s+\d{5})?\s*$/);
  if (tail && BY_POSTAL.has(tail[1])) return tail[1];
  // A bare state name: "California", "New York State"
  const whole = raw.toLowerCase().replace(/\bstate\b/, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (BY_NAME.has(whole)) return BY_NAME.get(whole)!.postal;
  if (raw.trim().length === 2 && BY_POSTAL.has(raw.trim().toUpperCase())) return raw.trim().toUpperCase();
  return null;
}

function withFallbacks(metroCode: string | null, state: string | null, remote: boolean): LocationMatch {
  const out: string[] = [];
  if (metroCode) out.push(metroCode);
  const st = state ?? (metroCode ? METRO_BY_CODE.get(metroCode)?.primary ?? null : null);
  const stCode = st ? stateArea(st) : null;
  if (stCode) out.push(stCode);
  out.push(NATIONAL_AREA);
  return { candidates: out, kind: metroCode ? 'metro' : stCode ? 'state' : 'national', remote };
}

export function matchLocation(raw: string | null | undefined): LocationMatch {
  const input = (raw ?? '').slice(0, 200);
  const text = clean(input);
  if (!text.trim()) return withFallbacks(null, null, false);
  const state = stateOf(input);

  // 0. A bare state name ("California", "New York State") is the state, not
  // a city of the same name. "New York" alone means the city far more often
  // in postings, so it only counts as the state with the word "state".
  const bare = input.toLowerCase().replace(/\bstate\b/, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (state && BY_NAME.has(bare) && (bare !== 'new york' || /\bstate\b/i.test(input))) return withFallbacks(null, state, false);

  // 1. Aliases, longest first so "south san francisco" beats "san francisco".
  const aliases = [...ALIASES].sort((a, b) => b[0].length - a[0].length);
  for (const [place, st, code] of aliases) {
    if (!hasPhrase(text, place)) continue;
    if (st && state && st !== state) continue;
    // A two-letter alias ("la", "dc", "sf") only counts with its state, or alone.
    if (place.length <= 3 && st && !state && text.trim() !== place) continue;
    const metroStates = METRO_BY_CODE.get(code)?.states ?? [];
    return withFallbacks(code, state && metroStates.includes(state) ? state : null, false);
  }

  // 2. Metro principal cities, preferring a metro in the stated state.
  let best: (typeof METROS)[number] | null = null;
  let bestLen = 0;
  for (const m of METROS) {
    for (const city of m.cities) {
      const c = clean(city).trim();
      if (c.length < 3 || !hasPhrase(text, c)) continue;
      if (state && !m.states.includes(state)) continue;
      // Longer city names are more specific ("west palm beach" over "palm").
      // Among equals the first principal city wins, so "Portland" without a
      // state is handled by the alias above rather than by list order.
      const score = c.length + (m.cities[0] === city ? 0.5 : 0);
      if (score > bestLen) { best = m; bestLen = score; }
    }
  }
  if (best) return withFallbacks(best.code, state && best.states.includes(state) ? state : null, false);

  // 3. A state alone, then remote, then national.
  if (state) return withFallbacks(null, state, false);
  return withFallbacks(null, null, REMOTE.test(text));
}

export function metroName(code: string): string | null {
  return METRO_BY_CODE.get(code)?.name ?? null;
}
