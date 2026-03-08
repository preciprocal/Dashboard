// proxy.ts
// Handles page-level auth protection (Node.js runtime).
// CORS for /api/extension/* is handled by middleware.ts (Edge runtime).

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/help', '/terms', '/privacy', '/subscription', '/pricing'];
const AUTH_ROUTES   = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth/action'];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets — skip
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // All API routes — pass through (CORS handled by middleware.ts)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Session check for pages
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
  // Only run on page routes — API routes handled by middleware.ts
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};