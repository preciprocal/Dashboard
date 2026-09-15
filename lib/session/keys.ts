// lib/session/keys.ts
// Redis key shape for session revocation, deliberately in its own module with
// ZERO imports.
//
// middleware.ts needs this key and runs on the edge runtime. Importing it from
// lib/session/registry.ts would pull that module's whole dependency graph -
// supabase-js, Resend, node crypto - into the middleware bundle, which is both
// far heavier than the edge budget wants and not edge-compatible. Keep this
// file dependency-free.

export const revokedKey = (sessionId: string) => `sess:revoked:${sessionId}`;
