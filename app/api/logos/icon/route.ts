// app/api/logos/icon/route.ts
//
// GET ?d=<domain> -> the company's logo (PNG), or 404 when there is none, so
// the card shows its monogram. Fetched here rather than by the browser, so a
// student's browser never tells a third party which companies they look at.
//
// Brand logos come from our Storage copy (lib/jobs/logo-store.ts), filled
// from logo.dev once per company. A company logo.dev does not have falls back
// to the site's icon via Google. The X-Logo-Kind header says which ("brand"
// or "icon"). Callers add &v= to the URL when this changes, because responses
// are cached in browsers and at the edge.
import { NextRequest, NextResponse } from 'next/server';
import { isDomain } from '@/lib/jobs/logos';
import { fetchAndStoreLogo, readStoredLogo } from '@/lib/jobs/logo-store';

export const runtime = 'nodejs';

const LONG = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800';
const SHORT = 'public, max-age=86400, s-maxage=86400';

async function siteIcon(d: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  const type = r?.headers.get('content-type') ?? '';
  if (!r || !r.ok || !type.startsWith('image/')) return null;
  const body = await r.arrayBuffer();
  return body.byteLength > 200 ? { body, type } : null;
}

export async function GET(request: NextRequest) {
  const d = (new URL(request.url).searchParams.get('d') ?? '').toLowerCase();
  if (!isDomain(d)) return new NextResponse(null, { status: 400 });

  const stored = await readStoredLogo(d).catch(() => null);
  const brand = stored && stored !== 'none' ? stored : stored === null ? await fetchAndStoreLogo(d).catch(() => null) : null;
  if (brand) return new NextResponse(brand.body, { headers: { 'Content-Type': brand.type, 'Cache-Control': LONG, 'X-Logo-Kind': 'brand' } });

  const icon = await siteIcon(d);
  if (!icon) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': SHORT } });
  // Shorter, so a brand logo added later shows up within a day.
  return new NextResponse(icon.body, { headers: { 'Content-Type': icon.type, 'Cache-Control': SHORT, 'X-Logo-Kind': 'icon' } });
}
