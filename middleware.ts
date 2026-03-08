// middleware.ts
// NOTE: Keep this file alongside proxy.ts.
// proxy.ts handles Node.js runtime auth checks for pages.
// This file handles Edge-level CORS for /api/extension/* routes
// because proxy.ts is NOT guaranteed to run on Vercel for API routes.

import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Max-Age':       '86400',
};

export function middleware(request: NextRequest) {
  // OPTIONS preflight — return immediately, no exceptions, no redirects
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS });
  }

  // Extension API routes — attach CORS and pass through
  if (request.nextUrl.pathname.startsWith('/api/extension')) {
    const res = NextResponse.next();
    Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Only run on API routes — page auth is handled by proxy.ts
  matcher: ['/api/:path*'],
};