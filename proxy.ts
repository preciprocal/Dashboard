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

export default function proxy(request: NextRequest) {
  // ── OPTIONS: must be first, before anything else ──────────────────────────
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS });
  }

  const { pathname } = request.nextUrl;

  // ── Extension API: attach CORS, skip auth ─────────────────────────────────
  if (pathname.startsWith('/api/extension')) {
    const res = NextResponse.next();
    Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // ── Static assets ─────────────────────────────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // ── All other API routes: pass through ────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Page auth ─────────────────────────────────────────────────────────────
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
  matcher: [
    '/api/(.*)',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};