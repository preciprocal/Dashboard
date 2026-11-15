// components/jobs/CompanyLogo.tsx
//
// A company's logo on job and tracker cards, or its monogram when there is
// no logo (no domain found, or the site has no icon). useCompanyLogos fetches
// domains for the cards on screen, in batches, once per company.
'use client';

import { useEffect, useRef, useState } from 'react';

const initials = (name: string) =>
  name.replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/gi, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

// A steady tint per company, from a small muted palette.
const TINTS = ['#5b6cff', '#0ea5e9', '#14b8a6', '#a855f7', '#f59e0b', '#ec4899', '#22c55e', '#f97316'];
const tint = (name: string) => TINTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length];

export function CompanyLogo({ company, domain, size = 44 }: { company: string; domain?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const color = tint(company);
  const box = { width: size, height: size };
  if (domain && !failed) {
    return (
      <span className="rounded-xl flex items-center justify-center flex-shrink-0 bg-white overflow-hidden border border-white/[0.1]" style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small remote icon; next/image adds nothing here */}
        <img src={`/api/logos/icon?d=${encodeURIComponent(domain)}`} alt={`${company} logo`} width={Math.round(size * 0.62)} height={Math.round(size * 0.62)}
          loading="lazy" decoding="async" onError={() => setFailed(true)} className="object-contain" />
      </span>
    );
  }
  return (
    <span className="rounded-xl flex items-center justify-center flex-shrink-0 font-semibold tracking-wide"
      style={{ ...box, fontSize: Math.round(size * 0.3), background: `${color}1f`, color, border: `1px solid ${color}40` }} aria-hidden>
      {initials(company)}
    </span>
  );
}

/** Domains for the given companies, fetched in batches as new ones appear. */
export function useCompanyLogos(items: { company: string; url?: string | null }[]): Record<string, string | null> {
  const [domains, setDomains] = useState<Record<string, string | null>>({});
  const asked = useRef(new Set<string>());
  const key = items.map(i => i.company).join('|');

  useEffect(() => {
    const fresh = items.filter(i => i.company && !asked.current.has(i.company));
    if (!fresh.length) return;
    fresh.forEach(i => asked.current.add(i.company));
    const batches: typeof fresh[] = [];
    for (let i = 0; i < fresh.length; i += 40) batches.push(fresh.slice(i, i + 40));
    for (const batch of batches) {
      fetch('/api/logos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: batch }) })
        .then(r => (r.ok ? r.json() : { domains: {} }))
        .then(j => setDomains(prev => ({ ...prev, ...(j.domains ?? {}) })))
        .catch(() => {});
    }
  // `key` stands for the list of companies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return domains;
}
