// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

// ─── CORS headers for Chrome extension API routes ────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':      '*',
  'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':     'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Max-Age':           '86400',
};

// ─── Public routes — accessible without auth ─────────────────────────────────
const PUBLIC_ROUTES = [
  '/help',
  '/terms',
  '/privacy',
  '/subscription',
  '/pricing',
];

// ─── Auth routes — redirect to "/" if already logged in ──────────────────────
const AUTH_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/onboarding',
  '/auth/action',
];

// ─── Public API routes — no auth required ────────────────────────────────────
const PUBLIC_API_ROUTES = [
  '/api/webhook',
  '/api/extension', // extension routes are auth'd via their own token
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Handle Chrome extension CORS routes first ──────────────────────────
  if (pathname.startsWith('/api/extension/') || pathname === '/api/extension') {
    // Intercept OPTIONS preflight immediately — must return before any redirect
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Pass through POST/GET with CORS headers attached
    const response = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // ── 2. Allow static assets & Next.js internals ────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // ── 3. Allow public API routes ────────────────────────────────────────────
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // ── 4. Check session cookie (Firebase session) ────────────────────────────
  const sessionCookie =
    request.cookies.get('session')?.value ||
    request.cookies.get('__session')?.value;

  const isLoggedIn = Boolean(sessionCookie);

  // ── 5. Allow public routes for everyone ───────────────────────────────────
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // ── 6. Auth routes — redirect to home if already logged in ────────────────
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // ── 7. Protected routes — redirect to sign-in if not logged in ────────────
  if (!isLoggedIn) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};