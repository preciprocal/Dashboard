// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':      '*',
  'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':     'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Max-Age':           '86400',
};

const PUBLIC_ROUTES = ['/help', '/terms', '/privacy', '/subscription', '/pricing'];

const AUTH_ROUTES = [
  '/sign-in', '/sign-up', '/forgot-password',
  '/reset-password', '/verify-email', '/onboarding', '/auth/action',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. OPTIONS preflight — always respond immediately, never redirect ────
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── 2. Extension API routes — pass through with CORS headers ─────────────
  // These routes handle their own auth via x-extension-token header.
  // They must never be redirected by session cookie checks.
  if (pathname.startsWith('/api/extension')) {
    const response = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // ── 3. Static assets ──────────────────────────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // ── 4. Other public API routes ────────────────────────────────────────────
  if (pathname.startsWith('/api/webhook')) {
    return NextResponse.next();
  }

  // ── 5. Session check ──────────────────────────────────────────────────────
  const sessionCookie =
    request.cookies.get('session')?.value ||
    request.cookies.get('__session')?.value;
  const isLoggedIn = Boolean(sessionCookie);

  // ── 6. Public pages ───────────────────────────────────────────────────────
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // ── 7. Auth pages ─────────────────────────────────────────────────────────
  if (AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // ── 8. Protected pages ────────────────────────────────────────────────────
  if (!isLoggedIn) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Exclude from middleware:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - /api/extension/* (handles own auth, must never be redirected)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/extension).*)',
  ],
};