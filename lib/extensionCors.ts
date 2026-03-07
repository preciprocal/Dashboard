// lib/utils/extensionCors.ts
// Use this in all /api/extension/* routes to allow requests from the Chrome extension

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://www.linkedin.com',
  'https://linkedin.com',
  'chrome-extension://',  // matches any extension origin
];

export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') || '';

  // Allow any chrome-extension:// origin or LinkedIn
  const isAllowed =
    origin.startsWith('chrome-extension://') ||
    ALLOWED_ORIGINS.some((o) => origin.startsWith(o));

  const allowedOrigin = isAllowed ? origin : 'null';

  return {
    'Access-Control-Allow-Origin':      allowedOrigin,
    'Access-Control-Allow-Methods':     'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, x-extension-token, x-user-email, x-user-id',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age':           '86400',
  };
}

// Call this at the top of every extension route — handles preflight instantly
export function handleCors(request: NextRequest): NextResponse | null {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  return null;
}

// Wrap any NextResponse with CORS headers
export function withCors(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const headers = getCorsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}