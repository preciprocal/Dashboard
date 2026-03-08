// proxy.ts — page auth only. CORS is handled per-route in /api/extension/*.
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/help', '/terms', '/privacy', '/subscription', '/pricing'];
const AUTH_ROUTES   = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/auth/action'];

export default function proxy(request: NextRequest) {
  // OPTIONS and all API routes — never redirect, pass straight through
  // so the route handler's own OPTIONS() export can respond with CORS headers
  if (
    request.method === 'OPTIONS' ||
    request.nextUrl.pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Page auth
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};