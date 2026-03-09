// lib/cors.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://preciprocal.com',
  'https://www.preciprocal.com',
  'http://localhost:3000',
  // Add chrome-extension://YOUR_ID here when published
];

function getAllowOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  // No origin = service worker / background script = safe to allow
  if (!origin) return '*';
  // chrome-extension origins always allowed (local dev)
  if (origin.startsWith('chrome-extension://')) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export function corsHeaders(request: NextRequest) {
  return {
    'Access-Control-Allow-Origin':  getAllowOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
    'Access-Control-Max-Age':       '86400',
  };
}

export function optionsResponse(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export function withCors(body: unknown, request: NextRequest, init: { status?: number } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: corsHeaders(request) });
}

export function errorResponse(message: string, status: number, request: NextRequest) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders(request) });
}