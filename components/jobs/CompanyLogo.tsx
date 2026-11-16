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

/** Bumped when the logo source changes, so browsers and the edge drop copies they cached. */
const LOGO_VERSION = 2;

// How a loaded logo is shown, worked out once per image from its pixels:
//   tile  the logo is its own filled square (an app-icon style mark): its
//         empty margin is trimmed and it fills the tile, on its own edge
//         colour, so no white rim or corners show around it;
//   mark  a mark on a transparent background: trimmed and centred on white
//         with even padding, so every logo has the same breathing room.
type Look = { src: string; kind: 'tile' | 'mark'; bg: string; small: boolean };
const looks = new Map<string, Look>();

function analyse(img: HTMLImageElement, url: string): Look {
  const fallback: Look = { src: url, kind: 'mark', bg: '#ffffff', small: img.naturalWidth < 64 };
  try {
    const n = Math.min(img.naturalWidth, img.naturalHeight, 160) || 64;
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, n, n);
    const px = ctx.getImageData(0, 0, n, n).data;
    const a = (x: number, y: number) => px[(y * n + x) * 4 + 3];
    // The opaque part's bounds.
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (a(x, y) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return fallback;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    // A filled square: the middle of each edge of the bounds is solid.
    const mx = x0 + (w >> 1), my = y0 + (h >> 1);
    const solid = [a(mx, y0), a(mx, y1), a(x0, my), a(x1, my)].every(v => v > 200);
    const tile = solid && Math.abs(w - h) <= n * 0.06;
    // Trim to the bounds (square, centred), so margins are the same for every logo.
    const side = Math.max(w, h);
    const out = document.createElement('canvas');
    out.width = side; out.height = side;
    out.getContext('2d')!.drawImage(c, x0, y0, w, h, (side - w) / 2, (side - h) / 2, w, h);
    let bg = '#ffffff';
    if (tile) {
      const i = ((y0 + 1) * n + mx) * 4;
      bg = `rgb(${px[i]}, ${px[i + 1]}, ${px[i + 2]})`;
    }
    return { src: out.toDataURL('image/png'), kind: tile ? 'tile' : 'mark', bg, small: img.naturalWidth < 64 };
  } catch {
    return fallback;
  }
}

export function CompanyLogo({ company, domain, size = 44 }: { company: string; domain?: string | null; size?: number }) {
  const url = domain ? `/api/logos/icon?d=${encodeURIComponent(domain)}&v=${LOGO_VERSION}` : '';
  const [failed, setFailed] = useState(false);
  const [look, setLook] = useState<Look | null>(() => (url ? looks.get(url) ?? null : null));
  // A different company in the same slot (lists reuse components).
  useEffect(() => { setLook(url ? looks.get(url) ?? null : null); setFailed(false); }, [url]);
  const color = tint(company);
  const box = { width: size, height: size };
  if (domain && !failed) {
    const inner = look?.kind === 'tile' ? size : Math.round(size * (look?.small ? 0.56 : 0.7));
    return (
      <span className="relative rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-inset ring-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        style={{ ...box, background: look?.bg ?? 'rgba(255,255,255,0.05)' }}>
        {look ? (
          // eslint-disable-next-line @next/next/no-img-element -- a trimmed copy of the logo, as a data URL
          <img src={look.src} alt={`${company} logo`} width={inner} height={inner} className="object-contain" style={{ width: inner, height: inner }} />
        ) : (
          // Loaded once, measured, then replaced by the trimmed copy above.
          // eslint-disable-next-line @next/next/no-img-element -- a small remote logo; next/image adds nothing here
          <img src={url} alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async" className="opacity-0 absolute"
            onError={() => setFailed(true)}
            onLoad={e => { const l = analyse(e.currentTarget, url); looks.set(url, l); setLook(l); }} />
        )}
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
