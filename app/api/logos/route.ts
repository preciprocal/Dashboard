// app/api/logos/route.ts
//
// POST { items: [{ company, url? }] } -> { domains: { [company]: domain | null } }
// The domain each company's logo comes from (lib/jobs/logos.ts). Cards show
// the logo through /api/logos/icon, or their monogram when this is null.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { resolveDomains } from '@/lib/jobs/logos';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { items?: unknown };
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((x): x is { company: string; url?: string } => !!x && typeof (x as { company?: unknown }).company === 'string')
      .map(x => ({ company: x.company.slice(0, 120), url: typeof x.url === 'string' ? x.url.slice(0, 500) : null }));
    return NextResponse.json({ domains: await resolveDomains(items) });
  } catch (error) {
    console.error('❌ logos:', error);
    return NextResponse.json({ domains: {} });
  }
}
