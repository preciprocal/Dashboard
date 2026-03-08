// proxy.ts
import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Max-Age':       '86400',
};

const PUBLIC_ROUTES = ['/help', '/terms', '/privacy', '/subscription', '/pricing'];
const AUTH_ROUTES   = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth/action'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── STEP 1: OPTIONS — respond immediately for EVERY route, no exceptions ──
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS });
  }

  // ── STEP 2: Extension API — attach CORS headers, skip all auth checks ─────
  if (pathname.startsWith('/api/extension')) {
    const res = NextResponse.next();
    Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // ── STEP 3: Static assets / Next.js internals ─────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // ── STEP 4: All other API routes — pass through, no auth gate ────────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── STEP 5: Page-level session check ──────────────────────────────────────
  const session    = request.cookies.get('session')?.value || request.cookies.get('__session')?.value;
  const isLoggedIn = Boolean(session);

  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  if (AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};