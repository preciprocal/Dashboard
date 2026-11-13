// lib/salary/position.ts
// Where an offer sits in the BLS wage distribution, and what that suggests
// for negotiation. Pure and client-safe; no model involved, so the advice is
// the same every time for the same numbers and can be traced to them.

export interface WageBand {
  p10: number | null;
  p25: number | null;
  p50: number;
  p75: number | null;
  p90: number | null;
  /** Bitmask of top-coded percentiles: bit 0 = p10 ... bit 4 = p90. */
  capped: number;
}

export const PCT_KEYS = ['p10', 'p25', 'p50', 'p75', 'p90'] as const;
export type PctKey = (typeof PCT_KEYS)[number];
const PCTS: Record<PctKey, number> = { p10: 10, p25: 25, p50: 50, p75: 75, p90: 90 };

export const isCapped = (band: WageBand, key: PctKey) => (band.capped & (1 << PCT_KEYS.indexOf(key))) !== 0;

/** "$135,980", or "$239,200+" for a top-coded value. */
export function formatUsd(n: number, capped = false): string {
  return `$${Math.round(n).toLocaleString('en-US')}${capped ? '+' : ''}`;
}

/** "$136k" for tight spaces such as axis labels. */
export function formatUsdShort(n: number, capped = false): string {
  const k = n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
  return capped ? `${k}+` : k;
}

/**
 * An offer typed as "$120k", "120,000", "120000/yr", "$55/hr" or "55 an hour"
 * -> annual dollars. Hourly figures use BLS's own conversion (2,080 hours a
 * year). Ranges ("120-140k") take the lower end, as an offer's floor.
 */
export function parseOffer(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/,/g, '').trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2] === 'k') n *= 1000;
  else if (m[2] === 'm') n *= 1_000_000;
  const hourly = /(\/\s*h(ou)?r|per\s*h(ou)?r|an\s*hour|hourly|\/h\b)/.test(s);
  if (hourly) n *= 2080;
  else if (n > 0 && n < 1000) n *= 1000; // "120" in a salary field means $120k
  if (!Number.isFinite(n) || n < 10_000 || n > 5_000_000) return null;
  return Math.round(n);
}

/** Known points of the distribution, low to high. */
function points(band: WageBand): [number, number][] {
  return PCT_KEYS.filter((k) => band[k] !== null).map((k) => [PCTS[k], band[k] as number]);
}

export interface OfferPosition {
  /** Estimated percentile, 1 to 99; null when it cannot be placed. */
  percentile: number | null;
  /** True when the offer is beyond the outermost published percentile. */
  below: boolean;
  above: boolean;
  /** Short label: "about the 62nd percentile", "below the 10th percentile". */
  label: string;
  /** One line of negotiation advice grounded in the numbers. */
  suggestion: string;
}

const ordinal = (n: number) => {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/**
 * Linear interpolation between published percentiles. BLS only publishes
 * five points, so anything finer is an estimate and labelled "about".
 */
export function offerPosition(offer: number, band: WageBand): OfferPosition {
  const pts = points(band);
  const [loPct, lo] = pts[0];
  const [hiPct, hi] = pts[pts.length - 1];
  const hiCapped = isCapped(band, PCT_KEYS.find((k) => PCTS[k] === hiPct) ?? 'p90');

  let percentile: number | null = null;
  let below = false;
  let above = false;
  if (offer < lo) below = true;
  else if (offer > hi || (hiCapped && offer >= hi)) above = true;
  else {
    for (let i = 0; i < pts.length - 1; i++) {
      const [p1, v1] = pts[i];
      const [p2, v2] = pts[i + 1];
      if (offer >= v1 && offer <= v2) {
        percentile = v2 === v1 ? p1 : Math.round(p1 + ((offer - v1) / (v2 - v1)) * (p2 - p1));
        break;
      }
    }
  }

  const label = below
    ? `below the ${ordinal(loPct)} percentile`
    : above
      ? hiCapped ? `at or above the ${ordinal(hiPct)} percentile` : `above the ${ordinal(hiPct)} percentile`
      : `about the ${ordinal(Math.max(1, Math.min(99, percentile ?? 50)))} percentile`;

  return { percentile, below, above, label, suggestion: suggestionFor(offer, band, below, above, percentile) };
}

/** Rounds an ask to the nearest $1,000, which is how counters are phrased. */
const ask = (n: number) => formatUsd(Math.round(n / 1000) * 1000);

function suggestionFor(offer: number, b: WageBand, below: boolean, above: boolean, pct: number | null): string {
  const p75 = b.p75 ?? b.p50;
  if (below || (pct !== null && pct < 25)) {
    return `Your offer is in the bottom quarter for this occupation here. A counter at the median, around ${ask(b.p50)}, is well supported by the data.`;
  }
  if (pct !== null && pct < 50) {
    return `Your offer is below the median of ${formatUsd(b.p50)}. Asking for ${ask(Math.max(b.p50, offer * 1.05))} to ${ask((b.p50 + p75) / 2)} is a reasonable, data-backed counter.`;
  }
  if (pct !== null && pct < 75) {
    return `Your offer is above the median. There is still room up to the 75th percentile (${formatUsd(p75)}); tie a modest ask to your experience and impact.`;
  }
  if (above || (pct !== null && pct >= 90)) {
    return 'Your offer is in the top 10 percent for this occupation here. Focus any negotiation on bonus, equity, start date or flexibility rather than base.';
  }
  return 'Your offer is in the top quarter for this occupation here. A small base ask is fine, but bonus, equity or start date may move more easily.';
}
