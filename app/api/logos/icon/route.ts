// app/api/logos/icon/route.ts
//
// GET ?d=<domain> -> the company's logo (PNG), or 404 when there is none, so
// the card shows its monogram. Fetched here rather than by the browser, so a
// student's browser never tells a third party which companies they look at,
// and cached for a week at the edge.
//
// With LOGO_DEV_TOKEN set (a publishable key from logo.dev), the official
// square brand logo from logo.dev; otherwise, or when logo.dev has none, the
// site's icon via Google. The X-Logo-Kind header says which ("brand" or
// "icon"), for anyone checking.
import { NextRequest, NextResponse } from 'next/server';
import { isDomain } from '@/lib/jobs/logos';

export const runtime = 'nodejs';

const WEEK = 'public, max-age=604800, s-maxage=604800, immutable';

async function image(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  const type = r?.headers.get('content-type') ?? '';
  if (!r || !r.ok || !type.startsWith('image/')) return null;
  const body = await r.arrayBuffer();
  return body.byteLength > 200 ? { body, type } : null;
}

export async function GET(request: NextRequest) {
  const d = (new URL(request.url).searchParams.get('d') ?? '').toLowerCase();
  if (!isDomain(d)) return new NextResponse(null, { status: 400 });

  const token = process.env.LOGO_DEV_TOKEN;
  const brand = token
    ? await image(`https://img.logo.dev/${encodeURIComponent(d)}?token=${encodeURIComponent(token)}&size=200&format=png&retina=true&fallback=404`)
    : null;
  const found = brand ?? await image(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`);
  if (!found) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
  return new NextResponse(found.body, {
    headers: { 'Content-Type': found.type, 'Cache-Control': WEEK, 'X-Logo-Kind': brand ? 'brand' : 'icon' },
  });
}
