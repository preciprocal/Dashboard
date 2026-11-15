// app/api/logos/icon/route.ts
//
// GET ?d=<domain> -> the site's icon (PNG), or 404 when it has none, so the
// card shows its monogram. Fetched here rather than by the browser, so a
// student's browser never calls Google with the companies they look at, and
// cached for a week at the edge.
import { NextRequest, NextResponse } from 'next/server';
import { isDomain } from '@/lib/jobs/logos';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const d = (new URL(request.url).searchParams.get('d') ?? '').toLowerCase();
  if (!isDomain(d)) return new NextResponse(null, { status: 400 });
  try {
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`, { signal: AbortSignal.timeout(6000) });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !type.startsWith('image/')) {
      return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
    }
    return new NextResponse(await r.arrayBuffer(), {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable' },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
