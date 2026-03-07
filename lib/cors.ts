// lib/cors.ts
// Import this in every /api/extension/* route file

import { NextResponse } from 'next/server';

export const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization',
  'Access-Control-Max-Age':       '86400',
};

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function withCors(body: unknown, init: { status?: number } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: CORS,
  });
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: CORS });
}